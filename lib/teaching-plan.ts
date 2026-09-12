import type {Lesson,Slot,State,Teacher} from './scheduler';
import {runs,overlaps,key} from './scheduler';
import {matchTeachingPeriod} from './monthly-redistribution';
import {hasWorkAssignment} from './work-assignments';
import {studentForLesson,statusAt} from './students';
import {lessonPreferencePriority} from './preference-priority';

/** Construct a day's plan from available teaching patterns, not a greedy teacher
 * order. Period matching is cached by the active staff set. Full coverage takes
 * precedence over fallback availability, staffing cost and pupil balance.
 * Large custom days use a bounded search; small pattern combinations are enumerated exactly.
 */
export function buildTeachingPlan(state:State,scope:string[],reasons:Record<string,string>){
 const selected=new Set(scope),teachers=state.teachers.filter(t=>t.autoAssignLessons!==false&&t.max>0);
 const canTeach=(t:Teacher,l:Lesson,sl:Slot)=>!!t.rooms?.includes(sl.room)&&!!t.curricula?.includes(l.course)&&(!l.exam||t.canSuperviseExam===true);
 const eligible=(l:Lesson,sl:Slot)=>{const student=studentForLesson(state,l);return !student||statusAt(student,sl.date)==='active'};
 const groups=[...new Set(state.slots.filter(sl=>selected.has(sl.id)).map(sl=>sl.room+'|'+sl.date))].sort();
 for(const group of groups){
  const day=state.slots.filter(sl=>sl.room+'|'+sl.date===group).sort((a,b)=>a.start.localeCompare(b.start));
  const ids=new Set(day.map(sl=>sl.id));
  const pupils=state.lessons.filter(l=>ids.has(l.slot)&&!l.absent&&eligible(l,day.find(sl=>sl.id===l.slot)!));
  // Outside-scope and explicitly manually managed lessons are fixed.
  const pool=pupils.filter(l=>selected.has(l.slot)&&(!l.teacher||teachers.some(t=>t.name===l.teacher)));
  if(!pool.length)continue;
  const available=(t:Teacher,sl:Slot)=>['yes','reserve'].includes(state.availability[key(t.name,sl.id)])&&!hasWorkAssignment(state,t.name,sl.id)&&!state.slots.some(other=>other.id!==sl.id&&overlaps(other,sl)&&(!ids.has(other.id)||!selected.has(other.id))&&(hasWorkAssignment(state,t.name,other.id)||state.duty[key(t.name,other.id)]||state.lessons.some(l=>!l.absent&&l.slot===other.id&&l.teacher===t.name)));
  const staff=teachers.filter(t=>day.some(sl=>available(t,sl)&&pool.some(l=>l.slot===sl.id&&canTeach(t,l,sl))));
  // Keep pathological inputs bounded; the existing feasible proposal is retained.
  if(staff.length>12||day.length>10)continue;
  const minimum=[3,5].includes(new Date(day[0].date+'T12:00:00').getDay())?1:2;
  const patterns=staff.map(t=>{
   const list:number[]=[];
   for(let mask=0;mask<2**day.length;mask++){
    const chosen=day.filter((_,i)=>mask&(1<<i));
    if(day.some((sl,i)=>!selected.has(sl.id)&&!!(mask&(1<<i))!==pupils.some(l=>l.slot===sl.id&&l.teacher===t.name)))continue;
    if(chosen.some(sl=>selected.has(sl.id)&&(!available(t,sl)||!pool.some(l=>l.slot===sl.id&&canTeach(t,l,sl)))))continue;
    if(runs(day,chosen.map(sl=>sl.id)).some(run=>run.length<minimum||run.length>4))continue;
    list.push(mask);
   }
   return list;
  });
  if(patterns.some(list=>!list.length))continue;
  const firmPeriods=staff.map(t=>Math.max(1,day.filter(sl=>available(t,sl)&&state.availability[key(t.name,sl.id)]==='yes'&&pool.some(l=>l.slot===sl.id&&canTeach(t,l,sl))).length));
  const cache=new Map<string,{assignment:Map<Lesson,string>;coverage:number;priority:number;pupilCost:number}|null>();
  const period=(i:number,mask:number)=>{
   const cacheKey=i+'|'+mask;if(cache.has(cacheKey))return cache.get(cacheKey)!;
   const sl=day[i],lessons=pool.filter(l=>l.slot===sl.id),working=staff.filter((_,j)=>mask&(1<<j));
   const priority=(l:Lesson)=>(l.exam?10000:0)+13-(lessonPreferencePriority(state,l,sl)??13);
   const assignment=matchTeachingPeriod(lessons,working,(t,l)=>canTeach(t,l,sl),{allowUnassigned:true,priority});
   const result=assignment?{assignment,coverage:assignment.size,priority:[...assignment.keys()].reduce((sum,l)=>sum+priority(l),0),pupilCost:working.reduce((sum,t)=>sum+[...assignment.values()].filter(name=>name===t.name).length**2,0)}:null;
   cache.set(cacheKey,result);return result;
  };
  type Candidate={masks:number[];coverage:number;priority:number;reserve:number;periods:number;utilization:number;pupils:number};
  const better=(a:Candidate,b:Candidate)=>a.coverage>b.coverage||a.coverage===b.coverage&&(a.priority>b.priority||a.priority===b.priority&&(a.reserve<b.reserve||a.reserve===b.reserve&&(a.periods<b.periods||a.periods===b.periods&&(a.utilization>b.utilization+1e-9||Math.abs(a.utilization-b.utilization)<1e-9&&a.pupils<b.pupils))));
  let best:Candidate|undefined,visits=0;
  const chosen:number[]=[];
  const search=(j:number)=>{
   if(++visits>250000)return;
   if(j<staff.length){for(const mask of patterns[j]){chosen[j]=mask;search(j+1)}return;}
   const candidate:Candidate={masks:[...chosen],coverage:0,priority:0,reserve:0,periods:0,utilization:0,pupils:0};
   for(let i=0;i<day.length;i++){
    if(!selected.has(day[i].id))continue;
    const mask=staff.reduce((value,_,k)=>value|(chosen[k]&(1<<i)?1<<k:0),0),result=period(i,mask);if(!result)return;
    candidate.coverage+=result.coverage;candidate.priority+=result.priority;candidate.pupils+=result.pupilCost;
    for(let k=0;k<staff.length;k++)if(mask&(1<<k)){candidate.periods++;if(state.availability[key(staff[k].name,day[i].id)]==='yes')candidate.utilization+=1/firmPeriods[k];if(state.availability[key(staff[k].name,day[i].id)]==='reserve')candidate.reserve++;}
   }
   if(!best||better(candidate,best))best=candidate;
  };
  search(0);
  if(!best)continue;
  const winner=best as Candidate;
  // If a bounded search cannot match the incoming coverage, keep that proposal.
  if(winner.coverage<pool.filter(l=>l.teacher).length)continue;
  for(const lesson of pool)lesson.teacher='';
  for(const t of staff)for(const sl of day.filter(sl=>selected.has(sl.id)))delete state.duty[key(t.name,sl.id)];
  for(let i=0;i<day.length;i++)if(selected.has(day[i].id)){
   const mask=staff.reduce((value,_,k)=>value|(winner.masks[k]&(1<<i)?1<<k:0),0);
   for(const [lesson,name] of period(i,mask)!.assignment){lesson.teacher=name;state.duty[key(name,lesson.slot)]=true;reasons[lesson.id]='同じ日の勤務パターンと担当科目を組み合わせ、未担当と不足時のみの出勤を抑えて配分';}
  }
 }
}

import {japanToday} from './past-schedule';
import {studentScheduleDatesLocked,studentScheduleStatus} from './student-schedule-status';
import {lessonPreferencePriority,comparePreferencePriority,preferencePriority} from './preference-priority';
import {studentForLesson,studentForPreference,statusAt} from './students';
import {type State,autoAssign} from './scheduler';
import {staffingGap} from './staff-capacity';
import {chooseMonthlyPair,type MonthlyCandidate} from './monthly-student-placement';
import JapaneseHolidays from 'japanese-holidays';

const {isHoliday}=JapaneseHolidays;
const isJapaneseHoliday=(date:string)=>isHoliday(new Date(`${date}T12:00:00+09:00`))!==undefined;

export function configuredSlots(s:State,month:string,room:string){
 const start=new Date(month+'-01T12:00:00Z'),finish=new Date(start);finish.setUTCMonth(finish.getUTCMonth()+1);
 const dates=[...Array(31)].map((_,index)=>new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),index+1,12))).filter(date=>date<finish);
 const closeOnHolidays=s.settings?.closeOnHolidays?.[room]??true;
 return (s.settings?.schedules?.filter(item=>item.room===room)||[]).flatMap(schedule=>{
  const matching=dates.filter(date=>date.getUTCDay()===schedule.weekday),regular=matching.filter(date=>Math.floor((date.getUTCDate()-1)/7)+1<=4),fifth=matching.find(date=>Math.floor((date.getUTCDate()-1)/7)+1===5);
  const lessonDates=closeOnHolidays?regular.filter(date=>!isJapaneseHoliday(date.toISOString().slice(0,10))):regular;
  if(closeOnHolidays&&regular.some(date=>isJapaneseHoliday(date.toISOString().slice(0,10)))&&fifth&&!isJapaneseHoliday(fifth.toISOString().slice(0,10)))lessonDates.push(fifth);
  return lessonDates.flatMap(date=>schedule.periods.map(period=>{const day=date.toISOString().slice(0,10);return {id:room+'-'+day+'-'+period.start,room,date:day,start:period.start,end:period.end}}));
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
}

export function generate(s:State,month:string,room:string,options:{existingSlotsOnly?:boolean;scope?:string[];blocked?:Map<string,Set<string>>;skipAssignment?:boolean;now?:Date}={}){
 const today=japanToday(options.now);const n=structuredClone(s);let count=0;let skipped=0;let inactive=0;let createdSlots=0;
 const monthlyCounts=new Map<string,number>();
 const monthlyPairs=new Map<string,MonthlyCandidate[]>();
 for(const lesson of n.lessons){
  const student=studentForLesson(n,lesson),slot=n.slots.find(item=>item.id===lesson.slot);
  // A transferred lesson belongs to its original contract month, including absences.
  if(student&&(lesson.originalDate||slot?.date||'').startsWith(month))monthlyCounts.set(student.id,(monthlyCounts.get(student.id)||0)+1);
 }
 const start=new Date(month+'-01T12:00:00Z'),finish=new Date(start);finish.setUTCMonth(finish.getUTCMonth()+1);
 for(const slot of options.existingSlotsOnly?[]:configuredSlots(n,month,room).filter(slot=>slot.date>=today)){if(n.slots.some(item=>item.id===slot.id))continue;n.slots.push(slot);createdSlots++}
 for(const p of [...(n.preferences||[])].sort((a,b)=>Number(!!a.alternatives?.length)-Number(!!b.alternatives?.length)||preferencePriority(a)-preferencePriority(b))){
  if(p.room!==room)continue;const student=studentForPreference(n,p);
  // Do not refill a manually changed agreed month, or a month awaiting a request decision.
  if(student&&(studentScheduleDatesLocked(student,month)||studentScheduleStatus(n,student,month).pending)){skipped++;continue;}
  for(let d=new Date(start);d<finish;d.setUTCDate(d.getUTCDate()+1)){
   const sourceDate=d.toISOString().slice(0,10),week=Math.floor((d.getUTCDate()-1)/7)+1;
   if(d.getUTCDay()!==p.weekday||week>4||!p.weeks.includes(week))continue;
   if(student&&(monthlyCounts.get(student.id)||0)>=student.monthlyLessons){skipped++;continue;}
   if(n.lessons.some(l=>l.occurrence===p.id+'|'+sourceDate)){skipped++;continue;}
   const choices:State['slots']=[];let inactiveCandidate=false;
   for(const option of [p,...(p.alternatives||[])]){
    const candidateDay=[...Array(31)].map((_,i)=>new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),i+1,12))).find(day=>day<finish&&day.getUTCDay()===option.weekday&&Math.floor((day.getUTCDate()-1)/7)+1===week);
    if(!candidateDay)continue;
    let lessonDate=candidateDay.toISOString().slice(0,10);
    if((n.settings?.closeOnHolidays?.[room]??true)&&isJapaneseHoliday(lessonDate)){
     const replacement=[...Array(31)].map((_,i)=>new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),i+1,12))).find(day=>day<finish&&day.getUTCDay()===option.weekday&&Math.floor((day.getUTCDate()-1)/7)+1===5);
     if(!replacement)continue;lessonDate=replacement.toISOString().slice(0,10);if(isJapaneseHoliday(lessonDate))continue;
    }
    if(lessonDate<today)continue;
    if(student&&statusAt(student,lessonDate)!=='active'){inactiveCandidate=true;continue;}
    if(n.lessons.some(l=>(student?(l.studentId===student.id||(!l.studentId&&l.name===p.name)):l.name===p.name)&&(l.originalDate===lessonDate||n.slots.some(sl=>sl.id===l.slot&&sl.date===lessonDate))))continue;
    let slot=n.slots.find(sl=>sl.room===room&&sl.date===lessonDate&&sl.start===option.start&&sl.end===option.end);
    if(!slot){
     if(options.existingSlotsOnly)continue;
     if(n.slots.some(sl=>sl.room===room&&sl.date===lessonDate&&sl.start<option.end&&option.start<sl.end))continue;
     slot={id:room+'-'+lessonDate+'-'+option.start,room,date:lessonDate,start:option.start,end:option.end};
    }
    if(options.scope&&!options.scope.includes(slot.id))continue;
    if(student&&options.blocked?.get(student.id)?.has(slot.id))continue;
    if(!choices.some(sl=>sl.id===slot!.id))choices.push(slot);
   }
   if(!choices.length){if(inactiveCandidate)inactive++;else skipped++;continue;}
   const probe={id:crypto.randomUUID(),studentId:student?.id,name:student?.name||p.name,course:student?.course||p.course,slot:'',teacher:'',note:'',exam:false,absent:false};
   if(student?.monthlyLessons===2){
    const candidates=monthlyPairs.get(student.id)||[];
    for(const slot of choices)candidates.push({slot,priority:preferencePriority(p),lesson:{...probe,slot:slot.id,occurrence:p.id+'|'+sourceDate,originalDate:sourceDate,note:slot.date!==sourceDate||slot.start!==p.start?'通塾希望の候補から作成':'通塾希望から作成'}});
    monthlyPairs.set(student.id,candidates);continue;
   }
   const slot=choices.map((candidate,index)=>({candidate,index,gap:staffingGap(n,candidate,{...probe,slot:candidate.id})-staffingGap(n,candidate)})).sort((a,b)=>a.gap-b.gap||comparePreferencePriority(lessonPreferencePriority(n,probe,a.candidate),lessonPreferencePriority(n,probe,b.candidate))||a.index-b.index)[0].candidate;
   if(!n.slots.some(sl=>sl.id===slot.id)){n.slots.push(slot);createdSlots++;}
   n.lessons.push({...probe,occurrence:p.id+'|'+sourceDate,originalDate:sourceDate,slot:slot.id,note:slot.date!==sourceDate||slot.start!==p.start?'通塾希望の候補から作成':'通塾希望から作成'});count++;
   if(student)monthlyCounts.set(student.id,(monthlyCounts.get(student.id)||0)+1);
  }
 }
 // Place constrained students first, after fixed monthly-four schedules have used capacity.
 const plans=[...monthlyPairs].sort(([idA,a],[idB,b])=>new Set(a.map(c=>c.slot.date)).size-new Set(b.map(c=>c.slot.date)).size||Math.min(...a.map(c=>c.priority))-Math.min(...b.map(c=>c.priority))||idA.localeCompare(idB));
 for(const [studentId,candidates] of plans){
  const anchors=n.lessons.flatMap(lesson=>{
   if(studentForLesson(n,lesson)?.id!==studentId)return [];
   const slot=n.slots.find(item=>item.id===lesson.slot);
   if(!slot||!(lesson.originalDate||slot.date).startsWith(month))return [];
   return [{...slot,date:slot.date.startsWith(month)?slot.date:lesson.originalDate!}];
  });
  const selected=chooseMonthlyPair(n,candidates,2-(monthlyCounts.get(studentId)||0),anchors);
  for(const {slot,lesson} of selected){
   if(!n.slots.some(item=>item.id===slot.id)){n.slots.push(slot);createdSlots++;}
   n.lessons.push({...lesson,id:crypto.randomUUID()});count++;
  }
  skipped+=new Set(candidates.map(candidate=>candidate.lesson.occurrence)).size-selected.length;
 }
 const scope=n.slots.filter(slot=>slot.room===room&&slot.date.startsWith(month)).map(slot=>slot.id),trial=options.skipAssignment?{state:n}:autoAssign(n,scope,'rebuild',{now:options.now});
 const shortages=n.slots.filter(slot=>scope.includes(slot.id)).map(slot=>({slot,count:trial.state.lessons.filter(l=>l.slot===slot.id&&!l.absent&&!l.teacher).length})).filter(item=>item.count>0).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.start.localeCompare(b.slot.start));
 return {state:n,count,createdSlots,skipped,inactive,shortages};
}

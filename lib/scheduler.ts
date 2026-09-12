import {buildTeachingPlan} from './teaching-plan';
import {balanceMonthlyWorkload} from './monthly-balance';
import {lessonPreferencePriority,comparePreferencePriority} from './preference-priority';
import {hasWorkAssignment} from './work-assignments';
import {studentForLesson,statusAt} from './students';
export type Slot={id:string;room:string;date:string;start:string;end:string;source?:string};
export type LessonRequest={kind:string;reason:string;preferredSlots:string[];message?:string};
export type Lesson={id:string;studentId?:string;slot:string;name:string;course:string;note:string;teacher:string;exam:boolean;absent:boolean;occurrence?:string;originalDate?:string;request?:string;requestRestore?:{teacher:string};requestData?:LessonRequest};
export type Preference={priority?:number;alternatives?:{weekday:number;start:string;end:string}[];id:string;studentId?:string;name:string;course:string;room:string;weekday:number;weeks:number[];start:string;end:string;source?:string;reviewNote?:string;anchor?:string;frequency?:"weekly"|"biweekly"|"monthly";until?:string};
export type EnrollmentPeriod={id:string;status:"active"|"paused"|"withdrawn";from:string;until:string};
export type Student={id:string;name:string;birthDate?:string;progressSheetUrl?:string;ownsComputer?:boolean;room:string;course:string;monthlyLessons:2|4;periods:EnrollmentPeriod[];reviewed:boolean};
export type Teacher={adminRooms?:string[];id?:string;name:string;email?:string;autoAttendance?:boolean;autoAssignLessons?:boolean;canSuperviseExam?:boolean;max:number;curricula?:string[];rooms?:string[]};
export type ConfigPeriod={id:string;order:number;start:string;end:string};
export type CampusSchedule={room:string;weekday:number;periods:ConfigPeriod[]};
export type SettingsData={lineVisibleAccounts?:string[];lineSnippets?:import('./line-snippets').LineSnippet[];lineEmojis?:string[];sidebarLinks?:import('./sidebar-links').SidebarLink[];curriculumAbbreviations?:Record<string,string>;curricula:string[];campuses:string[];schedules:CampusSchedule[];closeOnHolidays?:Record<string,boolean>};
export type AssignmentMode='fill'|'rebuild';
export type State={workAssignments?:import('./work-assignments').WorkAssignment[];settings?:SettingsData;students?:Student[];preferences?:Preference[];slots:Slot[];lessons:Lesson[];teachers:Teacher[];availability:Record<string,string>;duty:Record<string,boolean>;history:{at:string;text:string;rooms?:string[]}[]};
export const key=(t:string,s:string)=>t+'|'+s;
export const overlaps=(a:Slot,b:Slot)=>a.date===b.date&&a.start<b.end&&b.start<a.end;
export function runs(slots:Slot[],chosen:string[]){const sorted=[...slots].sort((a,b)=>a.start.localeCompare(b.start));const result:Slot[][]=[];let run:Slot[]=[];for(const s of sorted){if(chosen.includes(s.id))run.push(s);else if(run.length){result.push(run);run=[]}}if(run.length)result.push(run);return result;}
export function issues(s:State){const result:{slot:string;text:string}[]=[];const active=s.lessons.filter(l=>!l.absent);
 for(const l of active){const slot=s.slots.find(x=>x.id===l.slot);if(!slot)continue;const student=studentForLesson(s,l);if(student&&statusAt(student,slot.date)!=='active')result.push({slot:l.slot,text:l.name+'：在籍期間と授業予定を確認（休会・退会・有効期間外）'});if(!l.teacher){result.push({slot:l.slot,text:l.name+'：担当未定'});continue;}const teacher=s.teachers.find(t=>t.name===l.teacher);if(l.exam&&!teacher?.canSuperviseExam)result.push({slot:l.slot,text:l.name+'：検定本番は検定対応可のスタッフが担当'});if(hasWorkAssignment(s,l.teacher,l.slot))result.push({slot:l.slot,text:l.teacher+'：固定業務と授業が重複'});if(!teacher?.rooms?.includes(slot.room))result.push({slot:l.slot,text:l.teacher+'：担当教室外'});if(!teacher?.curricula?.includes(l.course))result.push({slot:l.slot,text:l.teacher+'：担当カリキュラム外'});if(s.availability[key(l.teacher,l.slot)]==='no')result.push({slot:l.slot,text:l.teacher+'：出勤不可のコマに割り当てられています'});else if(!s.availability[key(l.teacher,l.slot)])result.push({slot:l.slot,text:l.teacher+'：出勤可能時間を要確認'});}
 for(const work of s.workAssignments||[]){const teacher=s.teachers.find(t=>t.id===work.teacherId);if(teacher&&s.availability[key(teacher.name,work.slot)]==='no')result.push({slot:work.slot,text:teacher.name+'：固定業務「'+work.title+'」の時間が出勤不可です'})}
 for(const t of s.teachers){const duty=s.slots.filter(sl=>hasWorkAssignment(s,t.name,sl.id)||s.duty[key(t.name,sl.id)]||active.some(l=>l.slot===sl.id&&l.teacher===t.name));
  for(const sl of duty){if(active.filter(l=>l.slot===sl.id&&l.teacher===t.name).length>t.max)result.push({slot:sl.id,text:t.name+'：担当人数が上限超過'});if(duty.some(o=>o.id!==sl.id&&overlaps(o,sl)))result.push({slot:sl.id,text:t.name+'：別枠・別教室と時間重複'});}
  const teaching=duty.filter(sl=>active.some(l=>l.slot===sl.id&&l.teacher===t.name));
  for(const group of [...new Set(teaching.map(sl=>sl.room+'|'+sl.date))]){const all=s.slots.filter(sl=>sl.room+'|'+sl.date===group);for(const run of runs(all,teaching.map(sl=>sl.id))){const weekday=new Date(run[0].date+'T12:00:00').getDay();if((run.length<2&&![3,5].includes(weekday))||run.length>4)result.push({slot:run[0].id,text:t.name+'：連続'+run.length+'コマ（'+([3,5].includes(weekday)?'1':'2')+'〜4コマに調整）'});}}
 }
 for(let i=0;i<active.length;i++){const a=active[i];const sa=s.slots.find(x=>x.id===a.slot);if(sa&&active.slice(i+1).some(b=>b.name===a.name&&s.slots.some(sb=>sb.id===b.slot&&overlaps(sa,sb))))result.push({slot:a.slot,text:a.name+'：生徒の予約時間が重複'});}
 return result.filter((x,i,a)=>a.findIndex(y=>y.slot===x.slot&&y.text===x.text)===i);
}
export function monthAssignmentScope(state:State,room:string,month:string,now=new Date()){
 const today=now.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 return state.slots.filter(slot=>slot.room===room&&slot.date.startsWith(month)&&slot.date>=today).map(slot=>slot.id);
}
export function autoAssign(state:State,scope:string[],mode:AssignmentMode='rebuild',options:{balanceMonth?:boolean}={}){const s=structuredClone(state);const selected=s.slots.filter(sl=>scope.includes(sl.id));const excluded=new Set(s.teachers.filter(t=>t.autoAssignLessons===false).map(t=>t.name));if(mode==='rebuild'){s.lessons.forEach(l=>{if(scope.includes(l.slot))l.teacher=''});for(const k of Object.keys(s.duty)){if(scope.some(id=>k.endsWith('|'+id)))delete s.duty[k];}}
 // Existing lessons count as scheduled even if their derived duty flag is absent.
 const scheduled=(name:string,id:string)=>s.duty[key(name,id)]||s.lessons.some(l=>l.slot===id&&!l.absent&&l.teacher===name);
 const rank=(lesson:Lesson)=>{const slot=s.slots.find(item=>item.id===lesson.slot);return slot?lessonPreferencePriority(s,lesson,slot):null};
 const preferredFirst=(a:Lesson,b:Lesson)=>comparePreferencePriority(rank(a),rank(b));
 const eligible=(l:Lesson)=>{const st=studentForLesson(s,l);const sl=s.slots.find(x=>x.id===l.slot);return !st||!sl||statusAt(st,sl.date)==='active'};
 const canTeach=(t:Teacher,l:Lesson,room:string)=>t.autoAssignLessons!==false&&!!t.rooms?.includes(room)&&!!t.curricula?.includes(l.course)&&(!l.exam||t.canSuperviseExam===true);
 const count=(t:string,id:string)=>s.lessons.filter(l=>l.slot===id&&!l.absent&&l.teacher===t).length;
 const available=(t:string,sl:Slot)=>!hasWorkAssignment(s,t,sl.id)&&['yes','reserve'].includes(s.availability[key(t,sl.id)])&&!s.slots.some(other=>other.id!==sl.id&&overlaps(sl,other)&&(hasWorkAssignment(s,t,other.id)||s.duty[key(t,other.id)]||s.lessons.some(l=>!l.absent&&l.teacher===t&&l.slot===other.id)));
 const reasons:Record<string,string>={};
 for(const group of [...new Set(selected.map(sl=>sl.room+'|'+sl.date))]){const day=selected.filter(sl=>sl.room+'|'+sl.date===group).sort((a,b)=>a.start.localeCompare(b.start));const weekday=new Date(day[0].date+'T12:00:00').getDay();
  // Pick valid contiguous teaching blocks for all eligible staff.
  for(let iteration=0;iteration<s.teachers.length*day.length;iteration++){let best:{t:string;block:Slot[];score:number;priority:number}|null=null;
   for(const t of s.teachers.filter(t=>t.autoAssignLessons!==false&&t.rooms?.includes(day[0].room))){for(let start=0;start<day.length;start++)for(let len=([3,5].includes(weekday)?1:2);len<=4&&start+len<=day.length;len++){const block=day.slice(start,start+len);if(!block.every(sl=>available(t.name,sl)))continue;const allChosen=day.filter(sl=>scheduled(t.name,sl.id)||block.some(b=>b.id===sl.id));if(runs(day,allChosen.map(x=>x.id)).some(r=>r.length>4))continue;
    const needs=block.map(sl=>Math.min(t.max-count(t.name,sl.id),s.lessons.filter(l=>l.slot===sl.id&&!l.absent&&!l.teacher&&eligible(l)&&canTeach(t,l,sl.room)).length));if(needs.some((n,i)=>n<=0&&!scheduled(t.name,block[i].id)))continue;
    const total=needs.reduce((a,b)=>a+b,0);if(total<=0)continue;const score=total*100-len*2-block.filter(sl=>s.availability[key(t.name,sl.id)]==='reserve').length*20;
    const priority=block.reduce((sum,sl)=>sum+s.lessons.filter(l=>l.slot===sl.id&&!l.absent&&!l.teacher&&eligible(l)&&canTeach(t,l,sl.room)).sort((a,b)=>Number(b.exam)-Number(a.exam)||preferredFirst(a,b)).slice(0,Math.max(0,t.max-count(t.name,sl.id))).reduce((value,l)=>value+13-(rank(l)??13),0),0);
    if(!best||score>best.score||score===best.score&&priority>best.priority)best={t:t.name,block,score,priority};
   }}
   if(!best)break;const t=s.teachers.find(t=>t.name===best!.t)!;for(const sl of best.block){s.duty[key(t.name,sl.id)]=true;for(const l of s.lessons.filter(l=>l.slot===sl.id&&!l.absent&&!l.teacher&&eligible(l)&&canTeach(t,l,sl.room)).sort((a,b)=>Number(b.exam)-Number(a.exam)||preferredFirst(a,b))){if(count(t.name,sl.id)>=t.max)break;l.teacher=t.name;reasons[l.id]=mode==='fill'?'既存の担当を維持し、出勤・担当上限・連続勤務の条件に合う講師へ追加':`連続${best.block.length}コマの勤務と担当上限を満たす講師へ再配分`;}}
  }

 }
 // Revisit greedy blocks when coverage is incomplete. Only rebuild may move
 // existing lessons; fill continues to preserve every existing assignment.
 if(mode==='rebuild')for(const group of [...new Set(selected.map(sl=>sl.room+'|'+sl.date))]){
  const day=s.slots.filter(sl=>sl.room+'|'+sl.date===group).sort((a,b)=>a.start.localeCompare(b.start));
  const minimum=[3,5].includes(new Date(day[0].date+'T12:00:00').getDay())?1:2;
  const lessons=s.lessons.filter(l=>!l.absent&&day.some(sl=>sl.id===l.slot));
  for(;;){
   if(!lessons.some(l=>!l.teacher&&eligible(l)))break;
   let best:{changes:Map<Lesson,string>;gain:number}|undefined;
   for(const t of s.teachers.filter(t=>t.autoAssignLessons!==false)){
    for(let start=0;start<day.length;start++)for(let length=minimum;length<=4&&start+length<=day.length;length++){
     const block=day.slice(start,start+length);
     if(!block.every(sl=>scope.includes(sl.id)&&available(t.name,sl)))continue;
     const changes=new Map<Lesson,string>();
     for(const sl of block){
      const missing=lessons.filter(l=>l.slot===sl.id&&!l.teacher&&eligible(l)&&canTeach(t,l,sl.room))
       .sort((a,b)=>Number(b.exam)-Number(a.exam)||preferredFirst(a,b));
      for(const l of missing.slice(0,Math.max(0,t.max-count(t.name,sl.id))))changes.set(l,t.name);
     }
     const gain=changes.size;
     if(!gain||best&&gain<=best.gain)continue;
     const teacherOf=(l:Lesson)=>changes.get(l)??l.teacher;
     const empty=block.filter(sl=>!lessons.some(l=>l.slot===sl.id&&teacherOf(l)===t.name));
     let budget=256;
     const complete=(index:number):boolean=>{
      if(--budget<0)return false;
      if(index===empty.length){
       const affected=new Set([t.name,...[...changes.keys()].map(l=>l.teacher).filter(Boolean)]);
       for(const name of affected){
        const chosen=day.filter(sl=>lessons.some(l=>l.slot===sl.id&&teacherOf(l)===name)).map(sl=>sl.id);
        if(runs(day,chosen).some(run=>run.length<minimum||run.length>4))return false;
       }
       return true;
      }
      const sl=empty[index];
      for(const donor of s.teachers.filter(other=>other.name!==t.name&&other.autoAssignLessons!==false)){
       const owned=lessons.filter(l=>l.slot===sl.id&&teacherOf(l)===donor.name);
       const movable=owned.filter(l=>eligible(l)&&canTeach(t,l,sl.room));
       // Try shortening the donor's block before merely sharing this slot.
       const options:Lesson[][]=[];
       if(owned.length&&owned.length<=t.max&&movable.length===owned.length)options.push(owned);
       options.push(...movable.map(l=>[l]));
       for(const option of options){
        for(const l of option)changes.set(l,t.name);
        if(complete(index+1))return true;
        for(const l of option)changes.delete(l);
       }
      }
      return false;
     };
     if(complete(0))best={changes:new Map(changes),gain};
    }
   }
   if(!best)break;
   const affected=new Set<string>();
   for(const [lesson,name] of best.changes){
    if(lesson.teacher)affected.add(lesson.teacher);
    affected.add(name);lesson.teacher=name;
    reasons[lesson.id]='未割り当てを減らすため、連続勤務の条件を保って勤務コマと担当を再調整';
   }
   for(const name of affected)for(const sl of day.filter(sl=>scope.includes(sl.id))){
    if(count(name,sl.id)>0)s.duty[key(name,sl.id)]=true;
    else delete s.duty[key(name,sl.id)];
   }
  }
 }
 if(mode==='rebuild')buildTeachingPlan(s,scope,reasons);
 // A rebuilt reference keeps monthly targets independent of previous balance
 // proposals, even when a mixed-subject redistribution adds a staffed period.
 const balanceReference=mode==='rebuild'&&options.balanceMonth?structuredClone(s):undefined;
 // Daily rebuilds may retain a valid plan with equivalent coverage.
 // Monthly reconstruction must not depend on the existing teaching plan.
 // Rebuilding is still available for shortages and invalid teaching conditions,
 // but equal coverage is not a reason to churn valid existing assignments.
 if(mode==='rebuild'&&!options.balanceMonth){
  const retainInput=structuredClone(state);
  for(const lesson of retainInput.lessons)if(scope.includes(lesson.slot)&&excluded.has(lesson.teacher))lesson.teacher='';
  const retained=autoAssign(retainInput,scope,'fill').state;
  for(const group of [...new Set(selected.map(sl=>sl.room+'|'+sl.date))]){
   const ids=new Set(selected.filter(sl=>sl.room+'|'+sl.date===group).map(sl=>sl.id));
   const active=(candidate:State)=>candidate.lessons.filter(l=>ids.has(l.slot)&&!l.absent);
   const covered=(candidate:State)=>active(candidate).filter(l=>l.teacher).length;
   const changed=(candidate:State)=>active(candidate).filter(l=>l.teacher!==state.lessons.find(old=>old.id===l.id)?.teacher).length;
   const priority=(candidate:State)=>active(candidate).filter(l=>l.teacher).reduce((sum,l)=>sum+(l.exam?10000:0)+13-(rank(l)??13),0);
   if(covered(retained)<covered(s)||covered(retained)===covered(s)&&(priority(retained)<priority(s)||priority(retained)===priority(s)&&changed(retained)>=changed(s)))continue;
   const candidate=structuredClone(s);
   for(const lesson of candidate.lessons)if(ids.has(lesson.slot))lesson.teacher=retained.lessons.find(l=>l.id===lesson.id)!.teacher;
   for(const k of Object.keys(candidate.duty))if([...ids].some(id=>k.endsWith('|'+id)))delete candidate.duty[k];
   for(const [k,value] of Object.entries(retained.duty))if([...ids].some(id=>k.endsWith('|'+id)))candidate.duty[k]=value;
   // Check against the merged plan, including simultaneous work in other rooms.
   // Automatic-assignment exclusions apply to the rebuilt proposal as well.
   const valid=active(candidate).every(l=>!l.teacher||candidate.teachers.some(t=>t.name===l.teacher))&&candidate.teachers.filter(t=>!excluded.has(t.name)).every(t=>{
    const teaching=candidate.lessons.filter(l=>!l.absent&&l.teacher===t.name);
    const occupied=candidate.slots.filter(sl=>teaching.some(l=>l.slot===sl.id)||candidate.duty[key(t.name,sl.id)]||hasWorkAssignment(candidate,t.name,sl.id));
    for(const sl of candidate.slots.filter(sl=>ids.has(sl.id)&&teaching.some(l=>l.slot===sl.id))){
     const at=teaching.filter(l=>l.slot===sl.id);
     if(!['yes','reserve'].includes(candidate.availability[key(t.name,sl.id)])||hasWorkAssignment(candidate,t.name,sl.id)||at.length>t.max||at.some(l=>!eligible(l)||!canTeach(t,l,sl.room)))return false;
     if(occupied.some(other=>other.id!==sl.id&&overlaps(other,sl)))return false;
    }
    const day=candidate.slots.filter(sl=>sl.room+'|'+sl.date===group);
    const minimum=[3,5].includes(new Date(day[0].date+'T12:00:00').getDay())?1:2;
    return !runs(day,teaching.map(l=>l.slot)).some(run=>run.length<minimum||run.length>4);
   });
   if(!valid)continue;
   for(const lesson of s.lessons)if(ids.has(lesson.slot)){
    lesson.teacher=candidate.lessons.find(l=>l.id===lesson.id)!.teacher;
    reasons[lesson.id]='条件を満たす既存の担当を維持し、担当未定の授業へ追加';
   }
   s.duty=candidate.duty;
  }
 }
 const workload=mode==='rebuild'&&options.balanceMonth?balanceMonthlyWorkload(state,s,scope,reasons,balanceReference):undefined;
 for(const lesson of s.lessons){
  const before=state.lessons.find(item=>item.id===lesson.id);
  if(!scope.includes(lesson.slot)||(before?.teacher||'')===(lesson.teacher||'')){delete reasons[lesson.id];continue;}
  const slot=s.slots.find(item=>item.id===lesson.slot)!;
  if(!lesson.teacher){reasons[lesson.id]=!eligible(lesson)?'在籍期間外のため、担当を解除':'担当条件・出勤希望・人数上限・連続勤務の条件を満たす割り当てが、この案では見つからないため担当未定';continue;}
  const old=state.teachers.find(item=>item.name===before?.teacher);
  let cause='';
  if(!before?.teacher)cause='担当未定の授業に担当を設定';
  else if(!old)cause='元の担当者が講師一覧にいないため変更';
  else if(old.autoAssignLessons===false)cause='元の担当者が授業の自動割り当て対象外のため変更';
  else if(lesson.exam&&!old.canSuperviseExam)cause='元の担当者が検定対応可に設定されていないため変更';
  else if(!canTeach(old,lesson,slot.room))cause='元の担当者が担当教室・カリキュラムの条件を満たさないため変更';
  else if(hasWorkAssignment(state,old.name,slot.id))cause='元の担当者には固定業務があるため変更';
  else if(!['yes','reserve'].includes(state.availability[key(old.name,slot.id)]))cause=state.availability[key(old.name,slot.id)]==='no'?'元の担当者が出勤不可のため変更':'元の担当者の出勤希望が未入力のため変更';
  reasons[lesson.id]=[cause,reasons[lesson.id]].filter(Boolean).join('。');
 }
 return {state:s,workload,assigned:s.lessons.filter(l=>scope.includes(l.slot)&&!l.absent&&l.teacher&&(mode==='rebuild'?!excluded.has(l.teacher):!state.lessons.find(old=>old.id===l.id)?.teacher)).length,reasons};
}

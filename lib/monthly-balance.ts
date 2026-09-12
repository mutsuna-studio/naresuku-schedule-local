import {redistributeTeachingDay,matchTeachingPeriod} from './monthly-redistribution';
import type {Lesson,Slot,State,Teacher} from './scheduler';
import {hasWorkAssignment,scheduledForWork} from './work-assignments';
import {studentForLesson,statusAt} from './students';

export type MonthlyWorkload={name:string;excluded:boolean;availableDays:number;availablePeriods:number;beforeDays:number;afterDays:number;beforePeriods:number;afterPeriods:number;beforeLessons:number;afterLessons:number};
const key=(name:string,id:string)=>name+'|'+id;
const overlaps=(a:Slot,b:Slot)=>a.date===b.date&&a.start<b.end&&b.start<a.end;
const timeKey=(slot:Slot)=>slot.date+'|'+slot.start+'|'+slot.end;
const canTeach=(teacher:Teacher,lesson:Lesson,slot:Slot)=>teacher.autoAssignLessons!==false&&!!teacher.rooms?.includes(slot.room)&&!!teacher.curricula?.includes(lesson.course)&&(!lesson.exam||teacher.canSuperviseExam===true);
function validRuns(day:Slot[],chosen:Set<string>){
 const minimum=[3,5].includes(new Date(day[0].date+'T12:00:00').getDay())?1:2;
 let length=0;
 for(const slot of [...day,undefined]){
  if(slot&&chosen.has(slot.id))length++;
  else {if(length&&(length<minimum||length>4))return false;length=0;}
 }
 return true;
}

/** Balance attendance first, using pupil rematching when whole-period moves fail.
 * Coverage is unchanged. Only strictly improving, constraint-valid moves survive.
 * The bounded local search is a proposal, not a promise of a global optimum.
 */
export function balanceMonthlyWorkload(before:State,state:State,scope:string[],reasons:Record<string,string>,reference:State=state){
 const selected=new Set(scope),months=new Set(state.slots.filter(slot=>selected.has(slot.id)).map(slot=>slot.date.slice(0,7)));
 const slots=state.slots.filter(slot=>months.has(slot.date.slice(0,7))),slotById=new Map(state.slots.map(slot=>[slot.id,slot]));
 const teachers=state.teachers.filter(teacher=>teacher.autoAssignLessons!==false);
 const active=state.lessons.filter(lesson=>!lesson.absent);
 const at=new Map(state.slots.map(slot=>[slot.id,active.filter(lesson=>lesson.slot===slot.id)]));
 const days=[...new Set(slots.map(slot=>slot.room+'|'+slot.date))].map(group=>slots.filter(slot=>slot.room+'|'+slot.date===group).sort((a,b)=>a.start.localeCompare(b.start)));
 const eligible=(lesson:Lesson,slot:Slot)=>{const student=studentForLesson(state,lesson);return !student||statusAt(student,slot.date)==='active'};
 const fixed=new Map(state.teachers.map(teacher=>[teacher.name,new Set(state.slots.filter(slot=>hasWorkAssignment(state,teacher.name,slot.id)||(teacher.autoAttendance&&teacher.rooms?.includes(slot.room)&&state.availability[key(teacher.name,slot.id)]==='yes')).map(slot=>slot.id))]));
 const occupied=(name:string)=>state.slots.filter(slot=>fixed.get(name)?.has(slot.id)||state.duty[key(name,slot.id)]||at.get(slot.id)?.some(lesson=>lesson.teacher===name));
 const workload=(candidate:State,name:string)=>{
  const worked=candidate===state?occupied(name).filter(slot=>months.has(slot.date.slice(0,7))):slots.filter(slot=>scheduledForWork(candidate,name,slot.id));
  return {days:new Set(worked.map(slot=>slot.date)).size,periods:new Set(worked.map(timeKey)).size};
 };
 // Count submitted opportunities once even when the same time appears in two rooms.
 // Reserve is a fallback, and receives a quarter of the weight of a firm yes.
 const opportunities=new Map(state.teachers.map(teacher=>{
  const weights=new Map<string,number>(),dateWeights=new Map<string,number>();
  for(const day of days){
   const possible=new Set(day.filter(slot=>['yes','reserve'].includes(state.availability[key(teacher.name,slot.id)])&&!hasWorkAssignment(state,teacher.name,slot.id)&&(at.get(slot.id)||[]).some(lesson=>eligible(lesson,slot)&&canTeach(teacher,lesson,slot))).map(slot=>slot.id));
   const usable=new Set<string>();
   const minimum=[3,5].includes(new Date(day[0].date+'T12:00:00').getDay())?1:2;
   for(let start=0;start<day.length;start++)for(let length=minimum;length<=4&&start+length<=day.length;length++){
    const block=day.slice(start,start+length);if(block.every(slot=>possible.has(slot.id)))block.forEach(slot=>usable.add(slot.id));
   }
   for(const slot of day){
    const fixed=hasWorkAssignment(state,teacher.name,slot.id)||(teacher.autoAttendance&&teacher.rooms?.includes(slot.room)&&state.availability[key(teacher.name,slot.id)]==='yes');
    if(!usable.has(slot.id)&&!fixed)continue;
    const weight=fixed||state.availability[key(teacher.name,slot.id)]==='yes'?1:0.25;
    weights.set(timeKey(slot),Math.max(weights.get(timeKey(slot))||0,weight));
    dateWeights.set(slot.date,Math.max(dateWeights.get(slot.date)||0,weight));
   }
  }
  return [teacher.name,{days:[...dateWeights.values()].reduce((a,b)=>a+b,0),periods:[...weights.values()].reduce((a,b)=>a+b,0),availableDays:dateWeights.size,availablePeriods:weights.size,dayWeights:dateWeights,periodWeights:weights}];
 }));
 // Work with no eligible replacement is not discretionary load. In particular,
 // sole-cover weekday work must not consume a specialist's weekend fair share.
 const required=new Map(teachers.map(teacher=>[teacher.name,new Set(slots.filter(slot=>fixed.get(teacher.name)!.has(slot.id)).map(slot=>slot.id))]));
 for(const slot of slots){
  const pupils=(at.get(slot.id)||[]).filter(lesson=>eligible(lesson,slot)&&teachers.some(teacher=>teacher.name===lesson.teacher));
  const available=teachers.filter(teacher=>teacher.max>0&&['yes','reserve'].includes(state.availability[key(teacher.name,slot.id)])&&!hasWorkAssignment(state,teacher.name,slot.id)&&!occupied(teacher.name).some(other=>other.id!==slot.id&&overlaps(other,slot)&&(fixed.get(teacher.name)!.has(other.id)||!selected.has(other.id))));
  for(const lesson of pupils){const choices=available.filter(teacher=>canTeach(teacher,lesson,slot));if(choices.length===1)required.get(choices[0].name)!.add(slot.id);}
 }
 const requiredDays=new Map(teachers.map(teacher=>[teacher.name,new Set(slots.filter(slot=>required.get(teacher.name)!.has(slot.id)).map(slot=>slot.date))]));
 const adjustable=(candidate:State,name:string)=>{
  const worked=slots.filter(slot=>scheduledForWork(candidate,name,slot.id));
  return {days:new Set(worked.filter(slot=>!requiredDays.get(name)!.has(slot.date)).map(slot=>slot.date)).size,periods:new Set(worked.filter(slot=>!required.get(name)!.has(slot.id)).map(timeKey)).size};
 };
 for(const teacher of teachers){
  const value=opportunities.get(teacher.name)!,requiredTimes=new Set(slots.filter(slot=>required.get(teacher.name)!.has(slot.id)).map(timeKey));
  value.days=[...value.dayWeights].filter(([date])=>!requiredDays.get(teacher.name)!.has(date)).reduce((sum,[,weight])=>sum+weight,0);
  value.periods=[...value.periodWeights].filter(([time])=>!requiredTimes.has(time)).reduce((sum,[,weight])=>sum+weight,0);
 }
 const initial=new Map(teachers.map(teacher=>[teacher.name,adjustable(reference,teacher.name)]));
 const totals=[...initial.values()].reduce((sum,value)=>({days:sum.days+value.days,periods:sum.periods+value.periods}),{days:0,periods:0});
 const weightTotals=teachers.reduce((sum,teacher)=>{const value=opportunities.get(teacher.name)!;return {days:sum.days+value.days,periods:sum.periods+value.periods}},{days:0,periods:0});
 const cost=(name:string,value=adjustable(state,name))=>{
  const weight=opportunities.get(name)!;
  // Center on proportional targets. Unlike uncentered squared load, this can
  // recognize an improvement when a mixed-subject class must be split and the
  // total number of staffed periods consequently changes.
  const targetDays=totals.days*weight.days/Math.max(weightTotals.days,1),targetPeriods=totals.periods*weight.periods/Math.max(weightTotals.periods,1);
  return (value.days-targetDays)**2/Math.max(weight.days,0.25)*weightTotals.days/Math.max(totals.days**2,1)+(value.periods-targetPeriods)**2/Math.max(weight.periods,0.25)*weightTotals.periods/Math.max(totals.periods**2,1);
 };
 const costs=new Map(teachers.map(teacher=>[teacher.name,cost(teacher.name)]));
 const valid=(teacher:Teacher,touched:Slot[])=>{
  const teaching=active.filter(lesson=>lesson.teacher===teacher.name),chosen=new Set(teaching.map(lesson=>lesson.slot));
  const working=occupied(teacher.name);
  for(const slot of touched.filter(slot=>chosen.has(slot.id))){
   const lessons=at.get(slot.id)!.filter(lesson=>lesson.teacher===teacher.name);
   if(!['yes','reserve'].includes(state.availability[key(teacher.name,slot.id)])||hasWorkAssignment(state,teacher.name,slot.id)||lessons.length>teacher.max||lessons.some(lesson=>!eligible(lesson,slot)||!canTeach(teacher,lesson,slot)))return false;
   if(working.some(other=>other.id!==slot.id&&overlaps(other,slot)))return false;
  }
  return days.filter(day=>touched.some(slot=>slot.room===day[0].room&&slot.date===day[0].date)).every(day=>validRuns(day,chosen));
 };
 // A tiny numerical fairness gain is not worth disrupting a settled class.
 // Cost is normalized; charge 0.5% per changed pupil assignment. Coverage repair
 // runs before this pass and is never subject to this soft stability preference.
 const changeCost=0.005;
 const tryMove=(changes:Map<Lesson,string>,pair:Teacher[],balancePupils=false)=>{
  if(!changes.size||[...changes].some(([lesson,name])=>!selected.has(lesson.slot)||!teachers.some(t=>t.name===lesson.teacher)||!teachers.some(t=>t.name===name)))return false;
  const touched=[...new Set([...changes.keys()].map(lesson=>lesson.slot))].map(id=>slotById.get(id)!);
  const oldCost=pair.reduce((sum,teacher)=>sum+costs.get(teacher.name)!,0);
  const oldTeachers=new Map([...changes.keys()].map(lesson=>[lesson,lesson.teacher]));
  // Never replace firm availability with more fallback assignments for fairness.
  const reserveCount=()=>touched.reduce((sum,slot)=>sum+pair.filter(teacher=>at.get(slot.id)!.some(lesson=>lesson.teacher===teacher.name)&&state.availability[key(teacher.name,slot.id)]==='reserve').length,0);
  const oldReserve=reserveCount();
  // Fairness must not create extra teaching shifts by splitting a class that
  // already fits its staff. The day constructor has already optimized coverage.
  const teachingPeriods=()=>touched.reduce((sum,slot)=>sum+pair.filter(teacher=>at.get(slot.id)!.some(lesson=>lesson.teacher===teacher.name)).length,0);
  const oldTeachingPeriods=teachingPeriods();
  // Do not undo the constructor's use of narrow firm-availability windows.
  // Compare within each day so sole-cover weekdays do not suppress weekends.
  const utilization=()=>days.filter(day=>touched.some(slot=>slot.room===day[0].room&&slot.date===day[0].date)).reduce((sum,day)=>sum+pair.reduce((value,teacher)=>{
   const firm=day.filter(slot=>state.availability[key(teacher.name,slot.id)]==='yes'&&!hasWorkAssignment(state,teacher.name,slot.id)&&(at.get(slot.id)||[]).some(lesson=>eligible(lesson,slot)&&canTeach(teacher,lesson,slot)));
   return value+firm.filter(slot=>at.get(slot.id)!.some(lesson=>lesson.teacher===teacher.name)).length/Math.max(1,firm.length);
  },0),0);
  const oldUtilization=utilization();
  const pupilCost=()=>touched.reduce((sum,slot)=>sum+pair.reduce((value,teacher)=>value+at.get(slot.id)!.filter(lesson=>lesson.teacher===teacher.name).length**2,0),0);
  const oldPupilCost=pupilCost();

  const dutyKeys=new Set([...changes].flatMap(([lesson,name])=>[key(lesson.teacher,lesson.slot),key(name,lesson.slot)]));
  const oldDuty=new Map([...dutyKeys].map(id=>[id,state.duty[id]]));
  for(const [lesson,name] of changes)lesson.teacher=name;
  for(const slot of touched)for(const teacher of pair){const id=key(teacher.name,slot.id);if(!dutyKeys.has(id))continue;if(at.get(slot.id)!.some(lesson=>lesson.teacher===teacher.name))state.duty[id]=true;else delete state.duty[id];}
  const improves=reserveCount()<=oldReserve&&teachingPeriods()<=oldTeachingPeriods&&utilization()>=oldUtilization-1e-9&&(balancePupils?pupilCost()<oldPupilCost:pair.reduce((sum,teacher)=>sum+cost(teacher.name),0)<oldCost-changeCost*changes.size-1e-9)&&pair.every(teacher=>valid(teacher,touched));
  if(improves){for(const teacher of pair)costs.set(teacher.name,cost(teacher.name));for(const lesson of changes.keys())reasons[lesson.id]=balancePupils?'勤務コマを変えず、担当条件を満たす範囲で同じ時間帯の児童数の偏りを調整':'月内の出勤日数・勤務コマ数を、提出された勤務可能枠に応じて調整';return true;}
  for(const [lesson,name] of oldTeachers)lesson.teacher=name;
  for(const [id,value] of oldDuty)if(value===undefined)delete state.duty[id];else state.duty[id]=value;
  return false;
 };
 const bundles=()=>days.flatMap(day=>teachers.flatMap(teacher=>{
  const result:{teacher:Teacher;lessons:Lesson[]}[]=[];
  for(let start=0;start<day.length;start++)for(let length=1;length<=4&&start+length<=day.length;length++){
   const block=day.slice(start,start+length);
   if(!block.every(slot=>selected.has(slot.id)&&at.get(slot.id)!.some(lesson=>lesson.teacher===teacher.name)))continue;
   result.push({teacher,lessons:block.flatMap(slot=>at.get(slot.id)!.filter(lesson=>lesson.teacher===teacher.name))});
  }
  return result;
 }));
 // First improvement avoids scanning every permutation after an acceptable move.
 for(let iteration=0;iteration<128;iteration++){
  const blocks=bundles();let improved=false;
  for(const block of blocks){
   for(const recipient of teachers.filter(teacher=>teacher.name!==block.teacher.name)){
    if(block.lessons.some(lesson=>!canTeach(recipient,lesson,slotById.get(lesson.slot)!)))continue;
    if(tryMove(new Map(block.lessons.map(lesson=>[lesson,recipient.name])),[block.teacher,recipient])){improved=true;break;}
   }
   if(improved)break;
  }
  if(improved)continue;
  // A short/long block exchange can improve period balance when neither teacher
  // can give up a day outright. Bound the search even for unusually large months.
  let attempts=0;
  for(let i=0;i<blocks.length&&!improved&&attempts<4000;i++)for(let j=i+1;j<blocks.length&&attempts<4000;j++){
   const a=blocks[i],b=blocks[j];if(a.teacher.name===b.teacher.name||a.lessons.some(lesson=>b.lessons.some(other=>other.slot===lesson.slot)))continue;
   if(a.lessons.some(lesson=>!canTeach(b.teacher,lesson,slotById.get(lesson.slot)!))||b.lessons.some(lesson=>!canTeach(a.teacher,lesson,slotById.get(lesson.slot)!)))continue;
   attempts++;
   if(tryMove(new Map([...a.lessons.map(lesson=>[lesson,b.teacher.name] as const),...b.lessons.map(lesson=>[lesson,a.teacher.name] as const)]),[a.teacher,b.teacher])){improved=true;break;}
  }
  if(!improved)for(const day of days.filter(day=>day.some(slot=>selected.has(slot.id)))){
   const dayIds=new Set(day.map(slot=>slot.id)),dayLessons=active.filter(lesson=>dayIds.has(lesson.slot));
   improved=redistributeTeachingDay({day,teachers,lessons:dayLessons,selected,
    canTeach:(teacher,lesson,slot)=>eligible(lesson,slot)&&canTeach(teacher,lesson,slot),
    canAttend:(teacher,slot)=>teacher.max>0&&['yes','reserve'].includes(state.availability[key(teacher.name,slot.id)])&&!hasWorkAssignment(state,teacher.name,slot.id)&&!occupied(teacher.name).some(other=>!dayIds.has(other.id)&&overlaps(other,slot)),
    validPattern:ids=>validRuns(day,ids),
    patternCost:(teacher,ids)=>{
     const working=occupied(teacher.name).filter(slot=>months.has(slot.date.slice(0,7))&&(!dayIds.has(slot.id)||fixed.get(teacher.name)!.has(slot.id)||ids.has(slot.id)||(!dayLessons.some(lesson=>lesson.teacher===teacher.name&&lesson.slot===slot.id)&&state.duty[key(teacher.name,slot.id)])));
     for(const slot of day)if(ids.has(slot.id)&&!working.some(other=>other.id===slot.id))working.push(slot);
     return cost(teacher.name,{days:new Set(working.filter(slot=>!requiredDays.get(teacher.name)!.has(slot.date)).map(slot=>slot.date)).size,periods:new Set(working.filter(slot=>!required.get(teacher.name)!.has(slot.id)).map(timeKey)).size});
    },apply:tryMove,
   });
   if(improved)break;
  }
  if(!improved)break;
 }
 // Match pupils within the existing attendance pattern as a separate step.
 // This can fix 3:1 -> 2:2 without adding a shift or touching excluded teachers.
 for(const slot of slots.filter(slot=>selected.has(slot.id))){
  const pupils=at.get(slot.id)!.filter(lesson=>teachers.some(teacher=>teacher.name===lesson.teacher));
  const working=teachers.filter(teacher=>pupils.some(lesson=>lesson.teacher===teacher.name));
  const assignment=matchTeachingPeriod(pupils,working,(teacher,lesson)=>eligible(lesson,slot)&&canTeach(teacher,lesson,slot));
  if(!assignment)continue;
  const changes=new Map([...assignment].filter(([lesson,name])=>name!==lesson.teacher));
  tryMove(changes,working,true);
 }
 return state.teachers.map(teacher=>{
  const old=workload(before,teacher.name),next=workload(state,teacher.name),available=opportunities.get(teacher.name)!;
  return {name:teacher.name,excluded:teacher.autoAssignLessons===false,availableDays:available.availableDays,availablePeriods:available.availablePeriods,beforeDays:old.days,afterDays:next.days,beforePeriods:old.periods,afterPeriods:next.periods,beforeLessons:before.lessons.filter(lesson=>!lesson.absent&&lesson.teacher===teacher.name&&months.has(slotById.get(lesson.slot)?.date.slice(0,7)||'')).length,afterLessons:active.filter(lesson=>lesson.teacher===teacher.name&&months.has(slotById.get(lesson.slot)?.date.slice(0,7)||'')).length};
 });
}

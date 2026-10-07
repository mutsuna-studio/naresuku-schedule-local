import {autoAssign,monthAssignmentScope,type State,type Lesson} from './scheduler';
import {generate} from './recurrence';
import {studentForLesson,studentForPreference} from './students';
import {studentScheduleDatesLocked,studentScheduleStatus} from './student-schedule-status';
import {scheduledForWork} from './work-assignments';
import {staffingLoad} from './staff-capacity';
import {lessonPreferencePriority} from './preference-priority';
import {rhythmCost} from './monthly-student-placement';

/** Bounded joint search: compare actual staffing for retained and rebuilt dates,
 * then try alternatives for students left without a teacher. Never create slots. */
export function optimizeMonth(state:State,month:string,room:string,now=new Date()){
 const scope=monthAssignmentScope(state,room,month,now),selected=new Set(scope);
 const slots=new Map(state.slots.map(slot=>[slot.id,slot]));
 const movable=state.lessons.filter(lesson=>{
  const student=studentForLesson(state,lesson),slot=slots.get(lesson.slot);
  return student&&slot&&selected.has(slot.id)&&!lesson.absent&&!lesson.exam&&!lesson.request&&!lesson.requestData&&!lesson.requestRestore
   &&lesson.course===student.course&&lesson.occurrence&&(!lesson.originalDate||lesson.originalDate===slot.date)
   &&['通塾希望から作成','通塾希望の候補から作成'].includes(lesson.note)
   &&!studentScheduleDatesLocked(student,month)&&!studentScheduleStatus(state,student,month).pending
   &&state.preferences?.some(p=>p.id===lesson.occurrence!.split('|')[0]&&studentForPreference(state,p)?.id===student.id);
 });
 const movableIds=new Set(movable.map(lesson=>lesson.id));
 function build(rebuild:boolean,blocked?:Map<string,Set<string>>){
  const base=structuredClone(state);
  // Remove derived duties before measuring available capacity; fixed work stays intact.
  for(const lesson of base.lessons)if(selected.has(lesson.slot))lesson.teacher='';
  for(const key of Object.keys(base.duty))if(scope.some(id=>key.endsWith('|'+id)))delete base.duty[key];
  if(rebuild)base.lessons=base.lessons.filter(lesson=>!movableIds.has(lesson.id));
  const next=generate(base,month,room,{existingSlotsOnly:true,scope,blocked,skipAssignment:true,now}).state;
  if(rebuild)for(const studentId of new Set(movable.map(lesson=>studentForLesson(state,lesson)!.id))){
   const old=movable.filter(lesson=>studentForLesson(state,lesson)!.id===studentId);
   const added=next.lessons.filter(lesson=>!base.lessons.some(item=>item.id===lesson.id)&&lesson.studentId===studentId);
   // Changed preferences or unavailable slots must never silently delete lessons.
   if(added.length<old.length){next.lessons=next.lessons.filter(lesson=>!added.includes(lesson));next.lessons.push(...old.map(lesson=>({...lesson,teacher:''})));continue;}
   const unused=[...old];
   for(const lesson of added){const index=Math.max(0,unused.findIndex(item=>item.slot===lesson.slot));const previous=unused.splice(index,1)[0];if(previous)lesson.id=previous.id;}
  }
  // Keep the existing teacher as the solver's continuity reference.
  // It still clears and validates assignments in rebuild mode.
  for(const lesson of next.lessons){const previous=state.lessons.find(item=>item.id===lesson.id);if(previous)lesson.teacher=previous.teacher;}
  next.duty=structuredClone(state.duty);
  return autoAssign(next,scope,'rebuild',{balanceMonth:true,now});
 }
 function score(candidate:State){
  const lessons=candidate.lessons.filter(lesson=>selected.has(lesson.slot)&&!lesson.absent);
  let rhythm=0;
  for(const student of state.students||[])if(student.room===room&&student.monthlyLessons===2){
   const dates=candidate.lessons.filter(lesson=>studentForLesson(candidate,lesson)?.id===student.id&&(lesson.originalDate||slots.get(lesson.slot)?.date||'').startsWith(month)).map(lesson=>slots.get(lesson.slot)).filter(slot=>!!slot);
   if(dates.length===2)rhythm+=rhythmCost(dates[0],dates[1]);
  }
  const priority=lessons.reduce((sum,lesson)=>sum+(lessonPreferencePriority(candidate,lesson,slots.get(lesson.slot)!)??13),0);
  // Evaluate occupied capacity without counting the same pupil twice.
  const load=lessons.reduce((sum,lesson)=>sum+staffingLoad({...candidate,lessons:candidate.lessons.filter(item=>item.id!==lesson.id)},slots.get(lesson.slot)!,lesson),0);
  return [-lessons.length,lessons.filter(lesson=>!lesson.teacher).length,rhythm,priority,load];
 }
 let best=build(false),bestScore=score(best.state);
 function consider(candidate:typeof best){const values=score(candidate.state),index=values.findIndex((value,i)=>value!==bestScore[i]);if(index>=0&&values[index]<bestScore[index]){best=candidate;bestScore=values;}}
 consider(build(true));
 const blocked=new Map<string,Set<string>>();
 for(let attempt=0;attempt<3;attempt++){
  const missing=best.state.lessons.find(lesson=>selected.has(lesson.slot)&&!lesson.absent&&!lesson.teacher&&lesson.studentId&&(!state.lessons.some(old=>old.id===lesson.id)||movableIds.has(lesson.id))&&!blocked.get(lesson.studentId)?.has(lesson.slot));
  if(!missing?.studentId)break;
  const excluded=blocked.get(missing.studentId)||new Set<string>();excluded.add(missing.slot);blocked.set(missing.studentId,excluded);
  consider(build(true,blocked));
 }
 // Preview the workload against the user's input, not the temporary unassigned plan.
 for(const row of best.workload||[]){
  const worked=state.slots.filter(slot=>slot.date.startsWith(month)&&scheduledForWork(state,row.name,slot.id));
  row.beforeDays=new Set(worked.map(slot=>slot.date)).size;
  row.beforePeriods=new Set(worked.map(slot=>slot.date+'|'+slot.start+'|'+slot.end)).size;
  row.beforeLessons=state.lessons.filter(lesson=>!lesson.absent&&lesson.teacher===row.name&&slots.get(lesson.slot)?.date.startsWith(month)).length;
 }
 const previous=new Map(state.lessons.map(lesson=>[lesson.id,lesson]));
 const changes=best.state.lessons.flatMap(lesson=>{
  const before=previous.get(lesson.id);
  return !before||before.slot!==lesson.slot?[{lesson,before:before as Lesson|undefined}]:[];
 });
 const unmet=(state.students||[]).filter(student=>student.room===room).flatMap(student=>{const status=studentScheduleStatus(best.state,student,month);return status.status!=='outside'&&status.placed<status.target?[{name:student.name,count:status.target-status.placed}]:[];});
 return {...best,scope,changes,unmet,added:changes.filter(change=>!change.before).length,moved:changes.filter(change=>!!change.before).length};
}

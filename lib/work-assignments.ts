import type {State,Slot} from './scheduler';

export type WorkAssignment={id:string;teacherId:string;slot:string;title:string};
const overlap=(a:Slot,b:Slot)=>a.date===b.date&&a.start<b.end&&b.start<a.end;
export function workAt(state:State,teacherName:string,slotId:string){
 const teacher=state.teachers.find(item=>item.name===teacherName);
 return (state.workAssignments||[]).filter(item=>item.teacherId===teacher?.id&&item.slot===slotId);
}
export function hasWorkAssignment(state:State,teacherName:string,slotId:string){return workAt(state,teacherName,slotId).length>0}
export function workConflict(state:State,teacherName:string,slot:Slot){
 const teacher=state.teachers.find(item=>item.name===teacherName);
 return (state.workAssignments||[]).find(item=>item.teacherId===teacher?.id&&state.slots.some(other=>other.id===item.slot&&overlap(slot,other)));
}
export function scheduledForWork(state:State,teacherName:string,slotId:string){
 const teacher=state.teachers.find(item=>item.name===teacherName),slot=state.slots.find(item=>item.id===slotId);
 return !!slot&&!!teacher&&((teacher.autoAttendance&&teacher.rooms?.includes(slot.room)&&state.availability[teacherName+'|'+slotId]==='yes')||hasWorkAssignment(state,teacherName,slotId)||!!state.duty[teacherName+'|'+slotId]||state.lessons.some(lesson=>lesson.slot===slotId&&!lesson.absent&&lesson.teacher===teacherName));
}
export function validateWorkAssignments(state:State):string|null{
 const items=state.workAssignments;
 if(items===undefined)return null;
 if(!Array.isArray(items)||items.some(item=>!item||typeof item.id!=='string'||!item.id||typeof item.teacherId!=='string'||typeof item.slot!=='string'||typeof item.title!=='string'||!item.title.trim()||item.title.length>100)||new Set(items.map(item=>item.id)).size!==items.length)return '業務の担当者・時間帯・業務名を確認してください';
 for(const item of items){
  const teacher=state.teachers.find(teacher=>teacher.id===item.teacherId),slot=state.slots.find(slot=>slot.id===item.slot);
  if(!teacher||!slot||!teacher.rooms?.includes(slot.room))return '業務の担当教室・スタッフ・時間帯を確認してください';
  if(items.some(other=>other.id!==item.id&&other.teacherId===item.teacherId&&state.slots.some(candidate=>candidate.id===other.slot&&overlap(slot,candidate))))return '同じスタッフに業務が重複しています';
  if(state.lessons.some(lesson=>lesson.teacher===teacher.name&&!lesson.absent&&state.slots.some(candidate=>candidate.id===lesson.slot&&overlap(slot,candidate))))return '業務と授業が重複しています。授業の担当を変更してください';
 }
 return null;
}
export function lessonsReplacedByWork(state:State,item:WorkAssignment){
 const teacher=state.teachers.find(teacher=>teacher.id===item.teacherId),slot=state.slots.find(slot=>slot.id===item.slot);
 return teacher&&slot?state.lessons.filter(lesson=>lesson.teacher===teacher.name&&!lesson.absent&&state.slots.some(candidate=>candidate.id===lesson.slot&&overlap(slot,candidate))):[];
}
/** Explicitly confirming an activity releases its conflicting lessons, but never moves other activities. */
export function putWorkAssignment(state:State,item:WorkAssignment){
 const next=structuredClone(state),slot=next.slots.find(slot=>slot.id===item.slot),replaced=lessonsReplacedByWork(next,item);
 if(replaced.some(lesson=>next.slots.find(candidate=>candidate.id===lesson.slot)?.room!==slot?.room))throw Error('別の教室の授業と重複しています。時間帯を変更してください');
 next.workAssignments=[...(next.workAssignments||[]).filter(other=>other.id!==item.id),{...item,title:item.title.trim()}];
 for(const lesson of replaced){const prior=lesson.teacher;lesson.teacher='';if(!next.lessons.some(other=>other.teacher===prior&&!other.absent&&other.slot===lesson.slot))delete next.duty[prior+'|'+lesson.slot]}
 const error=validateWorkAssignments(next);if(error)throw Error(error);
 return next;
}

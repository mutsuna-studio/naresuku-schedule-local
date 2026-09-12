import {workConflict} from './work-assignments';
import type {State} from './scheduler';

/** Move an existing lesson without duplicating it or leaving stale duty entries. */
export function moveLesson(state:State,lessonId:string,slotId:string,teacherName:string,options:{allowDateChange?:boolean}={}){
 const lesson=state.lessons.find(item=>item.id===lessonId),destination=state.slots.find(slot=>slot.id===slotId);
 if(!lesson||!destination||lesson.absent)return false;
 const source=state.slots.find(slot=>slot.id===lesson.slot);
 if(!source||source.room!==destination.room||(!options.allowDateChange&&source.date!==destination.date))return false;
 if(teacherName&&workConflict(state,teacherName,destination))return false;
 if(teacherName&&!state.teachers.some(teacher=>teacher.name===teacherName))return false;
 if(lesson.slot===slotId&&lesson.teacher===teacherName)return false;
 const previousSlot=lesson.slot,previousTeacher=lesson.teacher;
 if(previousSlot!==slotId)lesson.originalDate ||= source.date;
 lesson.slot=slotId;lesson.teacher=teacherName;
 if(previousTeacher&&!state.lessons.some(item=>!item.absent&&item.slot===previousSlot&&item.teacher===previousTeacher))delete state.duty[previousTeacher+'|'+previousSlot];
 if(teacherName)state.duty[teacherName+'|'+slotId]=true;
 return true;
}

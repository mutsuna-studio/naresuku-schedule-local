import type {State} from './scheduler';

/** Cancel a pending change without moving its original slot or sending notifications. */
export function rejectRequest(state:State,lessonId:string){
 const lesson=state.lessons.find(item=>item.id===lessonId);
 if(!lesson||(!lesson.request&&!lesson.requestData)||!state.slots.some(slot=>slot.id===lesson.slot))return false;
 const restore=lesson.requestRestore;
 lesson.absent=false;
 if(restore){lesson.teacher=state.teachers.some(teacher=>teacher.name===restore.teacher)?restore.teacher:'';}
 if(lesson.teacher)state.duty[lesson.teacher+'|'+lesson.slot]=true;
 lesson.request='';delete lesson.requestData;delete lesson.requestRestore;
 return true;
}

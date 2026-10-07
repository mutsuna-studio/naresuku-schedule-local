import type {State} from './scheduler';
import {lessonNeedsAction,lessonStatus,transitionLesson} from './lesson-status';

/** Explicit cancellation never resurrects a released teacher assignment. */
export function rejectRequest(state:State,lessonId:string){
 const lesson=state.lessons.find(item=>item.id===lessonId);
 if(!lesson||!lessonNeedsAction(lesson)||!state.slots.some(slot=>slot.id===lesson.slot))return false;
 const status=lesson.transferAcceptance?'absent':lesson.requestRestore?.status==='absent'?'absent':'scheduled';
 transitionLesson(state,lesson,status);
 return true;
}
export function acknowledgeAbsenceRequest(state:State,lessonId:string){
 const lesson=state.lessons.find(item=>item.id===lessonId);
 if(!lesson||lessonStatus(lesson)!=='absence_requested')return false;
 transitionLesson(state,lesson,'absent');return true;
}

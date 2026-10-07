import type {Lesson,State} from './scheduler';
import {reopenStudentScheduleMonth} from './student-schedule-status';

export * from './lesson-state';
import {lessonStatus,lessonUsesSlot,lessonNeedsAction,releaseLessonSlot,lessonStatusLabels,type LessonStatus} from './lesson-state';

function reopen(state:State,lesson:Lesson){
 const slot=state.slots.find(slot=>slot.id===lesson.slot),student=state.students?.find(s=>lesson.studentId?s.id===lesson.studentId:s.name===lesson.name&&s.room===slot?.room);
 if(student&&slot)reopenStudentScheduleMonth(student,(lesson.originalDate||slot.date).slice(0,7));
}
export function transitionLesson(state:State,lesson:Lesson,status:LessonStatus){
 const before=lessonStatus(lesson);
 if(before!==status){const slot=state.slots.find(s=>s.id===lesson.slot);state.history=[{at:new Date().toISOString(),text:`${lesson.name}さんの${slot?.date||''} ${slot?.start||''}の授業：${lessonStatusLabels[before]} → ${lessonStatusLabels[status]}${lesson.teacher?`（変更前の担当：${lesson.teacher}）`:''}`,...(slot?{rooms:[slot.room]}:{})},...(state.history||[])].slice(0,100)}
 if(lessonNeedsAction({status})&&!lessonNeedsAction(lesson))lesson.requestRestore={teacher:lesson.teacher||'',status:before};
 if(before!==status||lessonNeedsAction({status}))reopen(state,lesson);
 lesson.status=status;lesson.absent=!lessonUsesSlot(lesson);
 if(!lessonUsesSlot(lesson))releaseLessonSlot(state,lesson);
 if(status==='scheduled'||status==='absent'){
  if(lesson.request)lesson.note=[lesson.note,`保護者申請：${lesson.request}`].filter(Boolean).join('\n');
  lesson.request='';delete lesson.requestData;delete lesson.requestRestore;delete lesson.transferAcceptance;
 }
}
export function openTransferAcceptance(state:State,lessonId:string,expiresAt:string,actor:string,now=Date.now()){
 const lesson=state.lessons.find(l=>l.id===lessonId);
 if(!lesson||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=now)throw Error('未来の受付期限を指定してください。');
 if(lessonStatus(lesson)==='transfer_requested')throw Error('届いている振替希望を先に確認してください。');
 if(lessonStatus(lesson)==='absence_requested')throw Error('欠席連絡を確認してから振替受付を開始してください。');
 const previous=lesson.transferAcceptance;
 transitionLesson(state,lesson,'transfer_waiting');
 lesson.transferAcceptance={expiresAt:new Date(expiresAt).toISOString(),openedAt:previous?.openedAt||new Date(now).toISOString(),openedBy:actor};
}
/** All transfer entry points preserve the contract month and resolve the same workflow. */
export function completeLessonTransfer(state:State,lesson:Lesson,slotId:string){
 const source=state.slots.find(s=>s.id===lesson.slot),target=state.slots.find(s=>s.id===slotId);
 if(!source||!target||source.room!==target.room||source.id===target.id)throw Error('振替先の授業枠を確認してください。');
 reopen(state,lesson);releaseLessonSlot(state,lesson);
 lesson.originalDate ||= source.date;lesson.slot=target.id;
 transitionLesson(state,lesson,'scheduled');
}
export function validLessonStatuses(state:State){
 return state.lessons.every(lesson=>{
  if(lesson.status!==undefined&&!Object.hasOwn(lessonStatusLabels,lesson.status))return false;
  if(lesson.status!==undefined&&lesson.absent===lessonUsesSlot(lesson))return false;
  const status=lessonStatus(lesson),acceptance=lesson.transferAcceptance;
  if(status==='transfer_waiting'&&!acceptance)return false;
  if(acceptance&&(typeof acceptance!=='object'||typeof acceptance.expiresAt!=='string'||typeof acceptance.openedAt!=='string'||!['transfer_waiting','transfer_requested'].includes(status)||!Number.isFinite(Date.parse(acceptance.expiresAt))||!Number.isFinite(Date.parse(acceptance.openedAt))||typeof acceptance.openedBy!=='string'||!acceptance.openedBy||acceptance.openedBy.length>200))return false;
  if(['scheduled','absent','transfer_waiting'].includes(status)&&(lesson.request||lesson.requestData))return false;
  if(status==='absence_requested'&&lesson.requestData&&lesson.requestData.kind!=='欠席')return false;
  return true;
 });
}

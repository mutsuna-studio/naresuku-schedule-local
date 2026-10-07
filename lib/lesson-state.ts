import type {Lesson,State} from './scheduler';

export const lessonStatusLabels={scheduled:'予定あり',transfer_waiting:'振替希望待ち',transfer_requested:'振替申請中',absence_requested:'欠席連絡・確認待ち',absent:'欠席確定'};
export type LessonStatus=keyof typeof lessonStatusLabels;
export type TransferAcceptance={expiresAt:string;openedAt:string;openedBy:string};
type StatusSource={status?:LessonStatus;absent?:boolean;request?:string;requestData?:{kind:string};transferAcceptance?:Pick<TransferAcceptance,'expiresAt'>};
/** Missing status is the legacy format. Once present, status is authoritative. */
export function lessonStatus(lesson:StatusSource):LessonStatus{
 if(lesson.status)return lesson.status;
 if(lesson.request||lesson.requestData)return (lesson.requestData?.kind||lesson.request?.replace(/^\*\*\d{1,2}\/\d{1,2}\*\*/,'').trim().split('｜')[0])==='欠席'?'absence_requested':'transfer_requested';
 return lesson.absent?'absent':'scheduled';
}
export const lessonUsesSlot=(lesson:StatusSource)=>lessonStatus(lesson)==='scheduled';
export const lessonNeedsAction=(lesson:StatusSource)=>['transfer_waiting','transfer_requested','absence_requested'].includes(lessonStatus(lesson));
export function transferDeadline(date:string,reason:string){return reason==='illness'?Date.parse(`${date}T08:00:00+09:00`):Date.parse(`${date}T00:00:00+09:00`)-21600000}
export function canRequestTransfer(lesson:StatusSource,date:string,reason:string,now=Date.now()){
 const status=lessonStatus(lesson);
 if(status==='transfer_waiting'||lesson.transferAcceptance){return ['transfer_waiting','transfer_requested'].includes(status)&&!!lesson.transferAcceptance&&now<=Date.parse(lesson.transferAcceptance.expiresAt)}
 return ['scheduled','transfer_requested'].includes(status)&&now<=transferDeadline(date,reason);
}
export function releaseLessonSlot(state:State,lesson:Lesson){
 const teacher=lesson.teacher;lesson.teacher='';
 if(teacher&&!state.lessons.some(other=>other.id!==lesson.id&&other.slot===lesson.slot&&other.teacher===teacher&&lessonUsesSlot(other)))delete state.duty?.[teacher+'|'+lesson.slot];
}
/** The absent field is a compatibility projection for scheduling/capacity readers. */
export function normalizeLessonStatuses(state:State,rooms?:string[]){
 const lessons=rooms?state.lessons.filter(lesson=>state.slots.some(slot=>slot.id===lesson.slot&&rooms.includes(slot.room))):state.lessons;
 for(const lesson of lessons){lesson.status=lessonStatus(lesson);lesson.absent=!lessonUsesSlot(lesson)}
 for(const lesson of lessons)if(lessonNeedsAction(lesson))releaseLessonSlot(state,lesson);
 return state;
}

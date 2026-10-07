import {lessonNeedsAction,lessonUsesSlot} from './lesson-state';
import type {State,Student} from './scheduler';
import {statusAt} from './students';

export type ScheduleStage='adjusting'|'waiting'|'confirmed';
export type ScheduleStatusRecord={status:ScheduleStage;datesLocked?:boolean;snapshot:string;updatedAt:string;updatedBy:string};
export const scheduleStatusLabels={uncreated:'未作成',adjusting:'調整中',waiting:'確認待ち',confirmed:'確定',outside:'対象外'};
export type ScheduleStatus=keyof typeof scheduleStatusLabels;
const validMonth=(month:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month);

/** Legacy waiting/confirmed records are locked even before their next save. */
export function studentScheduleDatesLocked(student:Pick<Student,'scheduleStatuses'>,month:string){
 const record=student.scheduleStatuses?.[month];
 return record?.datesLocked===true||record?.status==='waiting'||record?.status==='confirmed';
}

/** Contract month follows the original lesson date, including cross-month transfers. */
export function studentScheduleStatus(state:State,student:Student,month:string){
 const slots=new Map(state.slots.map(slot=>[slot.id,slot]));
 const lessons=state.lessons.filter(lesson=>{
  const slot=slots.get(lesson.slot);
  return (lesson.studentId?lesson.studentId===student.id:lesson.name===student.name)&&slot?.room===student.room&&(lesson.originalDate||slot.date||'').slice(0,7)===month;
 });
 const pending=lessons.filter(lessonNeedsAction).length;
 // Staffing and internal notes do not change the dates agreed with the family.
 const snapshot=JSON.stringify([student.room,student.monthlyLessons,lessons.map(lesson=>{
  const slot=slots.get(lesson.slot)!;
  return [lesson.id,slot.date,slot.start,slot.end,!lessonUsesSlot(lesson)];
 }).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
 const record=student.scheduleStatuses?.[month],active=statusAt(student,month)==='active';
 const canAdvance=active&&lessons.length>0&&lessons.length===student.monthlyLessons&&!pending;
 const status:ScheduleStatus=!active?'outside':pending?'adjusting':record?.status==='adjusting'?'adjusting':
  record?(canAdvance&&record.snapshot===snapshot?record.status:'adjusting'):lessons.length?'adjusting':'uncreated';
 return {status,pending,placed:lessons.length,target:student.monthlyLessons,canAdvance,snapshot,record};
}

export function setStudentScheduleStatus(state:State,studentId:string,month:string,status:ScheduleStage,actor:string){
 const student=state.students?.find(student=>student.id===studentId);
 if(!student||!validMonth(month)||!['adjusting','waiting','confirmed'].includes(status))throw Error('生徒と対象月を確認してください。');
 const current=studentScheduleStatus(state,student,month);
 if(current.status==='outside')throw Error('在籍対象外の月は変更できません。');
 if(status!=='adjusting'&&!current.canAdvance)throw Error(current.pending?'変更依頼を対応してからステータスを変更してください。':'契約回数分の予定を配置してからステータスを変更してください。');
 (student.scheduleStatuses??={})[month]={status,datesLocked:status!=='adjusting'||studentScheduleDatesLocked(student,month),snapshot:current.snapshot,updatedAt:new Date().toISOString(),updatedBy:actor};
}

/** Latch a received request so rejecting/resolving it never revives an old confirmation. */
export function reopenStudentScheduleMonth(student:{scheduleStatuses?:Record<string,ScheduleStatusRecord>},month:string){
 const record=student.scheduleStatuses?.[month];
 if(record&&record.status!=='adjusting')student.scheduleStatuses![month]={status:'adjusting',datesLocked:studentScheduleDatesLocked(student,month),snapshot:'',updatedAt:new Date().toISOString(),updatedBy:'自動'};
}

/** Also runs before saving, so merged or externally edited dates cannot keep a stale confirmation. */
export function reconcileStudentScheduleStatuses(state:State,rooms?:string[]){
 for(const student of (state.students||[]).filter(student=>!rooms||rooms.includes(student.room)))for(const month of Object.keys(student.scheduleStatuses||{})){
  const current=studentScheduleStatus(state,student,month);
  if(current.status==='adjusting'||current.status==='outside')reopenStudentScheduleMonth(student,month);
 }
 return state;
}

export function validStudentScheduleStatuses(state:State){
 return (state.students||[]).every(student=>{
  const records=student.scheduleStatuses;
  if(records===undefined)return true;
  if(!records||typeof records!=='object'||Array.isArray(records))return false;
  return Object.entries(records).every(([month,record])=>validMonth(month)&&record&&typeof record==='object'&&!Array.isArray(record)&&
   ['adjusting','waiting','confirmed'].includes(record.status)&&(record.datesLocked===undefined||typeof record.datesLocked==='boolean')&&typeof record.snapshot==='string'&&record.snapshot.length<=100000&&
   typeof record.updatedAt==='string'&&Number.isFinite(Date.parse(record.updatedAt))&&typeof record.updatedBy==='string'&&record.updatedBy.length<=200);
 });
}

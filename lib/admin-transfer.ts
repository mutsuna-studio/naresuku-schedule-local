import {lessonUsesSlot} from './lesson-state';
import {renderLineTemplate,lineDate,lineDateList,composeLineMessage} from './line-template';
import {lessonPreferencePriority,comparePreferencePriority} from './preference-priority';
import type {State,Slot} from './scheduler';
import {overlaps,key} from './scheduler';
import {studentForLesson,statusAt} from './students';
import {hasWorkAssignment} from './work-assignments';

/** Shared explanation and eligibility for candidate lists and change requests. */
export function adminTransferAssessment(state:State,lessonId:string,slotId:string,now=Date.now()){
 const lesson=state.lessons.find(item=>item.id===lessonId),source=state.slots.find(slot=>slot.id===lesson?.slot),slot=state.slots.find(item=>item.id===slotId);
 const basis=slot?.date.slice(0,7)===new Date(now+9*3600000).toISOString().slice(0,7)?'confirmed' as const:'requested' as const;
 const active=state.lessons.filter(item=>lessonUsesSlot(item)&&item.id!==lessonId),at=active.filter(item=>item.slot===slotId);
 const result={basis,placed:at.length,unassigned:at.filter(item=>!item.teacher).length,teachers:0,spare:0,eligible:false,reason:'',openSeats:[] as {teacher:string;count:number}[]};
 if(!lesson||!source||!slot)return {...result,reason:'授業枠が見つかりません'};
 const student=studentForLesson(state,lesson),original=lesson.originalDate||source.date;
 const deadline=new Date(original+'T00:00:00Z'),day=deadline.getUTCDate();deadline.setUTCDate(1);deadline.setUTCMonth(deadline.getUTCMonth()+3);deadline.setUTCDate(0);deadline.setUTCDate(Math.min(day,deadline.getUTCDate()));
 if(slot.room!==source.room)return {...result,reason:'別教室の枠です'};
 if(slot.id===source.id)return {...result,reason:'振替元と同じ枠です'};
 if(new Date(`${slot.date}T${slot.start}:00+09:00`).getTime()<=now)return {...result,reason:'開始日時を過ぎています'};
 if(slot.date>deadline.toISOString().slice(0,10))return {...result,reason:'振替可能期間を過ぎています'};
 if(student&&statusAt(student,slot.date)!=='active')return {...result,reason:'在籍期間外です'};
 if(active.some(item=>(lesson.studentId?item.studentId===lesson.studentId||!item.studentId&&item.name===lesson.name:item.name===lesson.name)&&state.slots.some(other=>other.id===item.slot&&overlaps(slot,other))))return {...result,reason:'生徒の別の授業と重複しています'};
 const occupied=(name:string,target:Slot)=>(state.teachers.some(t=>t.name===name&&t.autoAttendance&&t.rooms?.includes(target.room))&&state.availability[key(name,target.id)]==='yes')||hasWorkAssignment(state,name,target.id)||state.duty[key(name,target.id)]||active.some(item=>item.slot===target.id&&item.teacher===name);
 const teachers=state.teachers.filter(teacher=>{
  if(teacher.archived||(lesson.exam&&!teacher.canSuperviseExam)||!teacher.rooms?.includes(slot.room)||!teacher.curricula?.includes(lesson.course)||hasWorkAssignment(state,teacher.name,slot.id))return false;
  const availability=state.availability[key(teacher.name,slot.id)];
  if(availability==='no'||(basis==='confirmed'?!occupied(teacher.name,slot):!['yes','reserve'].includes(availability)))return false;
  if(state.slots.some(other=>other.id!==slot.id&&overlaps(slot,other)&&occupied(teacher.name,other)))return false;
  return at.filter(item=>item.teacher===teacher.name).length<Math.min(3,teacher.max||3);
 });
 const spare=Math.max(0,teachers.reduce((sum,t)=>sum+Math.min(3,t.max||3)-at.filter(item=>item.teacher===t.name).length,0)-result.unassigned);
 return {...result,openSeats:teachers.map(t=>({teacher:t.name,count:Math.min(3,t.max||3)-at.filter(item=>item.teacher===t.name).length})),teachers:teachers.length,spare,eligible:spare>0,reason:spare>0?'':teachers.length?'受入余力がありません':'担当可能なスタッフの空きがありません'};
}
export function adminTransferCandidates(state:State,lessonId:string,now=Date.now()){
 return state.slots.flatMap(slot=>{
  const assessment=adminTransferAssessment(state,lessonId,slot.id,now);
  if(!assessment.eligible)return [];
  const lesson=state.lessons.find(item=>item.id===lessonId)!;
  const priority=lessonPreferencePriority(state,lesson,slot);
  return [{...slot,basis:assessment.basis,preferred:priority!==null,priority}];
 }).sort((a,b)=>comparePreferencePriority(a.priority,b.priority)||(a.date+a.start).localeCompare(b.date+b.start));
}
export function transferMessage(source:Slot,candidates:Slot[],now=new Date()){
 if(!candidates.length)return '';
 const {opening,closing}=renderLineTemplate({
  opening:`{挨拶}いつもお世話になっております😊\n${lineDate(source.date,{weekday:false})}のお休みについて承知いたしました。\n振替日時についてですが、以下の日程でご都合のよろしい日時はございますでしょうか？`,
  closing:'ご確認のほどよろしくお願いいたします🙇‍♀️'
 },source.date.slice(0,7),now);
 return composeLineMessage(opening,lineDateList(candidates,{groupByDate:true}),closing);
}

export function transferAcceptanceMessage(link:string){
 return `以下のリンクよりご希望の振替日時を選択いただくか、LINEにてご希望の日時をご連絡いただければと思います🙇‍♂️\nご確認のほどよろしくお願いいたします🙇‍♂️\n${link}`;
}

import {renderLineTemplate,lineDate,lineDateList,composeLineMessage} from './line-template';
import {lessonPreferencePriority,comparePreferencePriority} from './preference-priority';
import type {State,Slot} from './scheduler';
import {overlaps,key} from './scheduler';
import {studentForLesson,statusAt} from './students';
import {hasWorkAssignment} from './work-assignments';

export function adminTransferCandidates(state:State,lessonId:string,now=Date.now()){
 const lesson=state.lessons.find(item=>item.id===lessonId);
 const source=state.slots.find(slot=>slot.id===lesson?.slot);
 if(!lesson||!source)return [];
 const student=studentForLesson(state,lesson);
 const original=lesson.originalDate||source.date;
 const deadline=new Date(original+'T00:00:00Z');
 const day=deadline.getUTCDate();deadline.setUTCDate(1);deadline.setUTCMonth(deadline.getUTCMonth()+3);deadline.setUTCDate(0);deadline.setUTCDate(Math.min(day,deadline.getUTCDate()));
 const end=deadline.toISOString().slice(0,10);
 const currentMonth=new Date(now+9*3600000).toISOString().slice(0,7);
 const active=state.lessons.filter(item=>!item.absent&&item.id!==lesson.id);
 const occupied=(name:string,slot:Slot)=>(state.teachers.some(t=>t.name===name&&t.autoAttendance&&t.rooms?.includes(slot.room))&&state.availability[key(name,slot.id)]==='yes')||hasWorkAssignment(state,name,slot.id)||state.duty[key(name,slot.id)]||active.some(item=>item.slot===slot.id&&item.teacher===name);
 return state.slots.filter(slot=>slot.room===source.room&&slot.id!==source.id&&slot.date<=end&&new Date(`${slot.date}T${slot.start}:00+09:00`).getTime()>now&&(!student||statusAt(student,slot.date)==='active'))
 .filter(slot=>!active.some(item=>(lesson.studentId?item.studentId===lesson.studentId||!item.studentId&&item.name===lesson.name:item.name===lesson.name)&&state.slots.some(other=>other.id===item.slot&&overlaps(slot,other))))
 .flatMap(slot=>{
  const basis=slot.date.slice(0,7)===currentMonth?'confirmed' as const:'requested' as const;
  const teachers=state.teachers.filter(teacher=>{
   if((lesson.exam&&!teacher.canSuperviseExam)||!teacher.rooms?.includes(slot.room)||!teacher.curricula?.includes(lesson.course)||hasWorkAssignment(state,teacher.name,slot.id))return false;
   const availability=state.availability[key(teacher.name,slot.id)];
   if(availability==='no'||(basis==='confirmed'?!occupied(teacher.name,slot):!['yes','reserve'].includes(availability)))return false;
   if(state.slots.some(other=>other.id!==slot.id&&overlaps(slot,other)&&occupied(teacher.name,other)))return false;
   return active.filter(item=>item.slot===slot.id&&item.teacher===teacher.name).length<Math.min(3,teacher.max||3);
  });
  // Unassigned lessons also consume capacity; do not offer an already oversubscribed slot.
  const spare=teachers.reduce((sum,teacher)=>sum+Math.min(3,teacher.max||3)-active.filter(item=>item.slot===slot.id&&item.teacher===teacher.name).length,0);
  const priority=lessonPreferencePriority(state,lesson,slot);
  return spare>active.filter(item=>item.slot===slot.id&&!item.teacher).length?[{...slot,basis,preferred:priority!==null,priority}]:[];
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

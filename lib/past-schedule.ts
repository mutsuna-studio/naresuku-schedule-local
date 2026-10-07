import type {State} from './scheduler';

export const pastScheduleMessage='過去の授業は保護されています。「過去の授業を編集」をオンにしてください。';
export const japanToday=(now=new Date())=>now.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
export const isPastDate=(date:string,now=new Date())=>date<japanToday(now);
// Notes are records of a lesson, not changes to its schedule.
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'undefined';
}
export function pastScheduleChanged(before:State,after:State,now=new Date()){
 const today=japanToday(now),past=new Set([...before.slots,...after.slots].filter(slot=>slot.date<today).map(slot=>slot.id));
 const snapshot=(state:State)=>({
  slots:state.slots.filter(slot=>past.has(slot.id)).sort((a,b)=>a.id.localeCompare(b.id)),
  lessons:state.lessons.filter(lesson=>past.has(lesson.slot)).map(({note:_,...lesson})=>lesson).sort((a,b)=>a.id.localeCompare(b.id)),
  duty:Object.fromEntries(Object.entries(state.duty||{}).filter(([key])=>[...past].some(id=>key.endsWith('|'+id)))),
  work:(state.workAssignments||[]).filter(work=>past.has(work.slot)).map(({note:_,...work})=>work).sort((a,b)=>a.id.localeCompare(b.id))
 });
 return canonical(snapshot(before))!==canonical(snapshot(after));
}
export const permitsPastScheduleEdit=(request:Request)=>request.headers.get('X-Allow-Past-Schedule-Edit')==='true';

/** Exempt only server-validated request/contact lessons and their released duty.
 * Slots, other lessons, work assignments and newly added past duty stay protected.
 * Call only after request status, room, destination and revision validation.
 */
export function pastScheduleChangedOutsideResolution(before:State,after:State,lessonIds:string[],now=new Date()){
 const ids=new Set(lessonIds),review=structuredClone(after);
 for(const lesson of before.lessons.filter(item=>ids.has(item.id))){
  const index=review.lessons.findIndex(item=>item.id===lesson.id);
  // A resolution must retain the original lesson record.
  if(index<0)return true;
  review.lessons[index]=structuredClone(lesson);
  const dutyKey=lesson.teacher+'|'+lesson.slot;
  if(lesson.teacher&&Object.hasOwn(before.duty||{},dutyKey)&&!Object.hasOwn(review.duty||{},dutyKey)){
   review.duty[dutyKey]=before.duty[dutyKey];
  }
 }
 return pastScheduleChanged(before,review,now);
}

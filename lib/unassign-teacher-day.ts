import type {State} from './scheduler';

/** Release only active lessons in the selected classroom and day. */
export function unassignTeacherDay(state:State,teacher:string,room:string,date:string,selectedSlots?:string[]){
 if(!teacher)return 0;
 const slots=new Set(state.slots.filter(slot=>slot.room===room&&slot.date===date&&(!selectedSlots||selectedSlots.includes(slot.id))).map(slot=>slot.id));
 const lessons=state.lessons.filter(lesson=>slots.has(lesson.slot)&&lesson.teacher===teacher&&!lesson.absent);
 if(!lessons.length)return 0;
 for(const lesson of lessons)lesson.teacher='';
 for(const slot of slots)delete state.duty[teacher+'|'+slot];
 return lessons.length;
}

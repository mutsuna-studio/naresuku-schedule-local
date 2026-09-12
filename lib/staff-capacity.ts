import {hasWorkAssignment} from './work-assignments';
import {key,overlaps,type State,type Slot,type Lesson} from './scheduler';
// Maximum matching prevents a multi-course teacher being counted twice.
export function staffingGap(state:State,slot:Slot,extra?:Lesson){
 const lessons=state.lessons.filter(l=>l.slot===slot.id&&!l.absent);if(extra)lessons.push(extra);
 const teachers=state.teachers.filter(t=>!hasWorkAssignment(state,t.name,slot.id)&&t.rooms?.includes(slot.room)&&['yes','reserve'].includes(state.availability[key(t.name,slot.id)])&&!state.slots.some(other=>other.id!==slot.id&&overlaps(slot,other)&&(hasWorkAssignment(state,t.name,other.id)||state.duty[key(t.name,other.id)]||state.lessons.some(l=>l.slot===other.id&&!l.absent&&l.teacher===t.name))));
 const seats=teachers.flatMap(t=>Array.from({length:Math.max(0,t.max-lessons.filter(l=>l.teacher===t.name).length)},()=>t));
 const waiting=lessons.filter(l=>!l.teacher),assigned=new Map<number,number>();
 function match(index:number,seen:Set<number>):boolean{for(let i=0;i<seats.length;i++){const t=seats[i];if(seen.has(i)||!t.curricula?.includes(waiting[index].course)||(waiting[index].exam&&!t.canSuperviseExam))continue;seen.add(i);const previous=assigned.get(i);if(previous===undefined||match(previous,seen)){assigned.set(i,index);return true}}return false}
 let covered=0;for(let i=0;i<waiting.length;i++)if(match(i,new Set()))covered++;
 return waiting.length-covered;
}

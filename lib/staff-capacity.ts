import {hasWorkAssignment} from './work-assignments';
import {key,overlaps,type State,type Slot,type Lesson,type Teacher} from './scheduler';
function availableTeachers(state:State,slot:Slot){
 return state.teachers.filter(t=>!t.archived&&t.autoAssignLessons!==false&&!hasWorkAssignment(state,t.name,slot.id)&&t.rooms?.includes(slot.room)&&['yes','reserve'].includes(state.availability[key(t.name,slot.id)])&&!state.slots.some(other=>other.id!==slot.id&&overlaps(slot,other)&&(hasWorkAssignment(state,t.name,other.id)||state.duty[key(t.name,other.id)]||state.lessons.some(l=>l.slot===other.id&&!l.absent&&l.teacher===t.name))));
}
// Maximum matching prevents a multi-course teacher being counted twice.
function uncovered(lessons:Lesson[],teachers:Teacher[]){
 const seats=teachers.flatMap(t=>Array.from({length:Math.max(0,t.max-lessons.filter(l=>l.teacher===t.name).length)},()=>t));
 const waiting=lessons.filter(l=>!l.teacher),assigned=new Map<number,number>();
 function match(index:number,seen:Set<number>):boolean{for(let i=0;i<seats.length;i++){const t=seats[i];if(seen.has(i)||!t.curricula?.includes(waiting[index].course)||(waiting[index].exam&&!t.canSuperviseExam))continue;seen.add(i);const previous=assigned.get(i);if(previous===undefined||match(previous,seen)){assigned.set(i,index);return true}}return false}
 let covered=0;for(let i=0;i<waiting.length;i++)if(match(i,new Set()))covered++;
 return waiting.length-covered;
}
export function staffingGap(state:State,slot:Slot,extra?:Lesson){
 const lessons=state.lessons.filter(l=>l.slot===slot.id&&!l.absent);if(extra)lessons.push(extra);
 return uncovered(lessons,availableTeachers(state,slot));
}

/** Utilization of seats that can teach this pupil, accounting for other courses
 * competing for those same seats. Existing assigned lessons remain fixed. */
export function staffingLoad(state:State,slot:Slot,extra:Lesson){
 const teachers=availableTeachers(state,slot),lessons=state.lessons.filter(l=>l.slot===slot.id&&!l.absent);
 const capacity=teachers.filter(t=>t.curricula?.includes(extra.course)&&(!extra.exam||t.canSuperviseExam)).reduce((sum,t)=>sum+Math.max(0,t.max),0);
 if(!capacity)return 1;
 const baseline=uncovered(lessons,teachers);
 let low=0,high=capacity;
 // Find remaining compatible seats without reducing existing overall coverage.
 while(low<high){
  const middle=Math.ceil((low+high)/2);
  const probes=Array.from({length:middle},()=>({...extra,teacher:''}));
  if(uncovered([...lessons,...probes],teachers)===baseline)low=middle;else high=middle-1;
 }
 return (capacity-low+1)/capacity;
}

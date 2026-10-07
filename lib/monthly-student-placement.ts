import type {Lesson,Slot,State} from './scheduler';
import {staffingGap,staffingLoad} from './staff-capacity';

export type MonthlyCandidate={slot:Slot;lesson:Lesson;priority:number};
const dayNumber=(date:string)=>Date.parse(date+'T12:00:00Z')/86400000;

// Soft preferences: keep a fortnightly rhythm, then a consistent weekday/time.
// Short gaps cost more than a slightly longer gap; neither is a hard exclusion.
export function rhythmCost(a:Slot,b:Slot){
 const days=Math.abs(dayNumber(a.date)-dayNumber(b.date));
 return Math.abs(days-14)*2+Math.max(0,12-days)*8
  +(dayNumber(a.date)%7===dayNumber(b.date)%7?0:24)
  +(a.start===b.start&&a.end===b.end?0:8);
}

/** Compare the whole month's pairs. Existing lessons are anchors, never moved. */
export function chooseMonthlyPair(state:State,candidates:MonthlyCandidate[],remaining:number,anchors:Slot[]){
 if(remaining<=0)return [];
 const ranked=candidates.filter(({slot})=>state.slots.some(existing=>existing.id===slot.id)||!state.slots.some(existing=>existing.room===slot.room&&existing.date===slot.date&&existing.start<slot.end&&slot.start<existing.end)).map(candidate=>({
  candidate,
  shortage:staffingGap(state,candidate.slot,candidate.lesson)-staffingGap(state,candidate.slot),
  load:staffingLoad(state,candidate.slot,candidate.lesson),
 })).sort((a,b)=>a.candidate.slot.date.localeCompare(b.candidate.slot.date)||a.candidate.slot.start.localeCompare(b.candidate.slot.start)||a.candidate.priority-b.candidate.priority||a.candidate.lesson.occurrence!.localeCompare(b.candidate.lesson.occurrence!));
 let best:MonthlyCandidate[]=[],bestScore:number[]=[];
 function consider(entries:typeof ranked){
  const selected=entries.map(entry=>entry.candidate),slots=[...anchors,...selected.map(candidate=>candidate.slot)];
  let rhythm=selected.reduce((sum,candidate)=>sum+(candidate.priority-1)*4,0);
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)rhythm+=rhythmCost(slots[i],slots[j]);
  const score=[-selected.length,entries.reduce((sum,entry)=>sum+entry.shortage,0),rhythm,entries.reduce((sum,entry)=>sum+entry.load,0)];
  const differing=score.findIndex((value,index)=>value!==bestScore[index]);
  if(!best.length||differing>=0&&score[differing]<bestScore[differing]){best=selected;bestScore=score;}
 }
 for(let i=0;i<ranked.length;i++){
  consider([ranked[i]]);
  if(remaining<2)continue;
  for(let j=i+1;j<ranked.length;j++){
   const a=ranked[i].candidate,b=ranked[j].candidate;
   if(a.slot.date===b.slot.date||a.lesson.occurrence===b.lesson.occurrence)continue;
   consider([ranked[i],ranked[j]]);
  }
 }
 return best;
}

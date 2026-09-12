import type {Lesson,Slot} from '../lib/scheduler';

export const studentKey=(lesson:Lesson)=>lesson.studentId||`name:${lesson.name.normalize('NFKC').trim()}`;
export const weekdayOf=(date:string)=>new Date(`${date}T12:00:00Z`).getUTCDay();

/** Calendar positions include closed days and partial weeks so weekdays never slide. */
export function calendarWeeks(month:string,weekdays:number[]){
 const first=new Date(`${month}-01T12:00:00Z`);
 if(!Number.isFinite(first.getTime())||!weekdays.length)return [];
 const cursor=new Date(first);cursor.setUTCDate(cursor.getUTCDate()-(cursor.getUTCDay()+6)%7);
 const weeks:(string|null)[][]=[];
 while(cursor.toISOString().slice(0,7)<=month){
  const monday=new Date(cursor);
  weeks.push(weekdays.map(weekday=>{
   const day=new Date(monday);day.setUTCDate(day.getUTCDate()+(weekday+6)%7);
   return day.toISOString().startsWith(month)?day.toISOString().slice(0,10):null;
  }));
  cursor.setUTCDate(cursor.getUTCDate()+7);
 }
 return weeks.filter(week=>week.some(Boolean));
}
export type PlacedLesson={lesson:Lesson;lane:number;previous?:Lesson;next?:Lesson;connectedBefore:boolean;connectedAfter:boolean};

/** Pack consecutive runs together, reserving a lane through every period of a run. */
export function placeLessons(slots:Slot[],lessons:Lesson[],dayLessons=lessons){
 const indices=new Map(slots.map((slot,index)=>[slot.id,index]));
 const byStudent=new Map<string,Map<number,Lesson[]>>();
 for(const lesson of dayLessons.filter(item=>!item.absent)){
  const period=indices.get(lesson.slot);if(period===undefined)continue;
  const id=studentKey(lesson),periods=byStudent.get(id)||new Map<number,Lesson[]>();
  periods.set(period,[...(periods.get(period)||[]),lesson]);byStudent.set(id,periods);
 }
 const neighbor=(lesson:Lesson,direction:number)=>{
  if(lesson.absent)return undefined;
  const periods=byStudent.get(studentKey(lesson)),index=indices.get(lesson.slot);
  if(index===undefined||periods?.get(index)?.length!==1)return undefined;
  const candidates=periods.get(index+direction);
  return candidates?.length===1?candidates[0]:undefined;
 };
 const selected=new Map(lessons.filter(l=>indices.has(l.slot)).map(l=>[l.id,l]));
 const visited=new Set<string>();
 const runs:{lessons:Lesson[];start:number;end:number}[]=[];
 for(const lesson of [...selected.values()].sort((a,b)=>indices.get(a.slot)!-indices.get(b.slot)!||a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id))){
  if(visited.has(lesson.id))continue;
  const run:Lesson[]=[];let current:Lesson|undefined=lesson;
  while(current&&!visited.has(current.id)){run.push(current);visited.add(current.id);const next=neighbor(current,1);current=next&&selected.has(next.id)?next:undefined}
  runs.push({lessons:run,start:indices.get(lesson.slot)!,end:indices.get(run.at(-1)!.slot)!});
 }
 runs.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||a.lessons[0].name.localeCompare(b.lessons[0].name,'ja'));
 const laneEnds:number[]=[],cells:PlacedLesson[][]=slots.map(()=>[]);
 for(const run of runs){
  let lane=laneEnds.findIndex(end=>end<run.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=run.end;
  for(const lesson of run.lessons){
   const previous=neighbor(lesson,-1),next=neighbor(lesson,1);
   cells[indices.get(lesson.slot)!].push({lesson,lane,previous,next,connectedBefore:!!previous&&selected.has(previous.id),connectedAfter:!!next&&selected.has(next.id)});
  }
 }
 return {cells,lanes:Math.max(1,laneEnds.length)};
}

import type {CampusSchedule,SettingsData,State} from './scheduler';

const defaultAbbreviations:Record<string,string>={scratch:'SC',minecraft:'MC','html/css':'HC',javascript:'JS',unity:'UN',swift:'SW',roblox:'RB',robloxjr:'RJ',python:'PY',py:'PY',ipass:'IP'};

const weekdays=[0,1,2,3,4,5,6];

export function ensureSettings(state:State):State{
 const n=structuredClone(state);
 n.workAssignments??=[];
 const campuses=[...new Set([...(n.settings?.campuses||[]),...n.slots.map(x=>x.room),...(n.students||[]).map(x=>x.room)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja'));
 const curricula=[...new Set([...(n.settings?.curricula||[]),...n.lessons.map(x=>x.course),...(n.students||[]).map(x=>x.course)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja'));
 const configured=n.settings?.schedules||[];
 const schedules:CampusSchedule[]=[];
 for(const room of campuses)for(const weekday of weekdays){
  const existing=configured.find(x=>x.room===room&&x.weekday===weekday);
  if(existing){schedules.push({...existing,periods:[...existing.periods].sort((a,b)=>a.order-b.order)});continue;}
  const times=[...new Set(n.slots.filter(x=>x.room===room&&new Date(x.date+'T12:00:00Z').getUTCDay()===weekday).map(x=>x.start+'|'+x.end))].sort();
  schedules.push({room,weekday,periods:times.map((time,i)=>{const [start,end]=time.split('|');return{id:`${room}-${weekday}-${i+1}`,order:i+1,start,end}})});
 }
 const curriculumAbbreviations=n.settings?.curriculumAbbreviations??Object.fromEntries(curricula.map(name=>[name,defaultAbbreviations[name.toLowerCase().replace(/\s/g,'')]||'']));
 n.settings={...n.settings,campuses,curricula,schedules,curriculumAbbreviations};return n;
}

export function configuredPeriods(state:State,room:string,weekday?:number){
 const schedules=state.settings?.schedules.filter(x=>x.room===room&&(weekday===undefined||x.weekday===weekday))||[];
 const unique=new Map<string,{value:string;label:string}>();
 for(const schedule of schedules)for(const p of schedule.periods){const value=p.start+'|'+p.end;unique.set(value,{value,label:`${p.order}コマ目　${p.start}〜${p.end}`})}
 return [...unique.values()].sort((a,b)=>a.value.localeCompare(b.value));
}

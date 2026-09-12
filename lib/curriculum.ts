import type {State} from './scheduler';

export type CurriculumUsage={lessons:number;students:number;preferences:number;teachers:number};

export function curriculumUsage(state:State,value:string):CurriculumUsage{
 return{
  lessons:state.lessons.filter(item=>item.course===value).length,
  students:(state.students||[]).filter(item=>item.course===value).length,
  preferences:(state.preferences||[]).filter(item=>item.course===value).length,
  teachers:state.teachers.filter(item=>item.curricula?.includes(value)).length
 };
}

/** Replaces every persisted reference, so callers cannot omit one data domain. */
export function replaceCurriculum(state:State,from:string,to:string,curricula?:string[]):State{
 const next=structuredClone(state);
 next.lessons.forEach(item=>{if(item.course===from)item.course=to});
 (next.students||[]).forEach(item=>{if(item.course===from)item.course=to});
 (next.preferences||[]).forEach(item=>{if(item.course===from)item.course=to});
 next.teachers.forEach(item=>{
  if(item.curricula)item.curricula=[...new Set(item.curricula.map(value=>value===from?to:value))];
 });
 if(next.settings)next.settings.curricula=curricula?[...curricula]:next.settings.curricula.filter(value=>value!==from);
 return next;
}

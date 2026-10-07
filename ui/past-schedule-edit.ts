import {getContext} from 'svelte';
export const pastScheduleEditContext='past-schedule-edit';
export function pastScheduleEditHeaders(){
 const allowed=getContext<()=>boolean>(pastScheduleEditContext);
 return ()=>({'X-Allow-Past-Schedule-Edit':String(allowed?.()===true)});
}

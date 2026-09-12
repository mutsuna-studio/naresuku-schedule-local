import type {State,Slot,Lesson,Preference} from './scheduler';

export function preferencePriority(preference:Preference){
 const value=preference.priority;
 return Number.isInteger(value)&&value!>=1&&value!<=12?value!:1;
}
/** Shared by transfer suggestions, recurring placement and teacher assignment. */
export function lessonPreferencePriority(state:State,lesson:Pick<Lesson,'studentId'|'name'|'course'>,slot:Slot):number|null{
 const date=new Date(slot.date+'T12:00:00Z'),week=Math.floor((date.getUTCDate()-1)/7)+1;
 const student=state.students?.find(item=>lesson.studentId?item.id===lesson.studentId:item.name===lesson.name&&item.room===slot.room);
 const matching=(state.preferences||[]).filter(preference=>preference.room===slot.room&&preference.course===lesson.course&&(preference.studentId?preference.studentId===(student?.id||lesson.studentId):preference.name===lesson.name)&&preference.weeks.includes(week)&&[preference,...(preference.alternatives||[])].some(option=>option.weekday===date.getUTCDay()&&option.start===slot.start&&option.end===slot.end));
 return matching.length?Math.min(...matching.map(preferencePriority)):null;
}
export function comparePreferencePriority(a:number|null,b:number|null){return (a??13)-(b??13)}

import {defaultLineTemplate,renderLineTemplate,lineDateList,composeLineMessage,type LineTemplate} from './line-template';
import type {State,Student} from './scheduler';
export function monthlyLineLessons(s:State,student:Student,month:string){
 return s.lessons.flatMap(l=>{const slot=s.slots.find(x=>x.id===l.slot);return slot&&slot.room===student.room&&slot.date.startsWith(month+'-')&&!l.absent&&(l.studentId?l.studentId===student.id:l.name===student.name)?[{lesson:l,slot}]:[]}).sort((a,b)=>(a.slot.date+a.slot.start).localeCompare(b.slot.date+b.slot.start));
}
export function monthlyLineMessage(s:State,student:Student,month:string,note='',now=new Date(),template:LineTemplate=defaultLineTemplate){
 const rows=monthlyLineLessons(s,student,month);if(!rows.length)return '';
 const {opening,closing}=renderLineTemplate(template,month,now);
 const dates=lineDateList(rows.map(({slot})=>slot),{padDay:true});
 return composeLineMessage(opening,dates,closing,note);
}

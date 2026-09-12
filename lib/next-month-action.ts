import type {State} from './scheduler';
export function followingMonth(today:string){const [year,month]=today.split('-').map(Number);return new Date(Date.UTC(year,month,1)).toISOString().slice(0,7)}
export type PreparationAction='create'|'request'|'reminder'|'input'|'review';
export function nextMonthAction(state:State,room:string,month:string,role:'admin'|'staff',teacher:string,history:{kind:string;status:string;target?:string}[]|null,channel=''): {kind:PreparationAction;label:string}|null{
 const prefix=Number(month.slice(5,7))+'月 ';
 const slots=state.slots.filter(slot=>slot.room===room&&slot.date.startsWith(month+'-'));
 if(!slots.length)return role==='admin'?{kind:'create',label:prefix+'コマ作成'}:null;
 const teachers=state.teachers.filter(t=>t.rooms?.includes(room)&&(role==='admin'||t.name===teacher));
 const remaining=teachers.filter(t=>slots.some(slot=>!['yes','reserve','no'].includes(state.availability[t.name+'|'+slot.id])));
 if(!remaining.length)return null;
 if(role==='staff')return {kind:'input',label:prefix+'シフト入力'};
 if(history===null)return null;
 const requests=history.filter(item=>item.kind==='request'&&(!channel||item.target===channel));
 if(requests.some(item=>['sending','unknown'].includes(item.status)))return {kind:'review',label:prefix+'送信確認'};
 if(!requests.some(item=>item.status==='sent'))return {kind:'request',label:prefix+'シフト依頼'};
 return {kind:'reminder',label:prefix+'未入力'+remaining.length+'人'};
}

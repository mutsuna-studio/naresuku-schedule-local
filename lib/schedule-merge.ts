import type {State} from './scheduler';

export type Conflict={id:string;label:string;path:string[];base:any;local:any;remote:any};
export type ConflictChoices=Record<string,'local'|'remote'>;
export type MergeResult={state:State;conflicts:Conflict[]};
const labels:Record<string,string>={students:'生徒',lessons:'授業',slots:'授業枠',teachers:'スタッフ',preferences:'希望スケジュール',settings:'設定',availability:'出勤希望',duty:'担当',workAssignments:'固定業務',title:'業務名',teacherId:'担当者',name:'名前',room:'校舎',course:'カリキュラム',monthlyLessons:'契約回数',periods:'在籍期間',birthDate:'生年月日',ownsComputer:'PC所持',reviewed:'確認済み',progressSheetUrl:'進捗シート',teacher:'担当',absent:'欠席',request:'保護者の申請'};
Object.assign(labels,{note:'授業メモ',slot:'授業日時・教室',studentId:'生徒',exam:'検定本番',originalDate:'振替前の日付',occurrence:'定期授業の対応',requestData:'申請内容',requestRestore:'申請前の担当',kind:'種別',reason:'理由',preferredSlots:'希望日時',message:'メッセージ',date:'日付',start:'開始',end:'終了',email:'メールアドレス',rooms:'担当教室',adminRooms:'管理する教室',curricula:'担当カリキュラム',max:'担当人数の上限',autoAttendance:'自動出勤',autoAssignLessons:'自動割り当て',canSuperviseExam:'検定対応',weekday:'曜日',weeks:'対象週',priority:'優先順位',frequency:'頻度',until:'終了日',alternatives:'別の希望日時',reviewNote:'確認メモ',campuses:'教室',schedules:'開講日時',closeOnHolidays:'祝日休講',sidebarLinks:'メニューリンク',curriculumAbbreviations:'カリキュラム略称',lineVisibleAccounts:'LINE表示対象',lineSnippets:'LINE定型文',lineEmojis:'LINE絵文字'});
function equal(a:any,b:any):boolean{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
}
function record(value:any){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
export function retainConflictChoices(previous:Conflict[],next:Conflict[],choices:ConflictChoices):ConflictChoices{
 const retained:ConflictChoices={};
 for(const conflict of next){
  const old=previous.find(item=>item.id===conflict.id);
  if(old&&choices[conflict.id]&&equal(old.base,conflict.base)&&equal(old.local,conflict.local)&&equal(old.remote,conflict.remote))retained[conflict.id]=choices[conflict.id];
 }
 return retained;
}
const keyed=new Set(['students','lessons','slots','teachers','preferences','workAssignments']);
function identity(item:any,kind:string){return item?.id||(kind==='teachers'?item?.name:undefined)}
/** Merge only changes relative to the snapshot the user actually edited. */
export function mergeSchedule(base:State,local:State,remote:State,choices:Record<string,'local'|'remote'>={}):MergeResult{
 const conflicts:Conflict[]=[];
 function visit(b:any,l:any,r:any,path:string[],label:string):any{
  if(equal(l,b))return r;
  if(equal(r,b)||equal(l,r))return l;
  if(path.length===1&&path[0]==='history'&&Array.isArray(l)&&Array.isArray(r)){
   const added=l.filter(item=>!(b||[]).some((old:any)=>equal(item,old)));
   return [...added,...r].filter((item,index,all)=>all.findIndex(other=>equal(item,other))===index).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100);
  }
  if(path.length===1&&keyed.has(path[0])&&[b,l,r].every(Array.isArray)){
   const kind=path[0],valid=[b,l,r].every(items=>items.every((item:any)=>identity(item,kind))&&new Set(items.map((item:any)=>identity(item,kind))).size===items.length);
   if(valid){
    const maps=[b,l,r].map(items=>new Map<string,any>(items.map((item:any)=>[identity(item,kind),item])));
    return [...new Set([...r,...l].map(item=>identity(item,kind)))].map(id=>{
     const [old,mine,theirs]=maps.map(map=>map.get(id));
     const item=mine||theirs||old;
     return visit(old,mine,theirs,[...path,id],label+'：'+(item.name||item.date||id));
    }).filter(item=>item!==undefined);
   }
  }
  // Only the note is independent. Every other lesson field (including future
  // fields) stays atomic so assignment, transfers and parent requests stay safe.
  if(path[0]==='lessons'&&path.length===2&&[b,l,r].every(record)){
   const operational=[b,l,r].map(value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='note')));
   const schedule=visit(operational[0],operational[1],operational[2],[...path,'$schedule'],label+' / 授業予定');
   const note=visit(b.note,l.note,r.note,[...path,'note'],label+' / 授業メモ');
   return {...schedule,...(note===undefined?{}:{note})};
  }
  if([b,l,r].every(record)&&!(path[0]==='lessons'&&path[2]==='$schedule')&&!(path[0]==='workAssignments'&&path.length===2)){
   const result:Record<string,any>={};
   for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    const value=visit(b[key],l[key],r[key],[...path,key],label?label+' / '+(labels[key]||key):(labels[key]||key));
    if(value!==undefined)Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});
   }
   return result;
  }
  const id=JSON.stringify(path);
  if(choices[id])return choices[id]==='local'?l:r;
  conflicts.push({id,label,path,base:b,local:l,remote:r});
  return r;
 }
 const state=structuredClone(visit(base,local,remote,[],''));
 // A new local lesson must not resurrect a slot/student deleted remotely.
 // Leave unresolved conflicts selectable first; validate the chosen result afterwards.
 if(!conflicts.length){
  const slotIds=new Set(state.slots.map((slot:any)=>slot.id));
  const studentIds=new Set((state.students||[]).map((student:any)=>student.id));
  for(const work of state.workAssignments||[]){if(!slotIds.has(work.slot)||!state.teachers.some((teacher:State['teachers'][number])=>teacher.id===work.teacherId))throw Error('業務の時間帯またはスタッフがほかで削除されています。業務を確認してください。')}
  for(const lesson of state.lessons){
   if(!slotIds.has(lesson.slot)&&[...base.slots,...local.slots,...remote.slots].some(slot=>slot.id===lesson.slot))
    throw Error('授業枠がほかで削除されています。入力内容は保持しています。該当する授業を確認して保存し直してください。');
   if(lesson.studentId&&!studentIds.has(lesson.studentId)&&[...(base.students||[]),...(local.students||[]),...(remote.students||[])].some(student=>student.id===lesson.studentId))
    throw Error('生徒がほかで削除されています。入力内容は保持しています。該当する授業を確認して保存し直してください。');
  }
 }
 return {state,conflicts};
}

export type SaveOrigin={base:State;local:State};
export type SaveSummary={local:number;remote:number};
// Count net editing units, not object positions or generated history entries.
// Lesson operations and fixed work stay grouped; notes count independently.
function changeUnits(base:any,value:any,path:string[]=[],result=new Map<string,any>()){
 if(equal(base,value)||path[0]==='history')return result;
 if(path.length===1&&keyed.has(path[0])&&[base,value].every(Array.isArray)&&[base,value].every(items=>items.every((item:any)=>identity(item,path[0]))&&new Set(items.map((item:any)=>identity(item,path[0]))).size===items.length)){
  const maps=[base,value].map(items=>new Map<string,any>(items.map((item:any)=>[identity(item,path[0]),item])));
  for(const id of new Set([...maps[0].keys(),...maps[1].keys()]))changeUnits(maps[0].get(id),maps[1].get(id),[...path,id],result);
 }else if(path[0]==='lessons'&&path.length===2&&[base,value].every(record)){
  const ops=[base,value].map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='note')));
  changeUnits(ops[0],ops[1],[...path,'$schedule'],result);
  changeUnits(base.note,value.note,[...path,'note'],result);
 }else if([base,value].every(record)&&!(path[0]==='lessons'&&path[2]==='$schedule')&&!(path[0]==='workAssignments'&&path.length===2)){
  for(const key of new Set([...Object.keys(base),...Object.keys(value)]))changeUnits(base[key],value[key],[...path,key],result);
 }else result.set(JSON.stringify(path),value);
 return result;
}
export function summarizeSave(origin:SaveOrigin,state:State):SaveSummary{
 const requested=changeUnits(origin.base,origin.local),applied=changeUnits(origin.base,state);
 const summary={local:0,remote:0};
 for(const [path,value] of applied){
  if(requested.has(path)&&equal(requested.get(path),value))summary.local++;
  else summary.remote++;
 }
 return summary;
}
export function saveSummaryMessage(summary:SaveSummary){
 return summary.remote?`自分の変更${summary.local}項目と、ほかの変更${summary.remote}項目を反映しました。`:`自分の変更${summary.local}項目を反映しました。`;
}
export type SaveConflict={kind:'conflict';base:State;local:State;remote:State;revision:number;conflicts:Conflict[];origin:SaveOrigin};
export async function saveWithMerge(
 fetcher:typeof fetch,base:State,local:State,revision:number,normalize:(state:State)=>State=state=>state,origin:SaveOrigin={base,local}
):Promise<{kind:'saved';state:State;revision:number;merged:boolean;summary:SaveSummary}|SaveConflict>{
 let merged=origin.base!==base;
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetcher('/api/schedule',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,state:local})});
  const result=await response.json();
  if(response.ok)return {kind:'saved',state:local,revision:result.revision,merged,summary:summarizeSave(origin,local)};
  if(response.status!==409)throw Error(result.error||'保存できませんでした');
  const latest=await fetcher('/api/schedule',{cache:'no-store'});
  const current=await latest.json();
  if(!latest.ok)throw Error(current.error||'最新の変更を取得できませんでした。入力内容は保持しています。');
  const remote=normalize(current.state),comparison=mergeSchedule(base,local,remote);
  if(comparison.conflicts.length)return {kind:'conflict',base,local,remote,revision:current.revision,conflicts:comparison.conflicts,origin};
  base=remote;local=comparison.state;revision=current.revision;merged=true;
 }
 throw Error('更新が続いているため保存を完了できませんでした。入力内容は保持しています。少し待って再度保存してください。');
}

export function conflictValue(value:any):string{
 if(value===undefined)return '削除';
 if(value===null)return '未設定';
 if(typeof value==='boolean')return value?'はい':'いいえ';
 if(typeof value==='object'){
  if(Array.isArray(value))return value.map(conflictValue).join('、')||'なし';
  return Object.entries(value).filter(([key])=>!['id','studentId'].includes(key)).map(([key,v])=>(labels[key]||key)+'：'+conflictValue(v)).join(' / ');
 }
 return String(value)||'空欄';
}

export type ConflictRow={label:string;base:string;local:string;remote:string;localChanged:boolean;remoteChanged:boolean};
export function describeConflict(conflict:Conflict,states:{base:State;local:State;remote:State}){
 const all=[states.base,states.local,states.remote];
 const [kind,id]=conflict.path;
 const findItem=(state:State)=>(state as any)[kind]?.find?.((item:any)=>identity(item,kind)===id);
 const item=all.map(findItem).find(Boolean);
 function slotLabel(value:string,state:State){
  const slot=[state,...all].flatMap(s=>s.slots).find(slot=>slot.id===value);
  return slot?[slot.date,slot.start&&`${slot.start}–${slot.end}`,slot.room].filter(Boolean).join(' · '):'見つからない授業枠';
 }
 function format(value:any,key:string,state:State):string{
  if(value===undefined||value===null||value==='')return '未設定';
  if(key==='slot')return slotLabel(value,state);
  if(key==='studentId')return [state,...all].flatMap(s=>s.students||[]).find(s=>s.id===value)?.name||'見つからない生徒';
  if(key==='teacherId')return [state,...all].flatMap(s=>s.teachers).find(t=>t.id===value)?.name||'見つからないスタッフ';
  if(key==='preferredSlots'&&Array.isArray(value))return value.map(id=>slotLabel(id,state)).join('、')||'なし';
  if(key==='absent')return value?'欠席':'出席';
  if(kind==='availability'&&typeof value==='string')return ({yes:'出勤可能',reserve:'不足時のみ',no:'出勤不可'} as Record<string,string>)[value]||value;
  if(Array.isArray(value))return value.map(item=>format(item,key,state)).join('、')||'なし';
  if(record(value))return Object.entries(value).filter(([k])=>k!=='id').map(([k,v])=>`${labels[k]||k}：${format(v,k,state)}`).join(' / ')||'なし';
  return conflictValue(value);
 }
 let title=conflict.label,context='';
 if(item){
  title=(labels[kind]||kind)+'：'+(item.name||item.title||item.date||'対象の項目');
  context=kind==='slots'?slotLabel(item.id,states.base):item.slot?slotLabel(item.slot,states.base):item.room||'';
  if(conflict.path.length>2)title+=' / '+(conflict.path[2]==='$schedule'?'授業予定':labels[conflict.path.at(-1)!]||conflict.path.at(-1));
 }else if(kind==='availability'||kind==='duty'){
  const separator=id.indexOf('|');title=(labels[kind]||kind)+'：'+id.slice(0,separator);
  context=slotLabel(id.slice(separator+1),states.base);
 }
 const rows:ConflictRow[]=[];
 function add(key:string,b:any,l:any,r:any,label=labels[key]||key){
  if(equal(b,l)&&equal(b,r))return;
  rows.push({label,base:format(b,key,states.base),local:format(l,key,states.local),remote:format(r,key,states.remote),localChanged:!equal(b,l),remoteChanged:!equal(b,r)});
 }
 const {base,local,remote}=conflict;
 if([base,local,remote].some(record)){
  if(local===undefined||remote===undefined){
   rows.push({label:'登録状態',base:'登録済み',local:local===undefined?'削除':'保持して更新',remote:remote===undefined?'削除':'保持して更新',localChanged:local===undefined,remoteChanged:remote===undefined});
  }
  for(const key of new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})])){
   if(key==='id')continue;
   // For deletion conflicts show what the surviving edit changes, not every field.
   if((local===undefined||remote===undefined)&&equal(base?.[key],(local||remote)?.[key]))continue;
   add(key,base?.[key],local?.[key],remote?.[key]);
  }
 }else add(conflict.path.at(-1)!,base,local,remote,labels[conflict.path.at(-1)!]||labels[kind]||conflict.label);
 return {title,context,rows};
}

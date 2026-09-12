import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exports={};new Function('exports',ts.transpileModule(readFileSync('lib/schedule-merge.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const {mergeSchedule,saveWithMerge}=exports;
const initial=()=>({students:[{id:'a',name:'A',room:'校舎',course:'Scratch'},{id:'b',name:'B',room:'校舎'}],slots:[{id:'s',date:'2026-09-01'}],lessons:[{id:'l',slot:'s',name:'A',teacher:'先生',absent:false}],teachers:[],preferences:[],availability:{},duty:{},history:[]});
test('different students and fields combine, preserving remote additions and deletions',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.students[0].name='編集';remote.students[0].course='Swift';remote.students.pop();remote.students.push({id:'c',name:'追加'});
 const result=mergeSchedule(base,local,remote);
 assert.equal(result.conflicts.length,0);
 assert.deepEqual(result.state.students,[{...local.students[0],course:'Swift'},{id:'c',name:'追加'}]);
});
test('same field conflicts require a choice, including deletion versus modification',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.students[0].name='自分';remote.students[0].name='最新';
 const result=mergeSchedule(base,local,remote);assert.equal(result.conflicts.length,1);
 for(const side of ['local','remote']){
  const resolved=mergeSchedule(base,local,remote,{[result.conflicts[0].id]:side});
  assert.equal(resolved.conflicts.length,0);assert.equal(resolved.state.students[0].name,side==='local'?'自分':'最新');
 }
 remote.students.shift();const deleted=mergeSchedule(base,local,remote);assert.equal(deleted.conflicts.length,1);
 const keepDeletion=mergeSchedule(base,local,remote,{[deleted.conflicts[0].id]:'remote'});assert.equal(keepDeletion.state.students.some(s=>s.id==='a'),false);
});
test('parent request and assignment on the same lesson remain one explicit conflict',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.lessons[0].teacher='別の先生';Object.assign(remote.lessons[0],{request:'振替希望',requestData:{kind:'change'},teacher:'',absent:true});
 const result=mergeSchedule(base,local,remote);assert.equal(result.conflicts.length,1);assert.deepEqual(result.state.lessons,remote.lessons);
 local.lessons=base.lessons;local.students[0].name='更新';
 assert.deepEqual(mergeSchedule(base,local,remote).state.lessons,remote.lessons);
});
test('independent shift keys and history entries merge without dropping remote history',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.availability['A|s']='yes';remote.availability['B|s']='no';
 local.history=[{at:'2026-09-02',text:'自分'}];remote.history=[{at:'2026-09-03',text:'保護者'}];
 const result=mergeSchedule(base,local,remote);
 assert.deepEqual(result.state.availability,{'A|s':'yes','B|s':'no'});assert.equal(result.state.history.length,2);
 assert.deepEqual(base,initial());
});
test('normalization order and identical edits do not create false conflicts',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.students.reverse();remote.students[0].name='更新';
 assert.equal(mergeSchedule(base,local,remote).conflicts.length,0);
 local.students=structuredClone(remote.students);assert.equal(mergeSchedule(base,local,remote).conflicts.length,0);
});
test('saving retries 409 with a fresh revision and both edits; repeated races stay bounded',async()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students[0].name='自分';remote.students[1].name='最新';
 const calls=[];let writes=0;
 const fetcher=async(url,options)=>{
  calls.push(options);
  if(options.method==='PUT'){writes++;return writes===1?Response.json({},{status:409}):Response.json({revision:3})}
  return Response.json({state:remote,revision:2});
 };
 const result=await saveWithMerge(fetcher,base,local,1);
 assert.equal(result.kind,'saved');assert.equal(result.merged,true);
 const retry=JSON.parse(calls[2].body);assert.equal(retry.revision,2);assert.equal(retry.state.students[0].name,'自分');assert.equal(retry.state.students[1].name,'最新');
 let attempts=0;await assert.rejects(()=>saveWithMerge(async(url,options)=>{if(options.method==='PUT'){attempts++;return Response.json({},{status:409})}return Response.json({state:remote,revision:attempts+1})},base,local,1),/入力内容は保持/);assert.equal(attempts,3);
});
test('conflicts do not write again until chosen, and unauthorized reads never retry a write',async()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students[0].name='自分';remote.students[0].name='最新';
 let writes=0;
 const result=await saveWithMerge(async(url,options)=>{if(options.method==='PUT'){writes++;return Response.json({},{status:409})}return Response.json({state:remote,revision:2})},base,local,1);
 assert.equal(result.kind,'conflict');assert.equal(writes,1);
 await assert.rejects(()=>saveWithMerge(async(url,options)=>options.method==='PUT'?Response.json({},{status:409}):Response.json({error:'権限なし'},{status:403}),base,local,1),/権限なし/);
 assert.equal(local.students[0].name,'自分');
});
test('a second race after choosing a value is compared against the new base',async()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students[0].name='自分';remote.students[0].name='最新版';
 const conflict=mergeSchedule(base,local,remote);
 const chosen=mergeSchedule(base,local,remote,{[conflict.conflicts[0].id]:'local'}).state;
 const newer=structuredClone(remote);newer.students[0].name='さらに更新';
 const result=await saveWithMerge(async(url,options)=>options.method==='PUT'?Response.json({},{status:409}):Response.json({state:newer,revision:3}),remote,chosen,2);
 assert.equal(result.kind,'conflict');assert.equal(result.conflicts[0].remote,'さらに更新');
});
test('new local lessons cannot reference slots removed by another writer',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.lessons.push({id:'new',slot:'s',name:'追加'});remote.slots=[];remote.lessons=[];
 assert.throws(()=>mergeSchedule(base,local,remote),/授業枠がほかで削除/);
 assert.equal(local.lessons.length,2);
});

test('comparison shows changed fields and resolves lesson times without internal slot IDs',()=>{
 const base=initial();Object.assign(base.slots[0],{room:'本社校',start:'16:45',end:'18:15'});base.slots.push({id:'new-slot',date:'2026-09-02',room:'別校',start:'10:00',end:'11:30'});
 const local=structuredClone(base),remote=structuredClone(base);local.lessons[0].teacher='新担当';remote.lessons[0].slot='new-slot';
 const result=mergeSchedule(base,local,remote),view=exports.describeConflict(result.conflicts[0],{base,local,remote});
 assert.match(view.title,/授業：A/);assert.match(view.context,/2026-09-01.*16:45.*本社校/);
 assert.deepEqual(view.rows.map(row=>row.label).sort(),['担当','授業日時・教室'].sort());
 const time=view.rows.find(row=>row.label==='授業日時・教室');assert.match(time.remote,/2026-09-02.*10:00.*別校/);assert.equal(time.localChanged,false);assert.equal(time.remoteChanged,true);
 assert.equal(JSON.stringify(view).includes('new-slot'),false);
});
test('deletion comparison explicitly identifies deletion and the competing edit',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students.shift();remote.students[0].name='変更された名前';
 const result=mergeSchedule(base,local,remote),view=exports.describeConflict(result.conflicts[0],{base,local,remote});
 assert.equal(view.title,'生徒：A');assert.equal(view.rows[0].local,'削除');assert.equal(view.rows[1].remote,'変更された名前');assert.equal(view.rows.length,2);
});
test('choice retention requires unchanged base and both alternatives, not just the conflict ID',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students[0].name='自分';remote.students[0].name='相手';local.students[1].name='自分B';remote.students[1].name='相手B';
 const first=mergeSchedule(base,local,remote).conflicts,choices=Object.fromEntries(first.map(c=>[c.id,'local']));
 assert.deepEqual(exports.retainConflictChoices(first,structuredClone(first),choices),choices);
 remote.students[0].name='相手の再編集';let next=mergeSchedule(base,local,remote).conflicts;
 assert.deepEqual(exports.retainConflictChoices(first,next,choices),{[first[1].id]:'local'});
 local.students[1].name='自分の再編集';next=mergeSchedule(base,local,remote).conflicts;
 assert.deepEqual(exports.retainConflictChoices(first,next,choices),{});
 assert.deepEqual(exports.retainConflictChoices(first,[],choices),{});
});
test('notes merge with operational changes, but two different notes still need a choice',()=>{
 const base=initial();base.lessons[0].note='元のメモ';const local=structuredClone(base),remote=structuredClone(base);
 local.lessons[0].note='追記';remote.lessons[0].teacher='別の先生';
 let result=mergeSchedule(base,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.state.lessons[0].note,'追記');assert.equal(result.state.lessons[0].teacher,'別の先生');
 remote.lessons[0].note='別の追記';result=mergeSchedule(base,local,remote);assert.equal(result.conflicts.length,1);assert.equal(result.conflicts[0].path.at(-1),'note');
 const chosen=mergeSchedule(base,local,remote,{[result.conflicts[0].id]:'local'});assert.equal(chosen.state.lessons[0].teacher,'別の先生');assert.equal(chosen.state.lessons[0].note,'追記');
});
test('choosing lesson operations preserves independently merged notes, including clearing a note',()=>{
 const base=initial();base.lessons[0].note='元';const local=structuredClone(base),remote=structuredClone(base);
 local.lessons[0].teacher='自分の担当';local.lessons[0].note='';Object.assign(remote.lessons[0],{absent:true,teacher:'',request:'欠席連絡'});
 const conflicts=mergeSchedule(base,local,remote).conflicts;assert.equal(conflicts.length,1);assert.equal(conflicts[0].path.at(-1),'$schedule');
 const chosen=mergeSchedule(base,local,remote,{[conflicts[0].id]:'remote'}).state;
 assert.equal(chosen.lessons[0].absent,true);assert.equal(chosen.lessons[0].teacher,'');assert.equal(chosen.lessons[0].note,'');
});
test('deleting a lesson still conflicts with a note edit and does not resurrect it silently',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.lessons[0].note='大切なメモ';remote.lessons=[];
 const result=mergeSchedule(base,local,remote);assert.equal(result.conflicts.length,1);
 assert.equal(mergeSchedule(base,local,remote,{[result.conflicts[0].id]:'remote'}).state.lessons.length,0);
});
test('net summaries exclude reordering/history and count only retained changes',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);
 local.students[0].name='自分';local.lessons[0].note='自分のメモ';local.students.reverse();local.history=[{at:'2026-09-02',text:'変更'}];
 remote.students[0].name='相手';remote.students[1].course='Swift';remote.lessons[0].teacher='別担当';
 const conflict=mergeSchedule(base,local,remote).conflicts[0];
 const final=mergeSchedule(base,local,remote,{[conflict.id]:'remote'}).state;
 const summary=exports.summarizeSave({base,local},final);
 assert.deepEqual(summary,{local:1,remote:3});assert.match(exports.saveSummaryMessage(summary),/自分の変更1項目.*ほかの変更3項目/);
 assert.deepEqual(exports.summarizeSave({base,local:base},base),{local:0,remote:0});
});
test('save summary keeps the original editing baseline across conflict resolution and another retry',async()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.students[0].name='自分';remote.students[0].name='相手';remote.students[1].course='Swift';
 const pending=await saveWithMerge(async(url,options)=>options.method==='PUT'?Response.json({},{status:409}):Response.json({state:remote,revision:2}),base,local,1);
 const resolved=mergeSchedule(pending.base,pending.local,pending.remote,{[pending.conflicts[0].id]:'remote'}).state;
 const newer=structuredClone(remote);newer.lessons[0].note='新しいメモ';let writes=0;
 const result=await saveWithMerge(async(url,options)=>options.method==='PUT'?(++writes===1?Response.json({},{status:409}):Response.json({revision:4})):Response.json({state:newer,revision:3}),resolved,resolved,2,s=>s,pending.origin);
 assert.equal(result.kind,'saved');assert.equal(result.merged,true);assert.deepEqual(result.summary,{local:0,remote:3});
});

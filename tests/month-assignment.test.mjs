import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}
const {autoAssign,monthAssignmentScope,issues}=load('lib/scheduler.ts');
function fixture(){
 const slots=[['past','2026-09-08','R'],['today','2026-09-09','R'],['future','2026-09-16','R'],['next','2026-10-01','R'],['other','2026-09-12','Other']].map(([id,date,room])=>({id,date,room,start:'09:00',end:'10:30'}));
 return {slots,lessons:slots.map(slot=>({id:slot.id,slot:slot.id,name:slot.id,course:'C',teacher:'Old',note:'preserve',absent:false,exam:false})),teachers:[{name:'New',autoAttendance:true,canSuperviseExam:true,max:3,rooms:['R'],curricula:['C']}],availability:Object.fromEntries(slots.map(slot=>['New|'+slot.id,'yes'])),duty:Object.fromEntries(slots.map(slot=>['Old|'+slot.id,true])),history:[]};
}
test('monthly assignment preserves past lessons and duty while assigning today and future dates',()=>{
 const s=fixture(),before=structuredClone(s),scope=monthAssignmentScope(s,'R','2026-09',new Date('2026-09-08T15:00:00Z'));
 assert.deepEqual(scope,['today','future']);
 const result=autoAssign(s,scope).state;
 for(const id of ['past','next','other']){assert.deepEqual(result.lessons.find(l=>l.id===id),s.lessons.find(l=>l.id===id));assert.equal(result.duty['Old|'+id],true)}
 for(const id of scope){assert.equal(result.lessons.find(l=>l.id===id).teacher,'New');assert.equal(result.duty['Old|'+id],undefined)}
 assert.deepEqual(s,before);
});
test('a past month is a no-op and a future month retains all its slots',()=>{
 const s=fixture(),now=new Date('2026-10-01T00:00:00+09:00');
 assert.deepEqual(autoAssign(s,monthAssignmentScope(s,'R','2026-09',now)).state,s);
 assert.deepEqual(monthAssignmentScope(s,'R','2026-10',new Date('2026-09-09T00:00:00+09:00')),['next']);
});
test('monthly cutoff follows Japan midnight at each invocation',()=>{
 const s=fixture();
 assert.deepEqual(monthAssignmentScope(s,'R','2026-09',new Date('2026-09-08T14:59:59Z')),['past','today','future']);
 assert.deepEqual(monthAssignmentScope(s,'R','2026-09',new Date('2026-09-08T15:00:00Z')),['today','future']);
});
test('assignment reasons describe actual assignment steps and omit unchanged lessons',()=>{
 const s=fixture();s.lessons.find(l=>l.id==='today').teacher='';
 const result=autoAssign(s,['today']);
 assert.match(result.reasons.today,/担当未定の授業に担当を設定/);
 assert.match(result.reasons.today,/勤務パターンと担当科目/);
 assert.deepEqual(Object.keys(result.reasons),['today']);
 const same=autoAssign(result.state,['today']);assert.deepEqual(same.reasons,{});
});
test('assignment reasons explain unavailable original teachers and unresolved assignments',()=>{
 const s=fixture();s.teachers.push({...s.teachers[0],name:'Old'});s.availability['Old|today']='no';
 assert.match(autoAssign(s,['today']).reasons.today,/元の担当者が出勤不可/);
 s.availability['New|today']='no';
 const result=autoAssign(s,['today']);assert.equal(result.state.lessons.find(l=>l.id==='today').teacher,'');
 assert.match(result.reasons.today,/この案では見つからないため担当未定/);
});
test('valid three-to-one staffing is retained instead of balancing for its own sake',()=>{
 const s=fixture();s.slots=s.slots.filter(slot=>slot.id==='today');
 s.teachers=['A','B'].map(name=>({name,autoAttendance:false,canSuperviseExam:false,max:3,rooms:['R'],curricula:['C']}));
 s.lessons=[0,1,2].map(id=>({...s.lessons[0],id:String(id),slot:'today',teacher:'A'}));
 s.availability={'A|today':'yes','B|today':'yes'};s.duty={'A|today':true,'B|today':true};
 // Both teachers must have a scheduled block before balancing can move lessons.
 s.lessons.push({...s.lessons[0],id:'3',teacher:'B'});
 const result=autoAssign(s,['today']);
 assert.deepEqual(result.state.lessons,s.lessons);assert.deepEqual(result.reasons,{});
});

function repairFixture(){
 const slots=Array.from({length:5},(_,i)=>({id:'s'+i,room:'R',date:'2026-09-12',start:String(9+i*2).padStart(2,'0')+':00',end:String(10+i*2).padStart(2,'0')+':00'}));
 const teachers=['Early','Late'].map(name=>({name,max:3,rooms:['R'],curricula:['C']}));
 return {slots,teachers,lessons:slots.flatMap(slot=>Array.from({length:3},(_,i)=>({id:slot.id+i,slot:slot.id,name:slot.id+i,course:'C',teacher:'',note:'',absent:false,exam:false}))),availability:Object.fromEntries(slots.flatMap((slot,i)=>[['Early|'+slot.id,i<4?'yes':'no'],['Late|'+slot.id,i>=3?'yes':'no']])),duty:{},history:[]};
}
test('rebuild shortens 1–4 to 1–3 and activates 4–5 to cover all pupils',()=>{
 const s=repairFixture(),before=structuredClone(s),result=autoAssign(s,s.slots.map(sl=>sl.id));
 assert.equal(result.assigned,15);assert.deepEqual(issues(result.state),[]);
 for(const lesson of result.state.lessons)assert.equal(lesson.teacher,Number(lesson.slot.slice(1))<3?'Early':'Late');
 assert.equal(result.state.duty['Early|s3'],undefined);
 assert.deepEqual(s,before);
});
test('fill never moves existing teachers to activate a new block',()=>{
 const s=repairFixture();s.lessons.filter(l=>l.slot!=='s4').forEach(l=>l.teacher='Early');
 const result=autoAssign(s,s.slots.map(sl=>sl.id),'fill');
 assert.equal(result.assigned,0);assert.deepEqual(result.state.lessons,s.lessons);
});
test('repair respects unavailable, curriculum, exam, fixed staff and overlap constraints',()=>{
 for(const block of [s=>s.availability['Late|s3']='no',s=>s.teachers[1].curricula=[],s=>s.lessons.filter(l=>l.slot==='s3').forEach(l=>l.exam=true),s=>{s.teachers[0].autoAssignLessons=false;s.lessons.filter(l=>l.slot!=='s4').forEach(l=>l.teacher='Early')},s=>{s.slots.push({...s.slots[3],id:'other',room:'Other'});s.duty['Late|other']=true}]){
  const s=repairFixture();s.teachers[0].canSuperviseExam=true;block(s);
  const result=autoAssign(s,['s0','s1','s2','s3','s4']);
  if(s.teachers[0].autoAssignLessons===false)assert.ok(result.state.lessons.every(l=>l.teacher!=='Early'));
  else assert.ok(result.state.lessons.filter(l=>l.slot==='s4').every(l=>!l.teacher));
 }
});
test('repair will not leave a donor with an isolated teaching period',()=>{
 const s=repairFixture();s.slots=s.slots.slice(2);s.lessons=s.lessons.filter(l=>['s2','s3','s4'].includes(l.slot));
 s.teachers.forEach(t=>t.max=1);s.lessons=s.lessons.filter(l=>l.id.endsWith('0'));
 const result=autoAssign(s,s.slots.map(sl=>sl.id));
 assert.equal(result.state.lessons.filter(l=>!l.teacher).length,1);
 assert.equal(issues(result.state).filter(i=>i.text.includes('連続')).length,0);
});

test('rebuild fills a gap while retaining existing valid teachers',()=>{
 const s=repairFixture();s.slots.forEach(sl=>sl.date='2026-10-07');
 s.lessons.forEach(l=>l.teacher=Number(l.slot.slice(1))<3?'Early':'Late');s.lessons.at(-1).teacher='';
 const result=autoAssign(s,s.slots.map(sl=>sl.id));
 for(const l of s.lessons.filter(l=>l.teacher))assert.equal(result.state.lessons.find(n=>n.id===l.id).teacher,l.teacher);
 assert.equal(result.state.lessons.at(-1).teacher,'Late');
});
test('rebuild does not retain invalid unavailable assignments merely to avoid changes',()=>{
 const s=repairFixture();s.slots.forEach(sl=>sl.date='2026-10-07');
 s.lessons.forEach(l=>l.teacher='Early');
 const result=autoAssign(s,s.slots.map(sl=>sl.id));
 assert.equal(result.state.lessons.filter(l=>l.slot==='s4').every(l=>l.teacher==='Late'),true);
 assert.deepEqual(issues(result.state),[]);
});

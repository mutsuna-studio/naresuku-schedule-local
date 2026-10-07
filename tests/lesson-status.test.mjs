import test from 'node:test';
test.mock.timers.enable({apis:['Date'],now:new Date('2026-09-09T12:00:00+09:00')});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
function createLoader(){const cache=new Map();function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}return load}

const load=createLoader();
const {lessonStatus,lessonNeedsAction,normalizeLessonStatuses,canRequestTransfer,openTransferAcceptance,transitionLesson,completeLessonTransfer,validLessonStatuses}=load('lib/lesson-status.ts');
const {studentScheduleStatus,setStudentScheduleStatus}=load('lib/student-schedule-status.ts');
const {mergeSchedule}=load('lib/schedule-merge.ts');
const now=Date.now(),date=(offset)=>new Date(now+offset*86400000).toISOString().slice(0,10),month=date(-2).slice(0,7),expiry=new Date(now+86400000).toISOString();
function fixture(){return {students:[{id:'s',name:'S',room:'R',course:'C',monthlyLessons:2,periods:[]},{id:'other',name:'Other',room:'R',course:'C',monthlyLessons:2,periods:[]}],slots:[{id:'source',room:'R',date:date(-2),start:'10:00',end:'11:00'},...[1,2,3].map(i=>({id:'target'+i,room:'R',date:date(i),start:'10:00',end:'11:00'}))],lessons:[{id:'l',studentId:'s',name:'S',course:'C',slot:'source',teacher:'T',absent:false,note:''},{id:'l2',studentId:'s',name:'S',course:'C',slot:'source',teacher:'T',absent:false,note:''},{id:'other',studentId:'other',name:'Other',course:'C',slot:'source',teacher:'',absent:true,note:''}],teachers:[{id:'t',name:'T',rooms:['R'],curricula:['C'],max:3}],availability:{'T|target1':'yes','T|target2':'yes','T|target3':'yes'},duty:{'T|source':true,'T|target1':true,'T|target2':true,'T|target3':true},history:[]}}
const stage=s=>studentScheduleStatus(s,s.students[0],month);
test('legacy normalization is idempotent, status controls capacity, and confirmed months survive migration',()=>{
 const s=fixture();setStudentScheduleStatus(s,'s',month,'confirmed','admin');normalizeLessonStatuses(s);assert.equal(stage(s).status,'confirmed');const before=structuredClone(s);normalizeLessonStatuses(s);assert.deepEqual(s,before);
 s.lessons[0].status='transfer_waiting';s.lessons[0].transferAcceptance={expiresAt:expiry,openedAt:new Date(now).toISOString(),openedBy:'admin'};s.lessons[0].absent=false;normalizeLessonStatuses(s);assert.equal(s.lessons[0].absent,true);assert.equal(stage(s).pending,1);
 for(const [request,status] of [['欠席｜理由：体調不良','absence_requested'],['振替希望','transfer_requested']])assert.equal(lessonStatus({request,absent:false}),status);
});
test('opening special acceptance releases the original slot immediately and reopens the contract month with date protection',()=>{
 const s=fixture();setStudentScheduleStatus(s,'s',month,'confirmed','admin');openTransferAcceptance(s,'l',expiry,'admin',now);
 assert.equal(lessonStatus(s.lessons[0]),'transfer_waiting');assert.equal(s.lessons[0].teacher,'');assert.equal(s.lessons[0].absent,true);assert.equal(s.duty['T|source'],true);assert.equal(s.lessons[0].requestRestore.teacher,'T');
 assert.equal(stage(s).status,'adjusting');assert.equal(stage(s).canAdvance,false);assert.equal(s.students[0].scheduleStatuses[month].datesLocked,true);assert.throws(()=>setStudentScheduleStatus(s,'s',month,'confirmed','admin'));
 openTransferAcceptance(s,'l2',expiry,'admin',now);assert.equal(s.duty['T|source'],undefined);
});
test('special deadline applies only to that lesson; expiry never restores the reservation and renewal preserves original teacher',()=>{
 const s=fixture();openTransferAcceptance(s,'l',expiry,'admin',now);assert.ok(canRequestTransfer(s.lessons[0],date(-2),'none',now));assert.equal(canRequestTransfer(s.lessons[1],date(-2),'illness',now),false);
 assert.equal(canRequestTransfer(s.lessons[0],date(-2),'illness',now+2*86400000),false);normalizeLessonStatuses(s);assert.equal(s.lessons[0].teacher,'');assert.ok(lessonNeedsAction(s.lessons[0]));
 openTransferAcceptance(s,'l',new Date(now+3*86400000).toISOString(),'admin',now);assert.equal(s.lessons[0].requestRestore.teacher,'T');
 transitionLesson(s,s.lessons[0],'absent');assert.equal(s.lessons[0].transferAcceptance,undefined);assert.equal(canRequestTransfer(s.lessons[0],date(2),'none',now),false);
});
test('cross-month transfer resolves the same workflow and leaves the original month adjusting until reconfirmed',()=>{
 const s=fixture();setStudentScheduleStatus(s,'s',month,'confirmed','admin');openTransferAcceptance(s,'l',expiry,'admin',now);transitionLesson(s,s.lessons[0],'transfer_requested');s.lessons[0].request='振替希望';s.lessons[0].requestData={kind:'振替希望',reason:'その他',preferredSlots:['target1','target2','later']};
 completeLessonTransfer(s,s.lessons[0],'target1');assert.equal(s.lessons[0].originalDate,date(-2));assert.equal(s.lessons[0].status,'scheduled');assert.equal(s.lessons[0].teacher,'');assert.equal(s.lessons[0].transferAcceptance,undefined);assert.equal(s.lessons[0].requestData,undefined);assert.match(s.lessons[0].note,/振替希望/);assert.equal(stage(s).status,'adjusting');assert.ok(stage(s).canAdvance);
});
test('absence acknowledgement uses the same state transition and cancellation cannot revive an old monthly confirmation',()=>{
 const s=fixture();setStudentScheduleStatus(s,'s',month,'confirmed','admin');transitionLesson(s,s.lessons[0],'absence_requested');s.lessons[0].request='欠席｜理由：体調不良';assert.equal(stage(s).canAdvance,false);assert.ok(load('lib/reject-request.ts').acknowledgeAbsenceRequest(s,'l'));assert.equal(lessonStatus(s.lessons[0]),'absent');assert.equal(stage(s).status,'adjusting');assert.ok(stage(s).canAdvance);assert.equal(s.lessons[0].teacher,'');
});
test('conflicting grant and placement updates stay atomic while unrelated lesson notes merge',()=>{
 const base=fixture();normalizeLessonStatuses(base);const local=structuredClone(base),remote=structuredClone(base);openTransferAcceptance(local,'l',expiry,'admin',now);completeLessonTransfer(remote,remote.lessons[0],'target1');const merged=mergeSchedule(base,local,remote);assert.ok(merged.conflicts.some(c=>c.path.includes('$schedule')));
});
test('invalid states and missing or malformed acceptance metadata are rejected',()=>{
 for(const patch of [{status:'unknown'},{status:'transfer_waiting',absent:true},{status:'scheduled',absent:true},{status:'scheduled',absent:false,request:'振替希望'},{status:'transfer_waiting',absent:true,transferAcceptance:{expiresAt:'bad',openedAt:'bad',openedBy:'admin'}}]){const s=fixture();Object.assign(s.lessons[0],patch);assert.equal(validLessonStatuses(s),false)}
 const s=fixture();openTransferAcceptance(s,'l',expiry,'admin',now);assert.ok(validLessonStatuses(s));
});

function applyLocalEdit(state,patch){
 const script=readFileSync('ui/App.svelte','utf8').split('<script lang="ts">')[1].split('</script>')[0];
 const ast=ts.createSourceFile('app.ts',script,ts.ScriptTarget.Latest,true);
 const handler=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='updateLesson').getText(ast);
 const next=structuredClone(state),scope={auth:'admin',edit:{...state.lessons[0],...patch},s:state,$state:{snapshot:structuredClone},slotLocked:()=>false,workConflict:()=>false,showErrorToast:message=>{throw Error(message)},pastScheduleMessage:'protected',lessonStatus,transitionLesson,completeLessonTransfer,key:(name,id)=>name+'|'+id,change:fn=>{fn(next);load('lib/settings.ts').ensureSettings(next);return true}};
 vm.runInNewContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nupdateLesson();',scope);
 return next;
}
test('local request editing releases capacity and reopens a confirmed month',()=>{
 for(const [request,status] of [['欠席｜理由：体調不良','absence_requested'],['振替希望','transfer_requested']]){
  const state=fixture();normalizeLessonStatuses(state);setStudentScheduleStatus(state,'s',month,'confirmed','admin');
  const next=applyLocalEdit(state,{request});
  assert.equal(next.lessons[0].status,status);assert.equal(next.lessons[0].teacher,'');assert.equal(next.lessons[0].absent,true);assert.equal(next.lessons[0].requestRestore.status,'scheduled');assert.equal(stage(next).status,'adjusting');assert.equal(stage(next).pending,1);assert.ok(validLessonStatuses(next));
 }
});
test('clearing a local request resolves its state without resurrecting released staff',()=>{
 const state=fixture();normalizeLessonStatuses(state);transitionLesson(state,state.lessons[0],'transfer_requested');state.lessons[0].request='振替希望';
 const next=applyLocalEdit(state,{request:''});assert.equal(next.lessons[0].status,'scheduled');assert.equal(next.lessons[0].absent,false);assert.equal(next.lessons[0].teacher,'');assert.equal(stage(next).pending,0);assert.ok(validLessonStatuses(next));
});

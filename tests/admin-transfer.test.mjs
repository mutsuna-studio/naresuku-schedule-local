import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}
const {adminTransferCandidates,transferMessage,transferAcceptanceMessage}=load('lib/admin-transfer.ts');
const now=Date.parse('2026-09-08T00:00:00+09:00');
function fixture(){return {slots:[{id:'a',room:'R',date:'2026-09-10',start:'09:00',end:'10:30'},{id:'b',room:'R',date:'2026-09-20',start:'09:00',end:'10:30'},{id:'c',room:'R',date:'2026-10-20',start:'09:00',end:'10:30'}],students:[{id:'s',name:'S',room:'R',periods:[]}],lessons:[{id:'l',studentId:'s',name:'S',slot:'a',course:'C',absent:false,teacher:''}],teachers:[{name:'T',autoAttendance:false,canSuperviseExam:false,max:1,rooms:['R'],curricula:['C']}],availability:{'T|c':'yes'},duty:{'T|b':true},history:[]}}
test('returns configured candidates with staffing basis without changing schedule',()=>{const s=fixture(),before=structuredClone(s);assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>[c.id,c.basis]),[['b','confirmed'],['c','requested']]);assert.deepEqual(s,before);assert.deepEqual(adminTransferCandidates(s,'missing',now),[])});
test('excludes unavailable, full, unassigned capacity and overlapping student bookings',()=>{for(const extra of [{id:'other',name:'Other',teacher:'T'},{id:'other',name:'Other',teacher:''},{id:'other',name:'S',studentId:'s',teacher:''}]){const s=fixture();s.lessons.push({...extra,slot:'b',absent:false});assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>c.id),['c'])}const s=fixture();s.availability={'T|b':'no','T|c':'no'};assert.deepEqual(adminTransferCandidates(s,'l',now),[])});
test('excludes teacher conflicts in another room, enrollment breaks and expired dates',()=>{const s=fixture();s.slots.push({...s.slots[1],id:'other',room:'Other'});s.duty['T|other']=true;assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>c.id),['c']);s.students[0].periods=[{status:'paused',from:'2026-10',until:''}];assert.deepEqual(adminTransferCandidates(s,'l',now),[]);assert.deepEqual(adminTransferCandidates(fixture(),'l',Date.parse('2026-12-01')),[])});
test('two month deadline clamps month ends and keeps original date for transfers',()=>{const s=fixture();s.lessons[0].originalDate='2026-07-31';assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>c.id),['b']);s.lessons[0].originalDate='2026-07-19';assert.deepEqual(adminTransferCandidates(s,'l',now),[])});
test('reply follows the reference and groups selected times chronologically without mutating candidates',()=>{
 const source={...fixture().slots[0],date:'2026-09-05'};
 const candidates=[['2026-09-27','10:45'],['2026-09-13','15:15'],['2026-09-12','13:30'],['2026-09-27','09:00'],['2026-09-26','13:30'],['2026-09-13','13:30']].map(([date,start])=>({...source,date,start}));
 const before=structuredClone(candidates);
 assert.equal(transferMessage(source,candidates,new Date('2026-09-08T12:00:00+09:00')),`こんにちは！いつもお世話になっております😊
9月5日のお休みについて承知いたしました。
振替日時についてですが、以下の日程でご都合のよろしい日時はございますでしょうか？

9月12日(土) 13:30~
9月13日(日) 13:30~,15:15~
9月26日(土) 13:30~
9月27日(日) 09:00~,10:45~

ご確認のほどよろしくお願いいたします🙇‍♀️`);
 assert.deepEqual(candidates,before);
 assert.equal(transferMessage(source,[]),'');
});
test('reply uses the shared Japan-time greeting and keeps different months separate',()=>{
 const source=fixture().slots[0],candidates=[{...source,date:'2026-10-10'},{...source},{...source}];
 const message=transferMessage(source,candidates,new Date('2026-09-08T17:00:00+09:00'));
 assert.ok(message.startsWith('こんばんは！'));assert.match(message,/9月10日\(木\) 09:00~\n10月10日\(土\) 09:00~/);
});
test('transfer acceptance LINE message includes the issued lesson link',()=>{
 const link='https://example.test/s/token?lessonId=lesson-1';
 assert.equal(transferAcceptanceMessage(link),`以下のリンクよりご希望の振替日時を選択いただくか、LINEにてご希望の日時をご連絡いただければと思います🙇‍♂️
ご確認のほどよろしくお願いいたします🙇‍♂️
${link}`);
});
test('staffed preferred slots rank first including alternatives and selected weeks',()=>{
 const s=fixture();s.preferences=[{id:'p',studentId:'s',name:'S',room:'R',course:'C',weekday:6,weeks:[3],start:'13:00',end:'14:30',alternatives:[{weekday:2,start:'09:00',end:'10:30'}]}];
 assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>[c.id,c.preferred]),[['c',true],['b',false]]);
 s.preferences[0].weeks=[2];assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>[c.id,c.preferred]),[['b',false],['c',false]]);
 s.preferences[0].weeks=[3];s.availability['T|c']='no';assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>c.id),['b']);
});
test('other students and rooms do not affect ranking; legacy preference resolves by name',()=>{
 const s=fixture();s.preferences=[{id:'p',studentId:'other',name:'S',room:'R',course:'C',weekday:2,weeks:[3],start:'09:00',end:'10:30'}];
 assert.ok(adminTransferCandidates(s,'l',now).every(c=>!c.preferred));
 delete s.preferences[0].studentId;assert.equal(adminTransferCandidates(s,'l',now)[0].id,'c');
 s.preferences[0].room='Other';assert.ok(adminTransferCandidates(s,'l',now).every(c=>!c.preferred));
});
test('explicit priorities rank eligible matches; best matching priority wins and legacy defaults to one',()=>{
 const s=fixture();const p={id:'p',studentId:'s',name:'S',room:'R',course:'C',weeks:[3],start:'09:00',end:'10:30'};
 s.preferences=[{...p,weekday:0,priority:2},{...p,id:'q',weekday:2,priority:1}];
 assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>[c.id,c.priority]),[['c',1],['b',2]]);
 s.preferences.push({...p,id:'r',weekday:0});
 assert.deepEqual(adminTransferCandidates(s,'l',now).map(c=>[c.id,c.priority]),[['b',1],['c',1]]);
});

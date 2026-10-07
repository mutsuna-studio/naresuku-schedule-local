import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import test from 'node:test';
// Keep scheduling fixtures deterministic as the real calendar advances.
test.mock.timers.enable({apis:['Date'],now:new Date('2026-09-01T00:00:00+09:00')});
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}
const {optimizeMonth}=load('lib/monthly-optimization.ts');
const {generate}=load('lib/recurrence.ts');
const now=new Date('2026-09-12T00:00:00Z');
function fixture(){
 const s={slots:[],lessons:[],teachers:[{name:'T',max:3,rooms:['R'],curricula:['C']}],availability:{},duty:{},history:[],students:[{id:'s',name:'S',room:'R',course:'C',monthlyLessons:2,periods:[]}],preferences:[{id:'p',studentId:'s',name:'S',course:'C',room:'R',weekday:3,weeks:[1,2,3,4],start:'09:00',end:'10:30'}]};
 for(const day of [7,14,21,28]){const id='day'+day;s.slots.push({id,room:'R',date:'2026-10-'+String(day).padStart(2,'0'),start:'09:00',end:'10:30'});s.availability['T|'+id]='yes';}return s;
}
const dates=s=>s.lessons.map(l=>s.slots.find(slot=>slot.id===l.slot).date).sort();
test('existing slots only, adds contract count and assigns teachers without mutating input',()=>{
 const s=fixture(),before=structuredClone(s),r=optimizeMonth(s,'2026-10','R',now);
 assert.equal(r.added,2);assert.deepEqual(dates(r.state),['2026-10-07','2026-10-21']);assert.ok(r.state.lessons.every(l=>l.teacher==='T'));assert.deepEqual(s,before);assert.deepEqual(r.state.slots,s.slots);
 s.slots=[];assert.equal(optimizeMonth(s,'2026-10','R',now).state.lessons.length,0);
});
test('already populated month can move generated lessons while preserving IDs and quota',()=>{
 const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;
 s.lessons[1].slot='day14';s.lessons[1].originalDate='2026-10-14';s.lessons[1].occurrence='p|2026-10-14';
 const ids=s.lessons.map(l=>l.id).sort(),r=optimizeMonth(s,'2026-10','R',now);
 assert.equal(r.added,0);assert.ok(r.moved>0);assert.deepEqual(dates(r.state),['2026-10-07','2026-10-21']);assert.deepEqual(r.state.lessons.map(l=>l.id).sort(),ids);
});
test('locked dates remain locked when confirmation has been reopened',()=>{
 const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;
 s.students[0].scheduleStatuses={'2026-10':{status:'adjusting',datesLocked:true}};
 s.availability={};const r=optimizeMonth(s,'2026-10','R',now);assert.equal(r.moved,0);assert.equal(r.added,0);assert.deepEqual(dates(r.state),dates(s));
});
test('changed preferences never delete an existing lesson',()=>{
 const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;s.preferences[0].weeks=[1];
 const r=optimizeMonth(s,'2026-10','R',now);assert.equal(r.state.lessons.length,2);assert.deepEqual(new Set(r.state.lessons.map(l=>l.id)),new Set(s.lessons.map(l=>l.id)));
});
test('manual, transferred, absent, exam and pending lessons retain their dates',()=>{
 for(const patch of [{occurrence:undefined},{originalDate:'2026-09-01'},{absent:true},{exam:true},{request:'pending'}]){
  const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;Object.assign(s.lessons[0],patch);
  const old=s.lessons[0],r=optimizeMonth(s,'2026-10','R',now),next=r.state.lessons.find(l=>l.id===old.id);
  assert.equal(next.slot,old.slot);assert.equal(next.originalDate,old.originalDate);assert.equal(next.absent,old.absent);assert.equal(next.request,old.request);
 }
});
test('past slots and another room remain unchanged; repeated optimization does not add lessons',()=>{
 const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;s.lessons[0].teacher='T';
 const r=optimizeMonth(s,'2026-10','R',new Date('2026-10-15T00:00:00Z'));
 assert.deepEqual(r.state.lessons.find(l=>l.id===s.lessons[0].id),s.lessons[0]);
 const second=optimizeMonth(r.state,'2026-10','R',now);assert.equal(second.added,0);assert.equal(second.state.lessons.length,2);
 assert.deepEqual(optimizeMonth(s,'2026-10','Other',now).state,s);
});

test('joint search retries student dates when individual capacity cannot satisfy consecutive teaching',()=>{
 const s=fixture();s.slots=[];s.availability={};s.preferences[0].weekday=6;s.preferences[0].alternatives=[{weekday:0,start:'09:00',end:'10:30'}];
 for(const day of [3,4,10,11,17,18,24,25])for(const [start,end] of [['09:00','10:30'],['10:30','12:00']]){
  const id=day+'-'+start,date='2026-10-'+String(day).padStart(2,'0');s.slots.push({id,room:'R',date,start,end});s.availability['T|'+id]='yes';
  if([4,11,18,25].includes(day)&&start==='10:30')s.lessons.push({id:'anchor'+day,name:'Manual'+day,course:'C',slot:id,teacher:'',note:'',absent:false});
 }
 const r=optimizeMonth(s,'2026-10','R',now),studentLessons=r.state.lessons.filter(l=>l.studentId==='s');
 assert.equal(studentLessons.length,2);assert.ok(studentLessons.every(l=>l.teacher==='T'));assert.ok(studentLessons.every(l=>new Date(r.state.slots.find(slot=>slot.id===l.slot).date+'T12:00:00Z').getUTCDay()===0));
});

test('workload preview compares original staffing and unmet lessons are explicit',()=>{
 const s=fixture();s.lessons=generate(s,'2026-10','R',{existingSlotsOnly:true}).state.lessons;s.lessons.forEach(l=>l.teacher='T');
 const r=optimizeMonth(s,'2026-10','R',now);assert.equal(r.workload[0].beforeLessons,2);assert.equal(r.workload[0].beforeDays,2);assert.deepEqual(r.unmet,[]);
 s.lessons=[];s.slots=[];assert.deepEqual(optimizeMonth(s,'2026-10','R',now).unmet,[{name:'S',count:2}]);
});

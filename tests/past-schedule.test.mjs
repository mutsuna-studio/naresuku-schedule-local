import test from 'node:test';
test.mock.timers.enable({apis:['Date'],now:new Date('2026-09-09T12:00:00+09:00')});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function createLoader(){const cache=new Map();function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}return load}

const load=createLoader(),{japanToday,pastScheduleChanged}=load('lib/past-schedule.ts');
const {autoAssign}=load('lib/scheduler.ts'),{generate}=load('lib/recurrence.ts'),{optimizeMonth}=load('lib/monthly-optimization.ts');
const now=new Date('2026-09-08T15:00:00Z');
const fixture=()=>({slots:[{id:'past',room:'R',date:'2026-09-08',start:'09:00',end:'10:00'},{id:'today',room:'R',date:'2026-09-09',start:'09:00',end:'10:00'},{id:'future',room:'R',date:'2026-09-16',start:'09:00',end:'10:00'}],lessons:[{id:'p',slot:'past',name:'S',course:'C',note:'',teacher:'Old',absent:false,exam:false},{id:'t',slot:'today',name:'S',course:'C',note:'',teacher:'',absent:false,exam:false}],teachers:[{id:'teacher',name:'New',rooms:['R'],curricula:['C'],max:2}],availability:{'New|today':'yes','New|future':'yes'},duty:{'Old|past':true},workAssignments:[],history:[],students:[]});
test('Japan midnight protects yesterday, not today',()=>{
 assert.equal(japanToday(new Date('2026-09-08T14:59:59Z')),'2026-09-08');assert.equal(japanToday(now),'2026-09-09');
 const a=fixture(),b=structuredClone(a);b.lessons[0].teacher='New';assert.equal(pastScheduleChanged(a,b,new Date('2026-09-08T14:59:59Z')),false);assert.equal(pastScheduleChanged(a,b,now),true);
});
test('protects removal, addition, both directions of transfer, slot edits, duty and work',()=>{
 for(const mutate of [s=>s.lessons.shift(),s=>s.lessons.push({...s.lessons[0],id:'new'}),s=>s.lessons[0].slot='future',s=>s.lessons[1].slot='past',s=>s.slots[0].date='2026-09-10',s=>s.slots[1].date='2026-09-08',s=>s.slots.shift(),s=>s.slots[0].start='08:00',s=>s.slots[0].room='Other',s=>delete s.duty['Old|past'],s=>s.workAssignments.push({id:'w',slot:'past',teacherId:'teacher',title:'固定業務'})]){
  const a=fixture(),b=structuredClone(a);mutate(b);assert.equal(pastScheduleChanged(a,b,now),true);
 }
});
test('notes, order and future edits do not unlock or change the historical schedule',()=>{
 const a=fixture(),b=structuredClone(a);b.lessons[0].note='授業記録';b.lessons[1].teacher='New';b.lessons.reverse();b.slots.reverse();assert.equal(pastScheduleChanged(a,b,now),false);assert.equal(a.slots[0].id,'past');
 b.workAssignments.push({id:'past-work',slot:'past',teacherId:'teacher',title:'準備',note:'元'});a.workAssignments=structuredClone(b.workAssignments);b.workAssignments[0].note='業務記録';assert.equal(pastScheduleChanged(a,b,now),false);
});
test('fill and rebuild always ignore historical slots even if explicitly selected',()=>{
 for(const mode of ['fill','rebuild'])for(const balanceMonth of [false,true]){
  const s=fixture(),r=autoAssign(s,s.slots.map(slot=>slot.id),mode,{now,balanceMonth});assert.equal(pastScheduleChanged(s,r.state,now),false);assert.equal(r.state.lessons.find(l=>l.id==='t').teacher,'New');
 }
});
test('generation creates no slots or lessons in the past and retains existing history',()=>{
 const s=fixture();s.settings={campuses:['R'],curricula:['C'],closeOnHolidays:{R:false},schedules:[{room:'R',weekday:3,periods:[{id:'period',order:1,start:'09:00',end:'10:00'}]}]};s.preferences=[{id:'pref',room:'R',name:'Another',course:'C',weekday:3,weeks:[1,2,3,4],start:'09:00',end:'10:00'}];
 const r=generate(s,'2026-09','R',{now});assert.equal(pastScheduleChanged(s,r.state,now),false);assert.ok(r.state.lessons.length>s.lessons.length);assert.ok(r.state.slots.filter(slot=>!s.slots.some(old=>old.id===slot.id)).every(slot=>slot.date>='2026-09-09'));assert.equal(pastScheduleChanged(s,optimizeMonth(s,'2026-09','R',now).state,now),false);
});
test('resolution exemption is limited to selected lessons and released source duty',()=>{
 const {pastScheduleChangedOutsideResolution:changed}=load('lib/past-schedule.ts');
 const a=fixture(),b=structuredClone(a);b.lessons[0].slot='future';b.lessons[0].teacher='';delete b.duty['Old|past'];
 assert.equal(changed(a,b,['p'],now),false);assert.equal(changed(a,b,[],now),true);assert.equal(pastScheduleChanged(a,b,now),true);
 for(const mutate of [s=>s.slots[0].start='08:00',s=>s.lessons.push({...a.lessons[0],id:'unexpected'}),s=>s.lessons.shift(),s=>s.duty['New|past']=true,s=>s.workAssignments.push({id:'w',slot:'past',teacherId:'teacher',title:'work'})]){
  const next=structuredClone(b);mutate(next);assert.equal(changed(a,next,['p'],now),true);
 }
 const source=fixture();source.lessons.push({...source.lessons[0],id:'other'});const next=structuredClone(source);next.lessons[2].teacher='New';assert.equal(changed(source,next,['p'],now),true);
});

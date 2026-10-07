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
const {generate}=load('lib/recurrence.ts'),{staffingGap,staffingLoad}=load('lib/staff-capacity.ts');
function fixture(){return {slots:[{id:'a',room:'R',date:'2026-10-07',start:'09:00',end:'10:30'},{id:'b',room:'R',date:'2026-10-02',start:'09:00',end:'10:30'}],lessons:[],teachers:[{name:'T',autoAttendance:false,canSuperviseExam:false,max:1,rooms:['R'],curricula:['C']}],availability:{'T|b':'yes'},duty:{},history:[],preferences:[{id:'p',name:'S',course:'C',room:'R',weekday:3,weeks:[1],start:'09:00',end:'10:30',alternatives:[{weekday:5,start:'09:00',end:'10:30'}]}]}}
function contractedFixture(monthlyLessons=2){const s=fixture();s.students=[{id:'student',name:'S',room:'R',course:'C',monthlyLessons,periods:[],reviewed:true}];s.preferences=[{...s.preferences[0],studentId:'student',weekday:6,weeks:[1,2,3,4],alternatives:[]},{...s.preferences[0],id:'second',studentId:'student',weekday:0,weeks:[1,2,3,4],alternatives:[]}];return s;}
const generatedDates=result=>result.state.lessons.map(lesson=>result.state.slots.find(slot=>slot.id===lesson.slot).date).sort();
function staffedMonthlyFixture(){const s=contractedFixture();s.slots=[];s.availability={};s.teachers[0].max=3;for(const day of [3,4,10,11,17,18,24,25]){const date=`2026-10-${String(day).padStart(2,'0')}`,id='R-'+date+'-09:00';s.slots.push({id,room:'R',date,start:'09:00',end:'10:30'});s.availability['T|'+id]='yes';}return s;}
test('two teachers with three pupils are less full than one teacher with two pupils',()=>{
 const s=staffedMonthlyFixture();s.teachers.push({...s.teachers[0],name:'U'});
 s.preferences=s.preferences.map(p=>({...p,weeks:[2,4],start:p.weekday===6?'13:30':'09:00',end:p.weekday===6?'15:00':'10:30'}));
 for(const slot of s.slots){
  const saturday=new Date(slot.date+'T12:00:00Z').getUTCDay()===6;
  if(saturday){slot.start='13:30';slot.end='15:00';s.availability['U|'+slot.id]='yes';}
  for(let i=0;i<(saturday?3:2);i++)s.lessons.push({id:slot.id+'-'+i,name:'Existing '+slot.id+i,course:'C',slot:slot.id,teacher:saturday&&i===2?'U':'T',absent:false});
 }
 const before=structuredClone(s),r=generate(s,'2026-10','R');
 assert.deepEqual(r.state.lessons.filter(l=>l.studentId==='student').map(l=>r.state.slots.find(slot=>slot.id===l.slot).date),['2026-10-10','2026-10-24']);
 assert.deepEqual(s,before);assert.deepEqual(r.state.lessons.slice(0,s.lessons.length),s.lessons);
 const probe={id:'probe',name:'S',course:'C',teacher:'',absent:false};
 assert.equal(staffingLoad(s,s.slots.find(slot=>slot.date==='2026-10-10'),probe),4/6);
 assert.equal(staffingLoad(s,s.slots.find(slot=>slot.date==='2026-10-11'),probe),1);
});
test('utilization counts only compatible available capacity and accounts for competing courses',()=>{
 const s=fixture(),slot=s.slots[1],probe={id:'probe',name:'S',course:'C',teacher:'',absent:false};
 s.teachers[0].max=3;s.teachers[0].curricula=['C','Other'];
 s.teachers.push({...s.teachers[0],name:'U',curricula:['Other']},{...s.teachers[0],name:'Unavailable'});s.availability['U|b']='yes';
 s.lessons=[{...probe,id:'other',course:'Other',slot:'b'}];
 assert.equal(staffingLoad(s,slot,probe),1/3);
 s.availability['U|b']='no';assert.equal(staffingLoad(s,slot,probe),2/3);
 s.lessons[0].teacher='T';s.availability['U|b']='yes';assert.equal(staffingLoad(s,slot,probe),2/3);
 s.lessons[0].absent=true;assert.equal(staffingLoad(s,slot,probe),1/3);
 s.teachers[0].autoAssignLessons=false;assert.equal(staffingLoad(s,slot,probe),1);
});
test('weekly monthly-two preferences select fortnightly dates on one weekday instead of the first two dates',()=>{
 const s=contractedFixture();assert.deepEqual(generatedDates(generate(s,'2026-10','R')),['2026-10-03','2026-10-17']);
 s.preferences.reverse();assert.deepEqual(generatedDates(generate(s,'2026-10','R')),['2026-10-03','2026-10-17']);
});
test('staff coverage selects a complete consistent Sunday pair rather than individually mixing weekends',()=>{
 const s=staffedMonthlyFixture();for(const slot of s.slots)if([10,17,24].includes(Number(slot.date.slice(-2))))s.availability['T|'+slot.id]='no';
 const r=generate(s,'2026-10','R');assert.deepEqual(generatedDates(r),['2026-10-04','2026-10-18']);assert.ok(r.state.slots.every(slot=>staffingGap(r.state,slot)===0));
});
test('weekday consistency is soft when only a mixed pair has teacher coverage',()=>{
 const s=staffedMonthlyFixture();for(const slot of s.slots)s.availability['T|'+slot.id]=[3,18].includes(Number(slot.date.slice(-2)))?'yes':'no';
 const r=generate(s,'2026-10','R');assert.deepEqual(generatedDates(r),['2026-10-03','2026-10-18']);assert.ok(r.state.slots.every(slot=>staffingGap(r.state,slot)===0));
});
test('manual-only teachers do not make earlier weeks appear automatically staffed',()=>{
 const s=staffedMonthlyFixture();s.preferences=[s.preferences[0]];s.teachers.push({...s.teachers[0],name:'Manual',autoAssignLessons:false});
 for(const slot of s.slots){s.availability['T|'+slot.id]=[10,24].includes(Number(slot.date.slice(-2)))?'yes':'no';s.availability['Manual|'+slot.id]='yes';}
 assert.deepEqual(generatedDates(generate(s,'2026-10','R')),['2026-10-10','2026-10-24']);
});
test('equivalent fortnightly patterns spread students across all four staffed weeks',()=>{
 const s=staffedMonthlyFixture(),student=s.students[0],pref=s.preferences[0];s.students=[];s.preferences=[];
 for(let i=0;i<6;i++){const id='student-'+i,name='S'+i;s.students.push({...student,id,name});s.preferences.push({...pref,id:'p-'+i,studentId:id,name});}
 const r=generate(s,'2026-10','R');assert.equal(r.count,12);assert.ok(r.state.slots.every(slot=>staffingGap(r.state,slot)===0));
 for(const day of ['03','10','17','24'])assert.equal(generatedDates(r).filter(date=>date==='2026-10-'+day).length,3);
 for(const st of s.students){const dates=r.state.lessons.filter(l=>l.studentId===st.id).map(l=>r.state.slots.find(slot=>slot.id===l.slot).date).sort();assert.equal((Date.parse(dates[1])-Date.parse(dates[0]))/86400000,14);}
});
test('an existing second-week lesson anchors the new lesson in the fourth week without moving it',()=>{
 const s=staffedMonthlyFixture();s.lessons=[{id:'manual',studentId:'student',name:'S',course:'C',slot:'R-2026-10-10-09:00',teacher:'T',absent:false}];
 const r=generate(s,'2026-10','R');assert.deepEqual(generatedDates(r),['2026-10-10','2026-10-24']);assert.deepEqual(r.state.lessons[0],s.lessons[0]);assert.equal(generate(r.state,'2026-10','R').count,0);
});
test('students with only two possible weeks get those seats before flexible students',()=>{
 const s=staffedMonthlyFixture();s.teachers[0].max=1;const student=s.students[0],pref=s.preferences[0];
 s.students=[{...student,id:'a-flexible',name:'Flexible'},{...student,id:'z-fixed',name:'Fixed'}];
 s.preferences=s.students.map(st=>({...pref,id:st.id,studentId:st.id,name:st.name,weeks:st.id==='z-fixed'?[1,3]:[1,2,3,4]}));
 const r=generate(s,'2026-10','R');
 for(const [id,expected] of [['a-flexible',['2026-10-10','2026-10-24']],['z-fixed',['2026-10-03','2026-10-17']]])assert.deepEqual(r.state.lessons.filter(l=>l.studentId===id).map(l=>r.state.slots.find(slot=>slot.id===l.slot).date).sort(),expected);
});
test('limited explicit weeks remain valid even when consecutive, and alternatives cannot duplicate an occurrence',()=>{
 const s=contractedFixture();s.preferences=[{...s.preferences[0],weeks:[1,2]}];assert.deepEqual(generatedDates(generate(s,'2026-10','R')),['2026-10-03','2026-10-10']);
 s.preferences[0].weeks=[1];s.preferences[0].alternatives=[{weekday:0,start:'09:00',end:'10:30'}];assert.equal(generate(s,'2026-10','R').count,1);
});
test('monthly-two alternative slots keep the same time when equally staffed and spaced',()=>{
 const s=contractedFixture();s.preferences=[{...s.preferences[0],alternatives:[{weekday:6,start:'10:45',end:'12:15'}]}];
 const r=generate(s,'2026-10','R');assert.deepEqual(generatedDates(r),['2026-10-03','2026-10-17']);assert.deepEqual(r.state.lessons.map(l=>r.state.slots.find(slot=>slot.id===l.slot).start),['09:00','09:00']);
});
test('monthly contract caps all preference patterns together and repeated generation adds nothing',()=>{
 for(const limit of [2,4]){const s=contractedFixture(limit),before=structuredClone(s),r=generate(s,'2026-10','R');assert.equal(r.count,limit);assert.equal(r.state.lessons.length,limit);assert.equal(generate(r.state,'2026-10','R').count,0);assert.deepEqual(s,before);}
});
test('existing manual and absent lessons consume the monthly contract without being changed',()=>{
 const s=contractedFixture();s.lessons=[{id:'manual',name:'S',slot:'a',course:'C',teacher:'T',absent:true}];
 const r=generate(s,'2026-10','R');assert.equal(r.count,1);assert.deepEqual(r.state.lessons[0],s.lessons[0]);
 s.lessons.push({...s.lessons[0],id:'second',slot:'b'});assert.equal(generate(s,'2026-10','R').count,0);
});
test('cross-month transfers count against their original month, not their destination month',()=>{
 const s=contractedFixture();s.slots.push({...s.slots[0],id:'november',date:'2026-11-04'});
 s.lessons=[{id:'out',studentId:'student',name:'S',slot:'november',originalDate:'2026-10-07',course:'C',teacher:'',absent:false},{id:'in',studentId:'student',name:'S',slot:'a',originalDate:'2026-09-02',course:'C',teacher:'',absent:false}];
 assert.equal(generate(s,'2026-10','R').count,1);
});
test('same-name students in other rooms do not consume the contract and excess existing lessons are preserved',()=>{
 const s=contractedFixture();s.students.push({...s.students[0],id:'other',room:'Other'});s.slots.push({...s.slots[0],id:'other-slot',room:'Other'});
 s.lessons=[{id:'other-lesson',name:'S',slot:'other-slot',course:'C',teacher:'',absent:false}];assert.equal(generate(s,'2026-10','R').count,2);
 s.lessons=Array.from({length:3},(_,i)=>({...s.lessons[0],id:String(i),studentId:'student',slot:'a'}));const r=generate(s,'2026-10','R');assert.equal(r.count,0);assert.deepEqual(r.state.lessons,s.lessons);
});
test('flexible preference chooses staffed candidate, stays unassigned, persists occurrence and is idempotent',()=>{const s=fixture(),r=generate(s,'2026-10','R');assert.equal(r.count,1);assert.equal(r.state.lessons[0].slot,'b');assert.equal(r.state.lessons[0].teacher,'');assert.equal(r.shortages.length,0);assert.equal(generate(r.state,'2026-10','R').count,0);assert.equal(s.lessons.length,0)});
test('fixed preferences are placed first and retain their times; flexible capacity cannot displace them',()=>{const s=fixture();s.preferences.push({...s.preferences[0],id:'fixed',name:'Fixed',weekday:5,alternatives:[]});const r=generate(s,'2026-10','R');assert.equal(r.state.lessons.find(l=>l.name==='Fixed').slot,'b');assert.equal(r.state.lessons.find(l=>l.name==='S').slot,'a');assert.equal(r.shortages.reduce((a,b)=>a+b.count,0),1)});
test('unqualified teacher cannot cover a course; one multi-course seat is not counted twice',()=>{const s=fixture();s.teachers[0].curricula=['Other'];assert.equal(generate(s,'2026-10','R').state.lessons[0].slot,'a');s.teachers[0].curricula=['C','Other'];s.lessons=[{id:'one',slot:'b',name:'one',course:'C',teacher:'',absent:false}];assert.equal(staffingGap(s,s.slots[1],{id:'two',slot:'b',course:'Other',teacher:'',absent:false}),1)});
test('alternative remains usable when primary date already has a lesson',()=>{const s=fixture();s.lessons.push({id:'existing',slot:'a',name:'S',course:'C',teacher:'',absent:false});assert.equal(generate(s,'2026-10','R').count,1)});
test('explicit unavailability excludes staff regardless of automatic attendance from assignment',()=>{const {autoAssign,issues}=load('lib/scheduler.ts');for(const autoAttendance of [false,true]){const s=fixture();s.teachers[0].autoAttendance=autoAttendance;s.availability={'T|a':'no','T|b':'no'};s.lessons=[{id:'one',slot:'a',name:'one',course:'C',teacher:'',absent:false}];assert.equal(autoAssign(s,['a','b']).state.lessons[0].teacher,'');s.lessons[0].teacher='T';assert.ok(issues(s).some(item=>item.text.includes('出勤不可')))}});
test('assignment gives limited teacher seats to higher preferences without moving lessons',()=>{
 const {autoAssign}=load('lib/scheduler.ts'),s=fixture();
 s.preferences=[{...s.preferences[0],name:'Low',weekday:5,priority:3,alternatives:[]},{...s.preferences[0],id:'high',name:'High',weekday:5,priority:1,alternatives:[]}];
 s.lessons=['Low','High'].map(name=>({id:name,name,course:'C',slot:'b',teacher:'',absent:false}));
 const before=structuredClone(s),r=autoAssign(s,['b']);
 assert.equal(r.state.lessons.find(l=>l.name==='High').teacher,'T');assert.equal(r.state.lessons.find(l=>l.name==='Low').teacher,'');
 assert.deepEqual(r.state.lessons.map(l=>l.slot),['b','b']);assert.deepEqual(s,before);
 // Legacy stored flags must not preserve an assignment.
 s.lessons[0].teacher='T';s.lessons[0].locked=true;assert.equal(autoAssign(s,['b']).state.lessons[1].teacher,'T');
});
test('monthly placement uses preference priority when competing for staffed alternatives',()=>{
 const s=fixture();s.preferences=[{...s.preferences[0],name:'Low',priority:3},{...s.preferences[0],id:'high',name:'High',priority:1}];
 const r=generate(s,'2026-10','R');
 assert.equal(r.state.lessons.find(l=>l.name==='High').slot,'b');assert.equal(r.state.lessons.find(l=>l.name==='Low').slot,'a');
 assert.equal(generate(r.state,'2026-10','R').count,0);
});
test('transfer and assignment use the same preference rank including alternatives',()=>{
 const {autoAssign}=load('lib/scheduler.ts'),{adminTransferCandidates}=load('lib/admin-transfer.ts'),s=fixture();
 s.preferences=[{...s.preferences[0],priority:2}];
 s.lessons=[{id:'source',name:'S',course:'C',slot:'a',teacher:'',absent:false}];
 const candidates=adminTransferCandidates(s,'source',Date.parse('2026-09-01'));
 assert.equal(candidates.find(c=>c.id==='b').priority,2);
 s.lessons=[{id:'unmatched',name:'Other',course:'C',slot:'b',teacher:'',absent:false},{id:'source',name:'S',course:'C',slot:'b',teacher:'',absent:false}];
 assert.equal(autoAssign(s,['b']).state.lessons[1].teacher,'T');
});
test('development scenarios exercise enrollment, curricula and alternative placement',async()=>{
 const {localSample}=await import('../scripts/local-sample.mjs');
 const s=localSample(new Date('2026-09-08T00:00:00Z')),room=s.settings.campuses[0];
 const r=generate(s,'2026-10',room),forStudent=(result,index)=>result.state.lessons.filter(l=>l.studentId===s.students[index].id&&result.state.slots.find(slot=>slot.id===l.slot)?.date.startsWith(result===r?'2026-10':'2026-11'));
 assert.equal(forStudent(r,4).length,0);assert.equal(forStudent(r,5).length,0);assert.equal(forStudent(r,7).length,0);
 assert.equal(forStudent(r,6).length,4);assert.equal(forStudent(r,8).length,2);
 assert.ok(forStudent(r,9).every(l=>new Date(r.state.slots.find(slot=>slot.id===l.slot).date+'T12:00:00Z').getUTCDay()===3));
 const {autoAssign}=load('lib/scheduler.ts'),assigned=autoAssign(r.state,r.state.slots.filter(slot=>slot.date.startsWith('2026-10')&&slot.room===room).map(slot=>slot.id));
 assert.ok(assigned.state.lessons.filter(l=>l.course==='Swift').every(l=>!l.teacher));
 for(const l of assigned.state.lessons.filter(l=>l.teacher))assert.ok(assigned.state.teachers.find(t=>t.name===l.teacher).curricula.includes(l.course));
 const resumed=generate(s,'2026-11',room);assert.equal(forStudent(resumed,7).length,2);
});
test('four unassigned students are constructed as balanced feasible classes',()=>{
 const {autoAssign}=load('lib/scheduler.ts'),s=fixture();s.teachers=[{...s.teachers[0],max:3},{...s.teachers[0],name:'U',max:3}];s.availability['U|b']='yes';
 s.lessons=Array.from({length:4},(_,i)=>({id:String(i),name:`S${i}`,slot:'b',course:'C',teacher:'',absent:false}));
 const before=structuredClone(s),r=autoAssign(s,['b']);
 assert.deepEqual(['T','U'].map(name=>r.state.lessons.filter(l=>l.teacher===name).length),[2,2]);assert.equal(r.assigned,4);assert.deepEqual(s,before);
 s.lessons[0].teacher='T';const reassigned=autoAssign(s,['b']);assert.deepEqual(['T','U'].map(name=>reassigned.state.lessons.filter(l=>l.teacher===name).length),[2,2]);
});
test('existing assignments stay in place when filling a curriculum-compatible vacancy',()=>{
 const {autoAssign}=load('lib/scheduler.ts'),s=fixture();s.teachers=[{...s.teachers[0],max:3},{...s.teachers[0],name:'U',max:3,curricula:['Other']}];s.availability['U|b']='yes';
 s.lessons=Array.from({length:4},(_,i)=>({id:String(i),name:`S${i}`,slot:'b',course:i===3?'Other':'C',teacher:'',absent:false}));
 let r=autoAssign(s,['b']);assert.deepEqual(['T','U'].map(name=>r.state.lessons.filter(l=>l.teacher===name).length),[3,1]);
 s.teachers[1].curricula=['C','Other'];for(const l of s.lessons.slice(0,3)){l.teacher='T'}r=autoAssign(s,['b']);assert.deepEqual(['T','U'].map(name=>r.state.lessons.filter(l=>l.teacher===name).length),[3,1]);
});

test('agreed months stay fixed after manual deletion or transfer, without blocking other months',()=>{
 const {setStudentScheduleStatus:set,reconcileStudentScheduleStatuses:reconcile}=load('lib/student-schedule-status.ts');
 for(const stage of ['waiting','confirmed']){
  const s=generate(contractedFixture(),'2026-10','R').state;
  set(s,'student','2026-10',stage,'管理者');
  s.lessons.pop();reconcile(s);
  const before=structuredClone(s),result=generate(s,'2026-10','R');
  assert.equal(result.count,0);assert.deepEqual(result.state.lessons,before.lessons);assert.deepEqual(s,before);
  assert.equal(generate(s,'2026-11','R').count,2);
 }
});
test('ordinary adjusting months refill, but unresolved requests do not',()=>{
 const {setStudentScheduleStatus:set}=load('lib/student-schedule-status.ts');
 const s=generate(contractedFixture(),'2026-10','R').state;s.lessons.pop();
 set(s,'student','2026-10','adjusting','管理者');
 assert.equal(generate(s,'2026-10','R').count,1);
 s.lessons[0].requestData={kind:'振替希望'};
 assert.equal(generate(s,'2026-10','R').count,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function createLoader(){const cache=new Map();function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}return load}

const load=createLoader();
const {setTeacherArchived}=load('lib/teacher-identity.ts');
const {autoAssign}=load('lib/scheduler.ts');
const {staffingGap}=load('lib/staff-capacity.ts');
test('archive and restore preserve staff identity, lessons, shifts and work',()=>{
 const s={teachers:[{id:'t',name:'Teacher',max:3,rooms:['R'],curricula:['C']}],slots:[],lessons:[{id:'l',teacher:'Teacher'}],availability:{'Teacher|slot':'yes'},duty:{'Teacher|slot':true},workAssignments:[],history:[]};
 const before=structuredClone(s),hidden=setTeacherArchived(s,'t',true);
 assert.deepEqual(s,before);assert.equal(hidden.teachers[0].archived,true);assert.deepEqual(hidden.lessons,s.lessons);assert.deepEqual(hidden.availability,s.availability);assert.deepEqual(hidden.duty,s.duty);
 assert.equal(setTeacherArchived(hidden,'t',false).teachers[0].archived,false);assert.throws(()=>setTeacherArchived(s,'missing',true));
});
test('archived staff are excluded from assignment and capacity, restoring makes them eligible',()=>{
 const now=new Date('2099-09-02T00:00:00+09:00');
 const s={teachers:[{id:'t',name:'T',archived:true,max:3,rooms:['R'],curricula:['C']}],slots:[{id:'a',room:'R',date:'2099-09-02',start:'09:00',end:'10:30'}],lessons:[{id:'l',name:'S',course:'C',slot:'a',teacher:'',absent:false}],availability:{'T|a':'yes'},duty:{},history:[]};
 assert.equal(autoAssign(s,['a'],'fill',{now}).state.lessons[0].teacher,'');assert.equal(staffingGap(s,s.slots[0]),1);
 const restored=setTeacherArchived(s,'t',false);assert.equal(autoAssign(restored,['a'],'fill',{now}).state.lessons[0].teacher,'T');assert.equal(staffingGap(restored,restored.slots[0]),0);
});

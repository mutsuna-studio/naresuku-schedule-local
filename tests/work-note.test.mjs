import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function createLoader(){const cache=new Map();function load(path){path=resolve(path);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('exports','require',code)(exports,id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):require(id));return exports}return load}

const load=createLoader();
const {putWorkAssignment,validateWorkAssignments}=load('lib/work-assignments.ts');
const {mergeSchedule}=load('lib/schedule-merge.ts');
function fixture(){return {teachers:[{id:'t',name:'T',rooms:['R']}],slots:[{id:'a',room:'R',date:'2099-09-01',start:'09:00',end:'10:00'}],lessons:[],workAssignments:[{id:'w',teacherId:'t',slot:'a',title:'面談',note:'元のメモ'}],availability:{},duty:{},history:[]}}
test('work notes survive edits and JSON saves; note validation rejects malformed or oversized input',()=>{
 const s=fixture(),next=putWorkAssignment(s,{...s.workAssignments[0],note:'更新したメモ'});
 assert.equal(next.workAssignments[0].note,'更新したメモ');assert.equal(s.workAssignments[0].note,'元のメモ');assert.equal(JSON.parse(JSON.stringify(next)).workAssignments[0].note,'更新したメモ');assert.equal(validateWorkAssignments(next),null);
 for(const note of [42,'x'.repeat(5001)]){next.workAssignments[0].note=note;assert.ok(validateWorkAssignments(next))}
});
test('independent work notes merge with schedule edits; competing note edits conflict',()=>{
 const base=fixture(),local=structuredClone(base),remote=structuredClone(base);local.workAssignments[0].note='ローカル';remote.workAssignments[0].title='事務';
 const merged=mergeSchedule(base,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.state.workAssignments[0].title,'事務');assert.equal(merged.state.workAssignments[0].note,'ローカル');remote.workAssignments[0].note='別のメモ';assert.equal(mergeSchedule(base,local,remote).conflicts.length,1);
});

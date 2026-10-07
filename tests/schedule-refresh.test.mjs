import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
function load(path,deps={}){
 const exports={};new Function('exports','require',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,id=>deps[id]||{});return exports;
}
const {createScheduleRefresh}=load('ui/schedule-refresh.ts');
function fixture(fetcher){
 const f={state:{},version:4,blocked:false,calls:[],applied:[]};
 f.sync=createScheduleRefresh({snapshot:()=>f.blocked?null:f.state,revision:()=>f.version,fetch:async url=>{f.calls.push(url);return fetcher?fetcher(url):Response.json({revision:4})},apply:value=>f.applied.push(value)});return f;
}
test('unchanged schedule transfers only revision; blocked/hidden screens make no request',async()=>{
 const f=fixture();await f.sync.refresh();assert.deepEqual(f.calls,['/api/schedule?revisionOnly=1']);assert.deepEqual(f.applied,[]);f.blocked=true;await f.sync.refresh();assert.equal(f.calls.length,1);
});
test('changed revision fetches and applies full state exactly once',async()=>{
 const f=fixture(url=>Response.json(url.includes('?')?{revision:5}:{revision:5,state:{lessons:['updated']}}));await f.sync.refresh();assert.equal(f.calls.length,2);assert.deepEqual(f.applied,[{revision:5,state:{lessons:['updated']}}]);
});
test('changed revision reloads the currently selected classroom',async()=>{
 const calls=[];const sync=createScheduleRefresh({snapshot:()=>state,revision:()=>4,readUrl:()=>'/api/schedule?room=B',fetch:async url=>{calls.push(url);return Response.json(url.includes('revisionOnly')?{revision:5}:{revision:5,state:{}})},apply:()=>{}}),state={};await sync.refresh();assert.deepEqual(calls,['/api/schedule?revisionOnly=1','/api/schedule?room=B']);
});
test('editing, saving, navigation, or newer data during a request prevents replacement',async()=>{
 for(const change of [f=>f.blocked=true,f=>f.version++,f=>f.state={}]){
  let resolve;const pending=new Promise(r=>resolve=r);const f=fixture(url=>url.includes('?')?Response.json({revision:5}):pending);
  const task=f.sync.refresh();while(f.calls.length<2)await new Promise(r=>setImmediate(r));change(f);resolve(Response.json({revision:5,state:{}}));await task;assert.deepEqual(f.applied,[]);
 }
});
test('overlapping requests are deduplicated and stop discards in-flight data',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const task=f.sync.refresh();await f.sync.refresh();assert.equal(f.calls.length,1);f.sync.stop();resolve(Response.json({revision:5}));await task;assert.equal(f.calls.length,1);assert.deepEqual(f.applied,[]);
});
test('failed checks back off and preserve existing state',async()=>{
 const f=fixture(()=>new Response(null,{status:503}));await f.sync.refresh();await f.sync.refresh();assert.equal(f.calls.length,1);assert.deepEqual(f.applied,[]);
});
test('reconnection retries immediately but still preserves unsaved edits',async()=>{
 const f=fixture(()=>new Response(null,{status:503}));await f.sync.refresh();
 await f.sync.reconnect();assert.equal(f.calls.length,2);
 f.blocked=true;await f.sync.reconnect();assert.equal(f.calls.length,2);
});
test('local revision reads return only the revision and preserve no-store',async()=>{
 const {createLocalApi}=await import('../local/api.mjs');const api=createLocalApi(new Date('2026-09-01T00:00:00+09:00'));
 const response=await api(new Request('http://127.0.0.1/api/schedule?revisionOnly=1'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{revision:1});assert.equal(response.headers.get('Cache-Control'),'no-store');
 const denied=await api(new Request('https://example.test/api/schedule?revisionOnly=1'));assert.equal(denied.status,403);
});

test('App skips hidden, editing, dialog, and unrelated screens before and after reads',()=>{
 const script=readFileSync('ui/App.svelte','utf8').split('<script lang="ts">')[1].split('</script>')[0];
 const ast=ts.createSourceFile('app.ts',script,ts.ScriptTarget.Latest,true);
 const mount=ast.statements.find(node=>ts.isExpressionStatement(node)&&node.expression.expression?.getText(ast)==='onMount'&&node.getText(ast).includes('createScheduleRefresh')).getText(ast);
 const code=ts.transpileModule(mount,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const data={};const scope={windowReady:true,windowLoading:false,fullLoading:false,refreshIdentity:data,offlineShell:false,navigator:{onLine:true},enterOffline(){},data,tab:'schedule',auth:'admin',dirty:false,saving:false,error:'',edit:null,viewing:null,proposal:null,generation:null,pendingNavigation:null,saveConflict:null,noteBlocked:false,changingAbsence:false,draggingLesson:'',cutLesson:'',revision:4,document:{visibilityState:'visible',querySelector:()=>null,activeElement:{matches:()=>false},addEventListener(){}},onMount:fn=>fn(),setInterval:()=>0,createScheduleRefresh:options=>{scope.options=options;return {refresh(){},stop(){}}}};
 // Evaluate in a shared scope so the real App predicate observes later state changes.
 scope.addEventListener=()=>{};scope.removeEventListener=()=>{};
 const context=vm.createContext(scope);vm.runInContext(code,context);
 assert.equal(scope.options.snapshot(),data);
 for(const [key,value] of [['dirty',true],['saving',true],['edit',{}],['viewing',{}],['proposal',{}],['generation',{}],['pendingNavigation',()=>{}],['saveConflict',{}],['noteBlocked',true],['changingAbsence',true],['draggingLesson','id'],['cutLesson',{}],['tab','board'],['tab','settings'],['auth','required']]){
  const previous=scope[key];scope[key]=value;assert.equal(scope.options.snapshot(),null,key);scope[key]=previous;
 }
 scope.document.visibilityState='hidden';assert.equal(scope.options.snapshot(),null);scope.document.visibilityState='visible';
 scope.document.querySelector=()=>({});assert.equal(scope.options.snapshot(),null);scope.document.querySelector=()=>null;
 scope.document.activeElement.matches=()=>true;assert.equal(scope.options.snapshot(),null);
});

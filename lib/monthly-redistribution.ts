import type {Lesson,Slot,Teacher} from './scheduler';

type Pattern={teacher:Teacher;slots:Set<string>;delta:number};
type Edge={to:number;reverse:number;capacity:number;cost:number};

/** Capacitated matching with at least one pupil per active teacher.
 * A negative-cost first seat enforces that lower bound, while assignment costs
 * prefer keeping existing teachers. An infeasible matching is never returned.
 */
export function matchTeachingPeriod(lessons:Lesson[],teachers:Teacher[],canTeach:(teacher:Teacher,lesson:Lesson)=>boolean,options:{allowUnassigned?:boolean;priority?:(lesson:Lesson)=>number}={}){
 if(!teachers.length)return lessons.length&&!options.allowUnassigned?null:new Map<Lesson,string>();
 if(lessons.length<teachers.length)return null;
 const source=0,pupilBase=1,teacherBase=pupilBase+lessons.length,sink=teacherBase+teachers.length;
 const graph:Edge[][]=Array.from({length:sink+1},()=>[]);
 const edge=(from:number,to:number,capacity:number,cost:number)=>{
  const forward={to,reverse:graph[to].length,capacity,cost},backward={to:from,reverse:graph[from].length,capacity:0,cost:-cost};
  graph[from].push(forward);graph[to].push(backward);return forward;
 };
 const priorityWeight=(lessons.length+1)**3;
 const priorities=lessons.map(lesson=>Math.max(0,options.priority?.(lesson)||0));
 const missingCost=(priorities.reduce((sum,value)=>sum+value,0)+1)*priorityWeight;
 const firstSeatCost=options.allowUnassigned?-(lessons.length+1)*(missingCost+Math.max(0,...priorities)*priorityWeight+1):-((lessons.length+1)**3);
 const assignments:{lesson:Lesson;teacher:Teacher;edge:Edge}[]=[];
 lessons.forEach((lesson,i)=>{
  edge(source,pupilBase+i,1,0);
  if(options.allowUnassigned)edge(pupilBase+i,sink,1,missingCost+priorities[i]*priorityWeight);
  teachers.forEach((teacher,j)=>{if(teacher.autoAssignLessons!==false&&canTeach(teacher,lesson))assignments.push({lesson,teacher,edge:edge(pupilBase+i,teacherBase+j,1,lesson.teacher===teacher.name?0:1)})});
 });
 teachers.forEach((teacher,j)=>{
  if(teacher.max<1)return;
  // First cover every active teacher; then minimize squared pupil counts;
  // finally keep current assignments. Counts 2:2 beat 3:1 when both are feasible.
  edge(teacherBase+j,sink,1,firstSeatCost);
  for(let seat=1;seat<Math.min(teacher.max,lessons.length);seat++)edge(teacherBase+j,sink,1,(2*seat+1)*(lessons.length+1));
 });
 for(let flow=0;flow<lessons.length;flow++){
  const distance=Array(graph.length).fill(Infinity),previous:({node:number;edge:Edge}|undefined)[]=Array(graph.length);
  distance[source]=0;
  // Bellman-Ford handles reverse and lower-bound edges without assumptions on
  // nonnegative costs. This graph is small (one physical teaching period).
  for(let pass=0;pass<graph.length-1;pass++){
   let changed=false;
   for(let node=0;node<graph.length;node++)for(const item of graph[node]){
    if(item.capacity>0&&distance[node]+item.cost<distance[item.to]){distance[item.to]=distance[node]+item.cost;previous[item.to]={node,edge:item};changed=true;}
   }
   if(!changed)break;
  }
  if(!previous[sink])return null;
  for(let node=sink;node!==source;){const step=previous[node]!;step.edge.capacity--;graph[node][step.edge.reverse].capacity++;node=step.node;}
 }
 const result=new Map(assignments.filter(item=>item.edge.capacity===0).map(item=>[item.lesson,item.teacher.name]));
 if(teachers.some(teacher=>![...result.values()].includes(teacher.name)))return null;
 return result;
}

/** Explore teacher attendance patterns, then rematch individual pupils. The
 * matching may rotate pupils between several teachers, including specialists,
 * while only one or two teachers' attendance patterns need to change at once.
 */
export function redistributeTeachingDay({day,teachers,lessons,selected,canTeach,canAttend,validPattern,patternCost,apply}:{
 day:Slot[];teachers:Teacher[];lessons:Lesson[];selected:Set<string>;
 canTeach:(teacher:Teacher,lesson:Lesson,slot:Slot)=>boolean;
 canAttend:(teacher:Teacher,slot:Slot)=>boolean;
 validPattern:(slots:Set<string>)=>boolean;
 patternCost:(teacher:Teacher,slots:Set<string>)=>number;
 apply:(changes:Map<Lesson,string>,teachers:Teacher[])=>boolean;
}){
 const names=new Set(teachers.map(teacher=>teacher.name));
 const pool=lessons.filter(lesson=>names.has(lesson.teacher)&&selected.has(lesson.slot));
 if(!pool.length)return false;
 const at=new Map(day.map(slot=>[slot.id,pool.filter(lesson=>lesson.slot===slot.id)]));
 const current=new Map(teachers.map(teacher=>[teacher.name,new Set(lessons.filter(lesson=>lesson.teacher===teacher.name).map(lesson=>lesson.slot))]));
 const options:Pattern[][]=teachers.map(teacher=>{
  const old=current.get(teacher.name)!,base=patternCost(teacher,old),possible=new Set(day.filter(slot=>canAttend(teacher,slot)&&at.get(slot.id)!.some(lesson=>canTeach(teacher,lesson,slot))).map(slot=>slot.id));
  const patterns=new Map<string,Set<string>>();
  const add=(ids:Set<string>)=>{
   if(day.some(slot=>!selected.has(slot.id)&&ids.has(slot.id)!==old.has(slot.id))||[...ids].some(id=>selected.has(id)&&!possible.has(id))||!validPattern(ids))return;
   patterns.set(day.map(slot=>ids.has(slot.id)?'1':'0').join(''),ids);
  };
  // Enumerate small day grids exactly; bound unusually long custom grids by
  // adding/removing contiguous blocks instead of growing exponentially.
  if(day.length<=10)for(let mask=0;mask<2**day.length;mask++)add(new Set(day.filter((_,i)=>mask&(1<<i)).map(slot=>slot.id)));
  else {
   add(new Set());
   for(let start=0;start<day.length;start++)for(let length=1;length<=4&&start+length<=day.length;length++){
    const block=day.slice(start,start+length).map(slot=>slot.id);
    add(new Set(block));add(new Set([...old,...block]));add(new Set([...old].filter(id=>!block.includes(id))));
   }
  }
  return [...patterns.values()].filter(ids=>day.some(slot=>ids.has(slot.id)!==old.has(slot.id))).map(ids=>({teacher,slots:ids,delta:patternCost(teacher,ids)-base})).sort((a,b)=>a.delta-b.delta).slice(0,32);
 });
 const candidates:{patterns:Pattern[];delta:number}[]=[];
 for(let i=0;i<options.length;i++)for(const a of options[i]){
  if(a.delta<-1e-9)candidates.push({patterns:[a],delta:a.delta});
  for(let j=i+1;j<options.length;j++)for(const b of options[j])if(a.delta+b.delta<-1e-9)candidates.push({patterns:[a,b],delta:a.delta+b.delta});
 }
 candidates.sort((a,b)=>a.delta-b.delta||a.patterns.length-b.patterns.length);
 let attempts=0;
 for(const candidate of candidates){
  const patterns=new Map(current);for(const pattern of candidate.patterns)patterns.set(pattern.teacher.name,pattern.slots);
  // Do not spend the matching budget on obviously insufficient/excess staffing.
  if(day.filter(slot=>selected.has(slot.id)).some(slot=>{
   const available=teachers.filter(teacher=>patterns.get(teacher.name)!.has(slot.id)),pupils=at.get(slot.id)!;
   return available.length>pupils.length||available.reduce((sum,teacher)=>sum+teacher.max,0)<pupils.length||pupils.some(lesson=>!available.some(teacher=>canTeach(teacher,lesson,slot)));
  }))continue;
  if(++attempts>300)break;
  const changes=new Map<Lesson,string>();let feasible=true;
  for(const slot of day.filter(slot=>selected.has(slot.id))){
   const assigned=matchTeachingPeriod(at.get(slot.id)!,teachers.filter(teacher=>patterns.get(teacher.name)!.has(slot.id)),(teacher,lesson)=>canAttend(teacher,slot)&&canTeach(teacher,lesson,slot));
   if(!assigned){feasible=false;break;}
   for(const [lesson,name] of assigned)if(name!==lesson.teacher)changes.set(lesson,name);
  }
  if(!feasible||!changes.size)continue;
  const affected=new Set([...changes].flatMap(([lesson,name])=>[lesson.teacher,name]));
  if(apply(changes,teachers.filter(teacher=>affected.has(teacher.name))))return true;
 }
 return false;
}

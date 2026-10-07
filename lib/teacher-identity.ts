type Teacher={id?:string;archived?:boolean;name:string;email?:string};
type State={teachers:Teacher[];lessons:{teacher:string}[];availability:Record<string,string>;duty:Record<string,boolean>};
function renameKeys<T>(values:Record<string,T>,from:string,to:string){return Object.fromEntries(Object.entries(values).map(([key,value])=>[key.startsWith(from+'|')?to+key.slice(from.length):key,value]))}
export function renameTeacherReferences<T extends State>(state:T,from:string,to:string){if(from===to)return state;state.lessons.forEach(item=>{if(item.teacher===from)item.teacher=to});state.availability=renameKeys(state.availability,from,to);state.duty=renameKeys(state.duty,from,to);return state}
export function syncTeacherFromSlack<T extends State>(state:T,currentName:string,email:string|null,displayName:string|null){const next=structuredClone(state),teacher=next.teachers.find(item=>item.name===currentName);if(!teacher||teacher.archived)return null;const name=displayName?.trim()||currentName;if(name!==currentName&&next.teachers.some(item=>item.name===name))throw new Error('duplicate_teacher_name');teacher.name=name;teacher.email=email?.trim().toLowerCase()||'';renameTeacherReferences(next,currentName,name);return{state:next,teacherName:name}}

/** Retain identity, assignments, shifts and grants so restoring is reversible. */
export function setTeacherArchived<T extends State>(state:T,id:string,archived:boolean):T{
 const next=structuredClone(state),teacher=next.teachers.find(item=>item.id===id);
 if(!teacher)throw Error('スタッフが見つかりません');
 teacher.archived=archived;
 return next;
}

import type {State,Student,Lesson,Preference,EnrollmentPeriod} from './scheduler';
import {ensureSettings} from './settings';
export function statusAt(student:Student,date:string):'active'|'paused'|'withdrawn'|'outside'{
 const month=date.slice(0,7),ps=student.periods||[];
 if(ps.some(p=>p.status==='withdrawn'&&month>p.from))return 'withdrawn';
 if(ps.some(p=>p.status==='paused'&&month>=p.from&&(!p.until||month<=p.until)))return 'paused';
 const active=ps.filter(p=>p.status==='active');
 if(active.length&&!active.some(p=>month>=p.from&&(!p.until||month<=p.until)))return 'outside';
 return 'active';
}
export function studentForLesson(s:State,l:Lesson){return s.students?.find(st=>l.studentId?st.id===l.studentId:st.name===l.name&&s.slots.some(sl=>sl.id===l.slot&&sl.room===st.room))}
export function studentForPreference(s:State,p:Preference){return s.students?.find(st=>p.studentId?st.id===p.studentId:st.name===p.name&&st.room===p.room)}
export function ensureStudents(s:State):State{
 const n=ensureSettings(s);n.students||=[];
 for(const lesson of n.lessons)delete (lesson as Lesson&{confirmation?:unknown}).confirmation;
 const today=new Date().toISOString().slice(0,10);
 const register=(name:string,room:string,course:string)=>{let st=n.students!.find(st=>st.name===name&&st.room===room);if(!st){st={id:'student:'+room+':'+name,name,room,course:course||'未確認',ownsComputer:false,monthlyLessons:4,periods:[],reviewed:false};n.students!.push(st)}return st};
 const ordered=[...n.lessons].sort((a,b)=>{const da=n.slots.find(sl=>sl.id===a.slot)?.date||'',db=n.slots.find(sl=>sl.id===b.slot)?.date||'';return (da>today?1:0)-(db>today?1:0)||(da>today?da.localeCompare(db):db.localeCompare(da))});
 for(const l of ordered){if(l.studentId&&n.students.some(st=>st.id===l.studentId))continue;const sl=n.slots.find(x=>x.id===l.slot);if(sl)l.studentId=register(l.name,sl.room,l.course).id;}
 for(const p of n.preferences||[]){
  if(!Number.isInteger(p.weekday))p.weekday=p.anchor?new Date(p.anchor+'T12:00:00Z').getUTCDay():6;
  p.weeks=(p.weeks||[]).filter(week=>week>=1&&week<=4);
  if(!p.weeks.length)p.weeks=p.frequency==='biweekly'?[1,3]:[1,2,3,4];
  delete p.anchor;delete p.frequency;delete p.until;
 if(p.studentId&&n.students.some(st=>st.id===p.studentId))continue;p.studentId=register(p.name,p.room,p.course).id
 }
 for(const st of n.students){if(st.monthlyLessons!==2&&st.monthlyLessons!==4){const prefs=(n.preferences||[]).filter(p=>p.studentId===st.id);st.monthlyLessons=prefs.some(p=>p.weeks.length<=2)?2:4}}
 return n;
}
export function validatePeriods(periods:EnrollmentPeriod[]):string{
 for(const p of periods){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.from)||p.until&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.until))return 'ステータスの開始月・終了月を入力してください。';if(p.until&&p.until<p.from)return '終了月は開始月以降にしてください。'}
 const withdrawals=periods.filter(p=>p.status==='withdrawn');if(withdrawals.length>1)return '退会月は1件だけ登録してください。';
 const paused=periods.filter(p=>p.status==='paused');for(let i=0;i<paused.length;i++)for(let j=i+1;j<paused.length;j++)if(paused[i].from<=(paused[j].until||'9999-12')&&paused[j].from<=(paused[i].until||'9999-12'))return '休会期間が重複しています。';
 const w=withdrawals[0];if(w&&periods.some(p=>p!==w&&p.from>w.from))return '退会月より後に開始する在籍期間があります。';return '';
}
export function saveStudent(state:State,student:Student,preferences:Preference[]):State{
 const n=ensureStudents(state),old=n.students!.find(st=>st.id===student.id);
 n.students=[...n.students!.filter(st=>st.id!==student.id),{...student,reviewed:true}];
 for(const l of n.lessons)if(l.studentId===student.id){l.name=student.name;}
 n.preferences=[...(n.preferences||[]).filter(p=>p.studentId!==student.id),...preferences.map(p=>({...p,studentId:student.id,name:student.name,room:student.room,course:student.course}))];
 return n;
}

export function preferenceLabel(p:Preference){const day='日月火水木金土'[p.weekday];return `第${p.priority||1}希望 · 毎月第${p.weeks.join('・')}${day}曜日 ${p.start}〜${p.end}`}

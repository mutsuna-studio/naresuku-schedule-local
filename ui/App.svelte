<script lang="ts">
import {onMount,tick} from 'svelte';
import {createScheduleRefresh} from './schedule-refresh';
import ConflictComparison from './ConflictComparison.svelte';
import {saveWithMerge,mergeSchedule,retainConflictChoices,saveSummaryMessage,type SaveConflict,type SaveOrigin} from '../lib/schedule-merge';
let {onReady,initialSchedule}:{onReady?:()=>void;initialSchedule?:Promise<Response|null>}=$props();
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import {Checkbox} from '@mutsuna/ui/checkbox';
import {AdminShellFrame} from '@mutsuna/ui/admin-shell-frame';
import {AdminPage,AdminPanel} from '@mutsuna/ui/admin-layout';
import * as Card from '@mutsuna/ui/card';
import AppSidebar from './AppSidebar.svelte';
let attendanceStartToday=$state(false);
function openTodayAttendance(){requestNavigation(()=>{attendanceStartToday=true;tab='attendance'},'attendance')}
import NextMonthAction from './NextMonthAction.svelte';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import * as DropdownMenu from '@mutsuna/ui/dropdown-menu';
import {Toaster,showSuccessToast,showErrorToast} from '@mutsuna/ui/sonner';
import {ThemeProvider,createTheme,hexToOklch} from '@mutsuna/ui/theme';
import {Loading} from '@mutsuna/ui/loading';
import {CalendarDays,Clock3,Users,WandSparkles,Plus,Download,ChevronLeft,ChevronRight,ChevronDown,Laptop,TriangleAlert,Check,GraduationCap,Save,Settings2,RotateCcw,ExternalLink} from '@lucide/svelte';
import Picker from './Picker.svelte';
import SlackLogin from './SlackLogin.svelte';
import MasterLogin from './MasterLogin.svelte';
import CalendarPicker from './CalendarPicker.svelte';
import MonthNavigator from './MonthNavigator.svelte';
import MonthCalendar from './MonthCalendar.svelte';
import {canOpenTeacherShift} from './shift-navigation';
import DateText from './DateText.svelte';
import CourseLabel from './CourseLabel.svelte';
import StudentMonthLessons from './StudentMonthLessons.svelte';
import LessonNote from './LessonNote.svelte';
import InlineLessonNote from './InlineLessonNote.svelte';
import AssignmentPreview from './AssignmentPreview.svelte';
import WorkAssignmentEditor from './WorkAssignmentEditor.svelte';
import {scheduledForWork,workAt,workConflict} from '../lib/work-assignments';
let workEditor:WorkAssignmentEditor;
const loadMessages=()=>import('./Messages.svelte');
const loadStudentImports=()=>import('./StudentImports.svelte');
const loadStudents=()=>import('./Students.svelte');
import LineMessages from './LineMessages.svelte';
import TransferCandidates from './TransferCandidates.svelte';
const loadPlacementStatus=()=>import('./PlacementStatus.svelte');
const loadShifts=()=>import('./Shifts.svelte');
const loadSettings=()=>import('./Settings.svelte');
const loadTeachers=()=>import('./Teachers.svelte');
const loadAccount=()=>import('./Account.svelte');
const loadAttendance=()=>import('./Attendance.svelte');
const loadMasterAttendance=()=>import('./MasterAttendance.svelte');
const loadFeedback=()=>import('./Feedback.svelte');
let attendanceEditor=$state<{guard:(action:()=>void)=>void;isDirty:()=>boolean}>();
import {ensureStudents,studentForLesson} from '../lib/students';
import {type State,type Lesson,issues,autoAssign,monthAssignmentScope,key} from '../lib/scheduler';
import {rejectRequest} from '../lib/reject-request';
import TeacherUnassignPopover from './TeacherUnassignPopover.svelte';
import {unassignTeacherDay} from '../lib/unassign-teacher-day';
import {moveLesson} from '../lib/move-lesson';
import {restoreNavigation,persistNavigation,clearNavigation,cleanNavigationUrl,createNavigationHistory} from './navigation';
import {configuredSlots,generate} from '../lib/recurrence';
import {openingScheduleDate,dayViewDate,scheduleDatesForTwoMonths} from '../lib/schedule-date';
const theme={
  ...createTheme('custom',hexToOklch('#78365F')),
  primaryForeground:hexToOklch('#F7EEF4'),
  sidebarPrimary:hexToOklch('#78365F'),
  sidebarPrimaryForeground:hexToOklch('#F7EEF4')
};
function horizontalDateScroll(node:HTMLDivElement,selectedDate:string){
 let frame=0;
 const showSelected=(value:string,behavior:ScrollBehavior)=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   const selected=node.querySelector<HTMLElement>(`[data-date="${CSS.escape(value)}"]`);
   if(!selected)return;
   const left=selected.getBoundingClientRect().left-node.getBoundingClientRect().left+node.scrollLeft-5;
   node.scrollTo({left,behavior});
  });
 };
 const onWheel=(event:WheelEvent)=>{
  if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
  const max=node.scrollWidth-node.clientWidth;
  if(max<=0)return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientWidth:1);
  const next=Math.max(0,Math.min(max,node.scrollLeft+delta));
  if(next===node.scrollLeft)return;
  event.preventDefault();node.scrollLeft=next;
 };
 node.addEventListener('wheel',onWheel,{passive:false});
 showSelected(selectedDate,'auto');
 return{update(value:string){showSelected(value,'smooth')},destroy(){cancelAnimationFrame(frame);node.removeEventListener('wheel',onWheel)}};
}
const todayJapan=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const empty:State={slots:[],lessons:[],teachers:[],availability:{},duty:{},history:[]};
let savedState:State|null=null;
let resetVersion=$state(0);
let sidebarOpen=$state(true);
// Choose the initial layout once; subsequent opening and closing belongs to the user.
onMount(()=>{sidebarOpen=window.matchMedia('(min-width: 1200px)').matches});
let pendingNavigation=$state<(()=>void)|null>(null);
let data=$state.raw<State|null>(null),revision=$state(0),dirty=$state(false),saving=$state(false),error=$state('');
let auth=$state<'loading'|'required'|'admin'|'staff'>('loading'),password=$state(''),loggingIn=$state(false);
let roomAdmin=$state(false);
let offlineShell=$state(!navigator.onLine);
let slackAvatarUrl=$state<string|undefined>();
let accountName=$state('マスター'),accountEmail=$state('管理者アカウント'),slackName=$state(''),slackEmail=$state('');
let staffState=$state<'login'|'select'|'awaiting'>('login'),staffCandidates=$state<string[]>([]),staffSelection=$state('');
let room=$state(''),date=$state(todayJapan),tab=$state('schedule'),teacher=$state('');
$effect(()=>{if(tab!=='attendance')attendanceStartToday=false});
let scheduleView=$state<'day'|'month'>('day');
let draggingLesson=$state('');
let dragFrame:number|undefined;
function endLessonDrag(){if(dragFrame!==undefined)cancelAnimationFrame(dragFrame);dragFrame=undefined;draggingLesson=''}
let viewing=$state<Lesson|null>(null);
let transferDialog=$state<ReturnType<typeof TransferCandidates>>();
async function openLessonTransfer(){const id=viewing?.id;if(auth!=='admin'||!id||!await noteEditor?.flush())return;viewing=null;await tick();transferDialog?.launch(id)}
let changingAbsence=$state(false);
let noteBlocked=$state(false);
let noteEditor=$state<InlineLessonNote>();
async function closeLessonDetails(){if(await noteEditor?.flush())viewing=null}
async function editLessonDetails(){if(viewing&&await noteEditor?.flush()){edit={...viewing};viewing=null}}
async function saveInlineNote(id:string,note:string,previousNote:string){
 if(auth==='admin'){
  change(next=>{const target=next.lessons.find(item=>item.id===id);if(target)target.note=note},'授業メモを更新');
 }else{
  const response=await fetch('/api/lesson-note',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:id,note,previousNote})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'メモを保存できませんでした');
  if(data){const next=structuredClone(data),target=next.lessons.find(item=>item.id===id);if(target)target.note=note;data=next}
  const saved=savedState?.lessons.find(item=>item.id===id);if(saved)saved.note=note;
 }
 if(viewing?.id===id)viewing={...viewing,note};
}
let progressHover=$state<{name:string;url:string;title:string;left:number;top:number}|null>(null);
let progressHideTimer:ReturnType<typeof setTimeout>|undefined;
const sheetTitleCache=new Map<string,string|null>();
let edit=$state<Lesson|null>(null),proposal=$state.raw<ReturnType<typeof autoAssign>|null>(null),proposalScope=$state<string[]>([]),proposalLabel=$state('');
let generation=$state.raw<ReturnType<typeof generate>|null>(null);
let studentToEdit=$state('');
let messageStudentId=$state('');
function openMessages(studentId:string){requestNavigation(()=>{messageStudentId=studentId;tab='messages'},'messages')}
function canOpenShift(name:string){return canOpenTeacherShift(s,auth,teacher,rooms,room,name)}
function openTeacherShift(name:string){if(!canOpenShift(name))return;requestNavigation(()=>{if(!canOpenShift(name))return;teacher=name;tab='shifts'},'shifts')}
function openStudent(name=''){requestNavigation(()=>{studentToEdit=name;tab='students'},'students')}
function requestNavigation(action:()=>void,targetTab:string,targetRoom=room){
  if(saving||pendingNavigation)return;
  if(tab==='attendance'&&(targetTab!==tab||targetRoom!==room)&&attendanceEditor){attendanceEditor.guard(action);return}
  if(dirty&&(targetTab!==tab||targetRoom!==room)){pendingNavigation=action;return}
  action();
}
function discardChanges(){
  if(saving||!savedState)return;
  data=structuredClone(savedState);dirty=false;error='';clearConflictSelection();
  viewing=null;edit=null;proposal=null;generation=null;studentToEdit='';
  resetVersion++;
}
async function resolveNavigation(mode:'save'|'discard'){
  const action=pendingNavigation;if(!action||saving)return;
  if(mode==='save'&&!await save())return;
  if(mode==='discard')discardChanges();
  viewing=null;edit=null;proposal=null;generation=null;pendingNavigation=null;action();
}
function selectTab(value:string){requestNavigation(()=>{tab=value;if(value==='messages')messageStudentId='';if(value==='schedule'){date=openingScheduleDate(s,room,todayJapan);scheduleView='day'}},value)}
function viewLesson(lesson:Lesson){viewing={...lesson}}
const s=$derived(data||empty),rooms=$derived(s.settings?.campuses||[...new Set([...s.slots.map(x=>x.room),...(s.students||[]).map(x=>x.room)])]);
const hasTodayAttendance=$derived((auth==='staff'||roomAdmin)&&s.slots.some(slot=>slot.room===room&&slot.date===todayJapan&&scheduledForWork(s,auth==='staff'?teacher:accountName,slot.id)));
function groupLessons(lessons:Lesson[]){const groups=new Map<string,Lesson[]>();for(const lesson of lessons){const group=groups.get(lesson.slot);if(group)group.push(lesson);else groups.set(lesson.slot,[lesson])}return groups}
const lessonsBySlot=$derived(groupLessons(s.lessons));
const lessonsAt=(slot:string)=>lessonsBySlot.get(slot)||[];
const hasAssignment=(name:string,slot:string)=>lessonsAt(slot).some(lesson=>lesson.teacher===name&&!lesson.absent)||workAt(s,name,slot).length>0;
const attendanceOnly=(slot:string)=>s.teachers.filter(t=>scheduledForWork(s,t.name,slot)&&!hasAssignment(t.name,slot)).map(t=>t.name);
const allIssues=$derived(issues(s));
const daySlots=$derived(s.slots.filter(x=>x.room===room&&x.date===date).sort((a,b)=>a.start.localeCompare(b.start)));
const visible=$derived(s.lessons.filter(l=>daySlots.some(x=>x.id===l.slot)));
const relevant=$derived(allIssues.filter(i=>s.slots.some(sl=>sl.id===i.slot&&sl.room===room&&(scheduleView==='month'?sl.date.startsWith(date.slice(0,7)):sl.date===date))));
const upcomingDays=$derived(scheduleDatesForTwoMonths(s,room,todayJapan.slice(0,7)));
const roomScheduleDays=$derived([...new Set(s.slots.filter(slot=>slot.room===room).map(slot=>slot.date))].sort());
const previousScheduleDay=$derived(roomScheduleDays.reduce((found,day)=>day<date?day:found,''));
const nextScheduleDay=$derived(roomScheduleDays.find(day=>day>date)||'');
const draggedLesson=$derived(s.lessons.find(lesson=>lesson.id===draggingLesson));
const dragTeachers=$derived(draggedLesson?s.teachers.filter(t=>t.rooms?.includes(room)&&t.curricula?.includes(draggedLesson.course)):[]);
const pages:Record<string,{title:string;description:string}>={attendance:{title:'勤怠',description:'自分の勤怠を登録して勤怠システムへ反映します。'},imports:{title:'生徒取り込み',description:'シートから届いた生徒情報を確認して反映します。'},messages:{title:'メッセージ',description:'保護者から届いたLINEメッセージを確認します。'},schedule:{title:'授業スケジュール',description:'生徒の予定とスタッフの希望を照合し、授業の担当を調整します。'},placement:{title:'月の配置確認',description:'契約回数に対して、生徒の授業予定が不足していないか確認します。'},shifts:{title:'シフト希望',description:'スタッフ名を選び、出勤できる時間を入力してください。'},students:{title:'生徒一覧',description:'所属教室・カリキュラム・契約回数・希望スケジュール・在籍期間を管理します。'},teachers:{title:'スタッフ',description:'スタッフの担当教室・カリキュラム・担当上限を管理します。'},settings:{title:'設定',description:'カリキュラム、教室、曜日ごとの開催コマと時間を管理します。'},history:{title:'変更履歴',description:'授業・シフト・保護者申請の変更を確認できます。'},feedback:{title:'フィードバック',description:'ナレスクへの意見や改善案を送ります。'},account:{title:'アカウント',description:'自分の登録情報とSlack連携を確認します。'}};
const dateLabel=(v:string)=>new Date(v+'T12:00:00Z').toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'});
function teacherNames(state:State){return [...new Set([...state.teachers.map(item=>item.name),...state.lessons.map(item=>item.teacher).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ja'))}
const teacherIndices=$derived(new Map(teacherNames(s).map((name,index)=>[name,index])));
function teacherIndex(name:string){return teacherIndices.get(name)??teacherIndices.size}
// Distinct categorical colors; assignment is shared across dates, rooms and views.
const teacherPalette=[
  ['#1764c0','#ffffff','#1764c0'], // blue
  ['#ef8b00','#241600','#925000'], // orange
  ['#23853b','#ffffff','#237534'], // green
  ['#803db3','#ffffff','#803db3'], // purple
  ['#d32f36','#ffffff','#bd252c'], // red
  ['#08a7bc','#062d33','#007586'], // cyan
  ['#e3c600','#302900','#756600'], // yellow
  ['#e579b5','#3d102a','#a32d73'], // pink
  ['#795035','#ffffff','#795035'], // brown
  ['#37474f','#ffffff','#37474f'], // charcoal
];
function teacherStyle(name:string){const index=teacherIndex(name),fallback=`oklch(0.48 0.17 ${(22+index*137.508)%360})`,[color,foreground,ink]=teacherPalette[index]||[fallback,'#ffffff',fallback];return `--teacher-color:${color};--teacher-foreground:${foreground};--teacher-ink:${ink};--teacher-bg:color-mix(in srgb,${color} 13%,var(--surface-raised))`}
const teacherLayout=$derived.by(()=>{const segments:{name:string;start:number;end:number;lane:number}[]=[];for(const name of teacherNames(s)){const active=daySlots.map((slot,index)=>hasAssignment(name,slot.id)?index:-1).filter(index=>index>=0);let start=-1,previous=-2;for(const period of [...active,Number.POSITIVE_INFINITY]){if(start<0){start=period;previous=period;continue}if(period===previous+1){previous=period;continue}segments.push({name,start,end:previous,lane:0});start=period;previous=period}}segments.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||a.name.localeCompare(b.name,'ja'));const laneEnds:number[]=[];for(const segment of segments){let lane=laneEnds.findIndex(end=>end<segment.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=segment.end;segment.lane=lane}return {items:segments,count:laneEnds.length}});
let navigationHistory:ReturnType<typeof createNavigationHistory>|undefined;
function historyNavigation(){
  if(auth!=='admin'&&auth!=='staff')return null;
  return navigationHistory?.read(auth+':'+(auth==='staff'?teacher:''),value=>restoreNavigation(location.origin+'/',auth==='staff'?'staff':'admin',rooms,{tab:auth==='staff'?'shifts':'schedule',room,date,scheduleView:'day'},()=>({getItem:()=>JSON.stringify(value),setItem(){},removeItem(){}})));
}
function restoreHistory(){
  if(!data)return;
  if(navigationHistory?.guard(next=>(dirty||saving||!!attendanceEditor?.isDirty())&&(next.tab!==tab||next.room!==room),resume=>{if(tab==='attendance'&&attendanceEditor)attendanceEditor.guard(resume);else pendingNavigation=resume}))return;
  const restored=historyNavigation();
  if(restored){({tab,room,date,scheduleView}=restored);viewing=null;edit=null;proposal=null;generation=null;studentToEdit='';persistNavigation(restored,()=>window.sessionStorage)}
}
async function load(preserveTabOrEvent:boolean|MouseEvent=false){if(!navigator.onLine){if(!data)offlineShell=true;return}const preserveTab=preserveTabOrEvent===true,initialLoad=!data;try{const pending=initialSchedule;initialSchedule=undefined;const r=(pending?await pending:null)??await fetch('/api/schedule');if(r.status===401){offlineShell=false;auth='required';data=null;staffState='login';error='';const session=await fetch('/api/slack-staff/session');if(session.ok){const info=await session.json();if(info.status==='select_teacher'){staffState='select';staffCandidates=info.candidates||[];staffSelection=staffCandidates[0]||''}else if(info.status==='awaiting_approval')staffState='awaiting'}return}if(!r.ok){const detail=await r.json().catch(()=>null);throw Error(detail?.error||(r.status===403?'アクセスが拒否されました。ログイン状態とアクセス権限を確認してください。':'データを読み込めませんでした'))}const j=await r.json();offlineShell=false;slackAvatarUrl=j.slackProfile?.picture||undefined;data=ensureStudents(j.state);savedState=structuredClone(data);revision=j.revision;dirty=false;error='';clearConflictSelection();roomAdmin=j.role==='room-admin';auth=j.role==='staff'?'staff':'admin';if(auth==='staff'){teacher=j.teacherName||'';accountName=j.profile?.name||teacher;accountEmail=j.profile?.email||'';slackName=j.slackProfile?.name||'';slackEmail=j.slackProfile?.email||'';if(!preserveTab)tab='shifts';const assigned=data.teachers.find(item=>item.name===teacher)?.rooms||[];if(assigned.length)room=assigned[0]}else{accountName=roomAdmin?j.teacherName:'マスター';accountEmail=roomAdmin?'管理者':'マスターアカウント';slackName='';slackEmail=''}if(initialLoad){if(!rooms.includes(room))room=rooms[0]||'';date=openingScheduleDate(data,room,todayJapan);const restored=historyNavigation()||restoreNavigation(location.href,auth,rooms,{tab,room,date,scheduleView},()=>window.sessionStorage);({tab,room,date,scheduleView}=restored)}}catch(e){if(!data&&(e instanceof TypeError||!navigator.onLine))offlineShell=true;error=(e as Error).message}}
async function login(){if(loggingIn||!password)return;loggingIn=true;error='';try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const text=await r.text();let j:{error?:string}={};try{j=text?JSON.parse(text):{}}catch{}if(!r.ok)throw Error(j.error||'ログインできませんでした。時間をおいて再試行してください');password='';await load()}catch(e){error=(e as Error).message}finally{loggingIn=false}}
async function requestStaffLink(){if(!staffSelection)return;const response=await fetch('/api/slack-staff/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teacherName:staffSelection})}),result=await response.json();if(!response.ok){error=result.error||'申請できませんでした';return}staffState='awaiting'}
async function logout(){clearConflictSelection();navigationHistory?.reset();clearNavigation(()=>window.sessionStorage);await Promise.all([fetch('/api/auth/logout',{method:'POST'}),fetch('/api/auth/slack/logout',{method:'POST'})]);data=null;slackAvatarUrl=undefined;auth='required';staffState='login';password='';tab='schedule';scheduleView='day';room='';date=todayJapan}
async function unlinkSlack(){try{const response=await fetch('/api/slack-staff/session',{method:'DELETE'}),result=await response.json();if(!response.ok)throw Error(result.error||'Slack連携を解除できませんでした');showSuccessToast('Slack連携を解除しました');await logout();return true}catch(e){showErrorToast('Slack連携を解除できませんでした',(e as Error).message);return false}}
async function saveAccount(value:{name:string;email:string;curricula:string[]}){try{const response=await fetch('/api/slack-staff/session',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),result=await response.json();if(!response.ok)throw Error(result.error||'アカウント情報を保存できませんでした');showSuccessToast('アカウント情報を保存しました');await load(true);return true}catch(e){showErrorToast('保存できませんでした',(e as Error).message);return false}}
async function syncAccount(field:'name'|'email'){const curricula=s.teachers.find(item=>item.name===teacher)?.curricula||[],value={name:field==='name'?slackName:accountName,email:field==='email'?slackEmail:accountEmail,curricula};if(!value[field]){showErrorToast('Slackの情報を取得できませんでした','Slackへ再ログインしてからお試しください');return false}return saveAccount(value)}
function removeLesson(lesson:Lesson){if(auth!=='admin'||!s.lessons.some(item=>item.id===lesson.id))return;change(next=>{next.lessons=next.lessons.filter(item=>item.id!==lesson.id);if(lesson.teacher&&!next.lessons.some(item=>item.slot===lesson.slot&&item.teacher===lesson.teacher&&!item.absent))delete next.duty[key(lesson.teacher,lesson.slot)]},`${lesson.name}さんを${dateLabel(s.slots.find(slot=>slot.id===lesson.slot)?.date||date)}の授業から外した`);viewing=null;edit=null;showSuccessToast('授業から外しました','右上の「変更を保存」で確定します')}
async function setLessonAbsence(){if(!viewing||changingAbsence||!await noteEditor?.flush())return;const lesson=$state.snapshot(viewing),absent=!lesson.absent;if(auth==='admin'){change(next=>{const target=next.lessons.find(item=>item.id===lesson.id);if(!target)return;target.absent=absent;if(absent&&target.teacher&&!next.lessons.some(item=>item.id!==target.id&&item.slot===target.slot&&item.teacher===target.teacher&&!item.absent))delete next.duty[key(target.teacher,target.slot)];if(!absent&&target.teacher)next.duty[key(target.teacher,target.slot)]=true},`${lesson.name}さんを${absent?'欠席に変更':'出席に戻した'}`);viewing=null;showSuccessToast(absent?'欠席に変更しました':'出席に戻しました','右上の「変更を保存」で確定します');return}changingAbsence=true;try{const response=await fetch('/api/lesson-absence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,absent})}),result=await response.json();if(!response.ok)throw Error(result.error||'欠席情報を更新できませんでした');viewing=null;await load(true);showSuccessToast(absent?'欠席に変更しました':'出席に戻しました')}catch(e){showErrorToast('欠席情報を更新できませんでした',(e as Error).message)}finally{changingAbsence=false}}
$effect(()=>{if(data&&(auth==='admin'||auth==='staff')){persistNavigation({tab,room,date,scheduleView},()=>window.sessionStorage);const url=cleanNavigationUrl(location.href);navigationHistory?.sync({tab,room,date,scheduleView},auth+':'+(auth==='staff'?teacher:''),url);if(url!==location.href)window.history.replaceState(window.history.state,'',url)}});
onMount(()=>{navigationHistory=createNavigationHistory(window.history);window.addEventListener('popstate',restoreHistory);document.documentElement.classList.add('admin-theme');let active=true;load().finally(async()=>{await tick();if(active)onReady?.()});const warn=(e:BeforeUnloadEvent)=>{if(dirty||noteBlocked){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>{active=false;window.removeEventListener('popstate',restoreHistory);navigationHistory=undefined;document.documentElement.classList.remove('admin-theme');window.removeEventListener('beforeunload',warn)}});
$effect(()=>{document.title=`ナレスク | ${pages[tab]?.title||'授業スケジュール'}`});
$effect(()=>{if(auth==='staff'&&edit){viewing={...edit};edit=null}});
function mutate(next:State,text:string){next=ensureStudents(next);next.history=[{at:new Date().toISOString(),text},...s.history].slice(0,100);data=next;dirty=true}
function change(f:(n:State)=>void,text:string){const n=structuredClone(s);f(n);mutate(n,text)}
function normalizedState(state:State){const next=structuredClone(state),teachers=teacherNames(next),teacherOrder=new Map(teachers.map((name,index)=>[name,index])),slots=[...next.slots].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.room.localeCompare(b.room,'ja')||a.id.localeCompare(b.id)),slotOrder=new Map(slots.map((slot,index)=>[slot.id,index]));next.teachers.sort((a,b)=>(teacherOrder.get(a.name)??999)-(teacherOrder.get(b.name)??999));next.lessons.sort((a,b)=>(slotOrder.get(a.slot)??999999)-(slotOrder.get(b.slot)??999999)||(teacherOrder.get(a.teacher)??999999)-(teacherOrder.get(b.teacher)??999999)||a.name.localeCompare(b.name,'ja'));return next}
let saveConflict=$state.raw<SaveConflict|null>(null);
let rememberedConflict=$state.raw<SaveConflict|null>(null);
onMount(()=>{
 const sync=createScheduleRefresh({
  snapshot:()=>document.visibilityState==='visible'&&(tab==='schedule'||tab==='shifts')&&
   (auth==='admin'||auth==='staff')&&!dirty&&!saving&&!error&&!edit&&!viewing&&!proposal&&!generation&&
   !pendingNavigation&&!saveConflict&&!noteBlocked&&!changingAbsence&&!draggingLesson&&
   !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')&&
   !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')?data:null,
  revision:()=>revision,
  fetch:(...args)=>fetch(...args),
  apply:value=>{
   const role=roomAdmin?'room-admin':auth;
   if(value.role!==role||(auth==='staff'&&value.teacherName!==teacher)){
    location.reload();return;
   }
   data=ensureStudents(value.state);savedState=structuredClone(data);revision=value.revision;resetVersion++;
   if(!rooms.includes(room))room=rooms[0]||'';
  }
 });
 const refresh=()=>{void sync.refresh()};
 const reconnect=()=>{if(!data){void load(true)}else{void sync.reconnect()}};
 const timer=setInterval(refresh,15000);
 document.addEventListener('visibilitychange',refresh);
 globalThis.addEventListener('online',reconnect);
 return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);globalThis.removeEventListener('online',reconnect);sync.stop()};
});
let conflictChoices=$state<Record<string,'local'|'remote'>>({});
function clearConflictSelection(){saveConflict=null;rememberedConflict=null;conflictChoices={}}
async function persistSchedule(local:State,base:State,version:number,origin?:SaveOrigin){
 saving=true;error='';
 try{
  const result=await saveWithMerge(fetch,base,local,version,ensureStudents,origin);
  if(result.kind==='conflict'){conflictChoices=retainConflictChoices(rememberedConflict?.conflicts||[],result.conflicts,conflictChoices);rememberedConflict=result;saveConflict=result;return false}
  data=result.state;savedState=structuredClone(result.state);revision=result.revision;dirty=false;clearConflictSelection();resetVersion++;
  showSuccessToast(result.merged?'ほかの変更と統合して保存しました':'変更を保存しました',saveSummaryMessage(result.summary));
  return true;
 }catch(e){error=(e as Error).message;showErrorToast('保存できませんでした',error);return false}
 finally{saving=false}
}
async function save(){if(saving)return false;return persistSchedule(normalizedState(s),savedState||s,revision)}
async function resolveSaveConflict(){
 if(!saveConflict||saving||saveConflict.conflicts.some(item=>!conflictChoices[item.id]))return;
 const pending=saveConflict;
 let resolved;
 try{resolved=mergeSchedule(pending.base,pending.local,pending.remote,conflictChoices)}catch(e){showErrorToast('統合できませんでした',(e as Error).message);return}
 if(await persistSchedule(resolved.state,pending.remote,pending.revision,pending.origin)){
  const navigate=pendingNavigation;pendingNavigation=null;navigate?.();
 }
}

function newLesson(slot:string){if(auth!=='admin')return;if(!(s.students||[]).some(student=>student.room===room)){showErrorToast('この教室には生徒が登録されていません','先に生徒一覧から登録してください');return}edit={id:crypto.randomUUID(),slot,name:'',course:'',note:'',teacher:'',exam:false,absent:false}}
function selectStudent(studentId:string){if(!edit)return;const student=s.students?.find(x=>x.id===studentId);if(student)edit={...edit,studentId:student.id,name:student.name,course:student.course}}
function progressLinkForLesson(lesson:Lesson){return studentForLesson(s,lesson)?.progressSheetUrl?.trim()||''}
function ownsComputer(lesson:Lesson){return !!studentForLesson(s,lesson)?.ownsComputer}
function cancelProgressHide(){if(progressHideTimer){clearTimeout(progressHideTimer);progressHideTimer=undefined}}
function clearProgressHover(){cancelProgressHide();progressHover=null}
function scheduleProgressHide(){cancelProgressHide();progressHideTimer=setTimeout(()=>{progressHover=null;progressHideTimer=undefined},120)}
async function loadSheetTitle(url:string){if(sheetTitleCache.has(url))return sheetTitleCache.get(url)||'';try{const response=await fetch('/api/sheet-metadata?url='+encodeURIComponent(url)),result=await response.json() as {title?:string|null};const title=response.ok&&result.title?result.title:'';sheetTitleCache.set(url,title||null);return title}catch{sheetTitleCache.set(url,null);return ''}}
async function showProgressHover(event:MouseEvent,lesson:Lesson,url:string){if(!url||draggingLesson)return;cancelProgressHide();const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(),width=240,gap=10;let left=rect.right+gap;if(left+width>window.innerWidth-8)left=rect.left-width-gap;progressHover={name:lesson.name,url,title:sheetTitleCache.get(url)||'',left:Math.max(8,left),top:Math.max(8,Math.min(rect.top,window.innerHeight-82))};const title=await loadSheetTitle(url);if(progressHover?.url===url)progressHover={...progressHover,title}}
function startLessonDrag(event:DragEvent,lessonId:string){if(auth!=='admin'){event.preventDefault();return}clearProgressHover();if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',lessonId)}if(dragFrame!==undefined)cancelAnimationFrame(dragFrame);dragFrame=requestAnimationFrame(()=>{dragFrame=undefined;draggingLesson=lessonId})}
function canDropLesson(slotId:string){const slot=s.slots.find(slot=>slot.id===slotId);return auth==='admin'&&!!draggingLesson&&!!slot&&slot.room===room&&(scheduleView==='month'?slot.date.startsWith(date.slice(0,7)):daySlots.some(item=>item.id===slotId))&&s.lessons.some(lesson=>lesson.id===draggingLesson&&!lesson.absent)}
function dropLesson(event:DragEvent,slotId:string,teacherName:string){event.preventDefault();event.stopPropagation();if(auth!=='admin')return;const lessonId=draggingLesson||event.dataTransfer?.getData('text/plain')||'',lesson=s.lessons.find(item=>item.id===lessonId);endLessonDrag();if(!lesson)return;const targetSlot=s.slots.find(slot=>slot.id===slotId);if(targetSlot&&teacherName&&workConflict(s,teacherName,targetSlot)){showErrorToast('固定業務と時間が重複しています');return}const next=structuredClone(s);if(!moveLesson(next,lessonId,slotId,teacherName,{allowDateChange:scheduleView==='month'}))return;const destination=s.slots.find(slot=>slot.id===slotId)!;mutate(next,`${lesson.name}の授業を${destination.date} ${destination.start}〜・${teacherName||'担当未定'}に変更`)}
function teacherUnassignOptions(name:string){return daySlots.map((slot,index)=>({...slot,period:index+1})).filter(slot=>s.lessons.some(lesson=>lesson.slot===slot.id&&lesson.teacher===name&&!lesson.absent))}
function clearTeacherDay(name:string,selected:string[]){
 if(auth!=='admin')return;
 if(!selected.length)return;
 const next=structuredClone(s),count=unassignTeacherDay(next,name,room,date,selected);
 if(!count)return;
 mutate(next,`${name}の${dateLabel(date)}の授業${count}件を担当未定に変更`);
 const remaining=daySlots.filter(slot=>selected.includes(slot.id)&&scheduledForWork(next,name,slot.id));
 const staff=next.teachers.find(item=>item.name===name);
 const reasons=[remaining.some(slot=>workAt(next,name,slot.id).length)?'固定業務':null,remaining.some(slot=>staff?.autoAttendance&&staff.rooms?.includes(slot.room)&&next.availability[key(name,slot.id)]==='yes')?'シフト希望○による出勤予定':null].filter(Boolean);
 showSuccessToast(`${count}件を担当未定にしました`,`${reasons.length?reasons.join('・')+'は残っています。':''}右上の「変更を保存」で確定します`);
}
function hasDayLessons(name:string){return daySlots.some(slot=>s.lessons.some(lesson=>lesson.slot===slot.id&&lesson.teacher===name&&!lesson.absent))}
function updateLesson(){if(edit?.teacher&&!edit.absent){const slot=s.slots.find(item=>item.id===edit!.slot);if(slot&&workConflict(s,edit.teacher,slot)){showErrorToast('固定業務と時間が重複しています','別の担当者または時間帯を選択してください');return}}if(auth!=='admin'){edit=null;return}if(!edit?.name.trim()){showErrorToast('生徒名を入力してください');return}const e=$state.snapshot(edit);change(n=>{const i=n.lessons.findIndex(l=>l.id===e.id),prior=i>=0?n.lessons[i]:null;if(i>=0)n.lessons[i]=e;else n.lessons.push(e);if(prior?.teacher&&!n.lessons.some(l=>!l.absent&&l.slot===prior.slot&&l.teacher===prior.teacher))delete n.duty[key(prior.teacher,prior.slot)];if(e.teacher&&!e.absent)n.duty[key(e.teacher,e.slot)]=true},e.name+'さんの授業を更新');edit=null}
function transfer(slot:string){if(edit)edit={...edit,slot,originalDate:edit.originalDate||s.slots.find(sl=>sl.id===edit!.slot)?.date,teacher:''}}
function rejectParentRequest(lessonId:string){if(auth!=='admin')return;const lesson=s.lessons.find(item=>item.id===lessonId);if(!lesson||!s.slots.some(slot=>slot.id===lesson.slot))return;change(next=>{rejectRequest(next,lessonId)},lesson.name+'さんの振替希望を拒否し元の授業に戻した');showSuccessToast('元の授業に戻しました','右上の「変更を保存」で確定します')}
function adoptParentRequest(lessonId:string,slotId:string,priority:number){const lesson=s.lessons.find(item=>item.id===lessonId),slot=s.slots.find(item=>item.id===slotId);if(!lesson||!slot){showErrorToast('希望枠を採用できませんでした','授業枠が変更されているため、予定を確認してください');return}change(next=>{const target=next.lessons.find(item=>item.id===lessonId);if(!target)return;const previousSlot=target.slot,previousTeacher=target.teacher;target.originalDate=target.originalDate||next.slots.find(item=>item.id===previousSlot)?.date;target.slot=slotId;target.teacher='';target.absent=false;target.note=[target.note,target.request?`保護者申請：${target.request}`:''].filter(Boolean).join(' / ');target.request='';target.requestData=undefined;delete target.requestRestore;if(previousTeacher&&!next.lessons.some(item=>item.id!==lessonId&&!item.absent&&item.slot===previousSlot&&item.teacher===previousTeacher))delete next.duty[key(previousTeacher,previousSlot)]},lesson.name+`さんの第${priority}希望を採用`);showSuccessToast(`第${priority}希望を採用しました`,'右上の「変更を保存」で確定します')}
function transferDate(targetDate:string){if(!edit)return;const current=s.slots.find(slot=>slot.id===edit!.slot),currentDaySlots=s.slots.filter(slot=>slot.room===room&&slot.date===current?.date).sort((a,b)=>a.start.localeCompare(b.start)),targetSlots=s.slots.filter(slot=>slot.room===room&&slot.date===targetDate).sort((a,b)=>a.start.localeCompare(b.start)),period=Math.max(0,currentDaySlots.findIndex(slot=>slot.id===edit!.slot));if(targetSlots.length)transfer(targetSlots[Math.min(period,targetSlots.length-1)].id)}
function moveToScheduleDay(direction:'previous'|'next'){const target=direction==='previous'?previousScheduleDay:nextScheduleDay;if(target)date=target}
function propose(month=false,mode:'fill'|'rebuild'='fill'){proposalScope=month?monthAssignmentScope(s,room,date.slice(0,7)):daySlots.map(sl=>sl.id);proposalLabel=month?date.slice(0,7)+'（今日以降）':dateLabel(date);proposalLabel+=' · '+(mode==='fill'?'未担当を埋める':'全体を組み直す');proposal=autoAssign(s,proposalScope,mode,{balanceMonth:month})}
function prepareGeneration(){generation=generate(s,date.slice(0,7),room)}
function prepareShiftSlots(month=date.slice(0,7)){const slots=configuredSlots(s,month,room).filter(slot=>!s.slots.some(item=>item.id===slot.id));if(!slots.length){showErrorToast('作成できるシフト入力枠がありません','設定ページの授業開催リストを確認してください');return}change(next=>next.slots.push(...slots),`${month} ${room}のシフト入力枠を作成`);showSuccessToast(`${Number(month.slice(5,7))}月のシフト入力枠を作成しました`,'右上の「変更を保存」で確定します')}
function applyGeneration(){if(!generation)return;const month=date.slice(0,7);mutate(generation.state,`${month} ${room}の授業予定を作成`);showSuccessToast(`${Number(month.slice(5,7))}月の予定を作成しました`,'右上の「変更を保存」で確定します');generation=null;scheduleView='month'}
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportCSV(){const quote=(v:string)=>'"'+(/^[=+@\-]/.test(v)?"'":'')+v.replaceAll('"','""')+'"';const lines=[['日付','教室','開始','終了','生徒','内容','担当スタッフ','欠席','検定本番','メモ'],...s.lessons.filter(l=>s.slots.some(sl=>sl.id===l.slot&&sl.room===room&&sl.date.startsWith(date.slice(0,7)))).map(l=>{const sl=s.slots.find(x=>x.id===l.slot)!;return [sl.date,sl.room,sl.start,sl.end,l.name,l.course,l.teacher,l.absent?'欠席':'',l.exam?'検定本番':'',l.note]})];download(`ナレスク_${room}_${date.slice(0,7)}.csv`,'\ufeff'+lines.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
</script>
<ThemeProvider {theme}>
<Toaster/>
{#if offlineShell&&!data}
<AdminShellFrame bind:sidebarOpen pageTitle={pages[tab]?.title||'授業スケジュール'} headerClass="shell-header" contentClass="shell-content" insetClass="min-w-0">
{#snippet sidebar()}<AppSidebar offline value={tab} room="" rooms={[]} userName="" userEmail="" onLinks={()=>{}} onchange={value=>tab=value} onRoom={()=>{}} onLogout={()=>{}}/>{/snippet}
{#snippet headerActions()}<span role="status">オフライン</span>{/snippet}
<AdminPage class="dashboard-page"><AdminPanel title="インターネットに接続できません"><p>接続が戻ると、自動で読み込みます。予定の確認や変更にはインターネット接続が必要です。</p><Button variant="outline" onclick={()=>load(true)}>再試行</Button></AdminPanel></AdminPage>
</AdminShellFrame>
{:else if auth==='required'}
<main class="admin-login">
  <div class="login-layout">
    <section class="login-card" aria-labelledby="login-title">
      <div class="login-heading"><h1 id="login-title">ナレスク</h1>{#if staffState==='select'}<p>ご自身のスタッフ名を選んで申請してください。</p>{:else if staffState==='awaiting'}<p>マスターの承認後に利用できます。</p>{/if}</div>
      {#if staffState==='select'}
        <div class="login-staff-step"><Picker label="スタッフ名" bind:value={staffSelection} items={staffCandidates.map(value=>({value,label:value}))}/><Button type="button" disabled={!staffSelection} onclick={requestStaffLink}>マスターへ承認を申請</Button>{#if error}<p class="login-error" role="alert">{error}</p>{/if}</div>
      {:else if staffState==='awaiting'}
        <Button type="button" variant="outline" onclick={load}>承認状態を確認</Button>
      {:else}
        <SlackLogin onReturn={()=>{void load()}}/>
        <MasterLogin bind:password {loggingIn} {error} onLogin={login}/>
      {/if}
    </section>
  </div>
</main>
{:else if !data}<main class="loading"><GraduationCap size={42}/><h1>ナレスク</h1>{#if error}<p>{error}</p><Button onclick={load}>再読み込み</Button>{:else}<Loading variant="dots" label="授業スケジュールを読み込み中"/>{/if}</main>
{:else}
<AdminShellFrame bind:sidebarOpen pageTitle={pages[tab].title} headerClass={tab==='shifts'?'shell-header shift-shell-header':'shell-header'} contentClass="shell-content" insetClass="min-w-0">
{#snippet sidebar()}<AppSidebar userAvatarUrl={slackAvatarUrl} {roomAdmin} links={s.settings?.sidebarLinks||[]} onLinks={links=>{if(auth==='admin')change(next=>{if(next.settings)next.settings.sidebarLinks=links},'サイドバーの外部リンクを更新')}} value={tab} {room} {rooms} role={auth==='staff'?'staff':'admin'} userName={accountName} userEmail={accountEmail} onchange={selectTab} onRoom={v=>requestNavigation(()=>{room=v;if(tab==='schedule'&&scheduleView==='day')date=openingScheduleDate(s,v,todayJapan)},tab,v)} onLogout={logout}/>{/snippet}
{#snippet headerActions()}{#if hasTodayAttendance&&(tab==='schedule'||tab==='shifts')}<Button variant="outline" onclick={openTodayAttendance}><Clock3 size={16}/>今日の勤怠</Button>{/if}{#if tab!=='imports'&&tab!=='feedback'}<NextMonthAction state={s} {room} role={auth==='staff'?'staff':'admin'} {teacher} today={todayJapan} {revision} disabled={saving} onGuard={action=>{if(dirty)pendingNavigation=action;else action()}} onCreate={month=>{tab='shifts';date=month+'-01';prepareShiftSlots(month)}} onInput={month=>{tab='shifts';date=month+'-01'}}/>{/if}{#if tab!=='attendance'&&tab!=='feedback'&&(auth==='admin'||tab==='shifts')&&(tab!=='imports'||dirty)}<span class:unsaved={dirty} class="save-state"><span></span>{dirty?'未保存の変更あり':'保存済み'}</span><Button variant={dirty?'outline':'ghost'} size="icon-sm" disabled={!dirty||saving} onclick={discardChanges} aria-label="未保存の変更をすべて戻す" title="未保存の変更をすべて戻す"><RotateCcw size={16}/></Button><Button variant={dirty||saving?'default':'ghost'} disabled={!dirty||saving} loading={saving} onclick={save}>{#if !saving}<Save size={16}/>{/if}{saving?'保存中…':'変更を保存'}</Button>{/if}{/snippet}
<AdminPage class={tab==='schedule'?'dashboard-page schedule-page':'dashboard-page'}>
{#key resetVersion}<div class="dashboard-workspace" aria-busy={saving} inert={saving}>
{#if error}<div class="error" role="alert">{error}<Button variant="outline" onclick={()=>download('ナレスク_未保存バックアップ.json',JSON.stringify(s),'application/json')}>入力内容を退避</Button></div>{/if}
{#if tab==='schedule'}
<Card.Root class="planner"><Card.Content class="p-0 planner-content"><div class="planner-toolbar"><div class="planner-navigation"><div class="view-switch"><Button variant={scheduleView==='day'?'default':'ghost'} size="sm" onclick={()=>{date=dayViewDate(s,room,date,todayJapan);scheduleView='day'}}>日</Button><Button variant={scheduleView==='month'?'default':'ghost'} size="sm" onclick={()=>scheduleView='month'}>月</Button></div>{#if scheduleView==='day'}<div class="date-control"><Button variant="outline" size="icon" aria-label="前の授業日" disabled={!previousScheduleDay} onclick={()=>moveToScheduleDay('previous')}><ChevronLeft size={16}/></Button><CalendarPicker label="表示日" bind:value={date}/><Button variant="outline" size="icon" aria-label="次の授業日" disabled={!nextScheduleDay} onclick={()=>moveToScheduleDay('next')}><ChevronRight size={16}/></Button></div>{:else}<MonthNavigator value={date.slice(0,7)} onchange={value=>date=value+'-01'}/>{/if}</div>{#if auth==='admin'}<div class="schedule-admin-tools">
 <span class="schedule-tools-label">スケジュール管理</span>
 <div class="schedule-tools-buttons">
  <LineMessages state={s} {room} initialMonth={date.slice(0,7)} {dirty}/>
  <TransferCandidates bind:this={transferDialog} state={s} {room} {dirty}/>
  <Button variant="outline" disabled={!s.slots.some(slot=>slot.room===room&&slot.date.startsWith(date.slice(0,7)))} onclick={()=>workEditor.open()}>業務を追加</Button>
  <DropdownMenu.Root><DropdownMenu.Trigger>{#snippet child({props})}<Button {...props} variant="outline"><CalendarDays size={16}/>月の操作<ChevronDown size={14}/></Button>{/snippet}</DropdownMenu.Trigger>
   <DropdownMenu.Content align="end">
    <DropdownMenu.Label>{Number(date.slice(0,4))}年{Number(date.slice(5,7))}月</DropdownMenu.Label>
    <DropdownMenu.Item onclick={prepareGeneration}><CalendarDays size={16}/>月の予定を作成</DropdownMenu.Item>
    <DropdownMenu.Item onclick={()=>propose(true,'fill')}><WandSparkles size={16}/>月の未担当を埋める</DropdownMenu.Item>
    <DropdownMenu.Item onclick={()=>propose(true,'rebuild')}><WandSparkles size={16}/>月全体を組み直す</DropdownMenu.Item>
    <DropdownMenu.Separator/>
    <DropdownMenu.Item onclick={exportCSV}><Download size={16}/>月のCSVをダウンロード</DropdownMenu.Item>
   </DropdownMenu.Content>
  </DropdownMenu.Root>
  {#if scheduleView==='day'}<Button variant="outline" disabled={!daySlots.length} onclick={()=>propose(false,'fill')}><WandSparkles size={16}/>未担当を埋める</Button><DropdownMenu.Root><DropdownMenu.Trigger>{#snippet child({props})}<Button {...props} variant="outline" size="icon" disabled={!daySlots.length} aria-label="この日の割り当て操作"><ChevronDown size={14}/></Button>{/snippet}</DropdownMenu.Trigger><DropdownMenu.Content align="end"><DropdownMenu.Item onclick={()=>propose(false,'rebuild')}>この日全体を組み直す</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Root>{/if}
 </div>
</div>{/if}</div>
{#if scheduleView==='day'}
<div class="week-strip" use:horizontalDateScroll={date}>{#each upcomingDays as d}<button data-date={d} class:selected={d===date} class:today={d===todayJapan} aria-current={d===todayJapan?'date':undefined} aria-pressed={d===date} onclick={()=>date=d}><DateText value={d} selected={d===date}/></button>{/each}<span class="date-strip-tail" aria-hidden="true"></span></div>
<div class="mobile-day-board">
{#each daySlots as sl,slotIndex (sl.id)}
  {@const lessons=lessonsAt(sl.id)}
  <section class="mobile-period" aria-label={`${slotIndex+1}コマ ${sl.start}から${sl.end}`}>
    <header><strong>{slotIndex+1}コマ</strong><span>{sl.start}–{sl.end}</span><span>{lessons.filter(l=>!l.absent).length}人</span></header>
    {#if attendanceOnly(sl.id).length}<p class="attendance-only">出勤のみ：{attendanceOnly(sl.id).join('、')}</p>{/if}
    {#each [...new Set([...lessons.filter(l=>!l.absent).map(l=>l.teacher),...s.teachers.filter(t=>hasAssignment(t.name,sl.id)).map(t=>t.name)])] as name}
      <section class="mobile-teacher" style={name?teacherStyle(name):''} aria-label={name||'担当未定'}>
        <h3>{name||'担当未定'}{#if auth==='admin'&&hasDayLessons(name)}<TeacherUnassignPopover {name} options={teacherUnassignOptions(name)} onApply={slots=>clearTeacherDay(name,slots)}/>{/if}</h3>
        {#each workAt(s,name,sl.id) as work (work.id)}<button class="fixed-work" disabled={auth!=='admin'} onclick={()=>workEditor.open(sl.id,work)}><strong>{work.title}</strong><small>固定業務</small></button>{/each}
        {#each lessons.filter(l=>l.teacher===name&&!l.absent) as l (l.id)}
          <button class="mobile-lesson" onclick={()=>viewLesson(l)}><span class="mobile-lesson-name">{l.name}{#if l.note}<LessonNote note={l.note}/>{/if}{#if ownsComputer(l)}<Laptop size={14} aria-label="PC所持"/>{/if}</span><span class="mobile-lesson-course"><CourseLabel value={l.exam?'検定本番':l.course} abbreviation={l.exam?'':s.settings?.curriculumAbbreviations?.[l.course]}/></span>{#if l.request}<span class="mobile-lesson-request">変更希望あり</span>{/if}</button>
        {/each}
      </section>
    {/each}
    {#if lessons.some(l=>l.absent)}<section class="mobile-teacher mobile-absent"><h3>欠席</h3>{#each lessons.filter(l=>l.absent) as l (l.id)}<button class="mobile-lesson" onclick={()=>viewLesson(l)}><span class="mobile-lesson-name">{l.name}{#if l.note}<LessonNote note={l.note}/>{/if}</span><span class="mobile-lesson-course"><CourseLabel value={l.course} abbreviation={s.settings?.curriculumAbbreviations?.[l.course]}/></span></button>{/each}</section>{/if}
    {#if !lessons.length}<p class="mobile-period-empty">授業の登録はありません</p>{/if}
    {#if auth==='admin'}<Button variant="ghost" class="mobile-add" onclick={()=>newLesson(sl.id)}><Plus size={16}/>生徒を追加</Button>{/if}
  </section>
{:else}<div class="empty"><CalendarDays size={28}/><h3>この日の授業枠はありません</h3></div>{/each}
</div>
<div class="board-wrap desktop-day-board"><div class="lesson-board" class:drag-active={!!draggingLesson} style:grid-template-columns={`repeat(${Math.max(daySlots.length,1)},minmax(0,1fr))`}>
{#if daySlots.length}
{#each daySlots as sl,slotIndex (sl.id)}<div class="slot-title" class:last-slot={slotIndex===daySlots.length-1} style={`grid-column:${slotIndex+1};grid-row:1`}><strong>{slotIndex+1}コマ</strong><span>{sl.start}–{sl.end}</span><small>{lessonsAt(sl.id).filter(l=>!l.absent).length}人</small>{#if attendanceOnly(sl.id).length}<span class="attendance-only">出勤のみ：{attendanceOnly(sl.id).join('、')}</span>{/if}</div>{/each}
{#each teacherLayout.items as segment}<section class="teacher-segment" class:current-staff={auth==='staff'&&segment.name===teacher} style={`${teacherStyle(segment.name)};grid-column:${segment.start+1}/span ${segment.end-segment.start+1};grid-row:${segment.lane+2}`} aria-label={segment.name} ondragover={event=>{if(canDropLesson(daySlots[segment.start].id)){event.preventDefault();event.stopPropagation()}}} ondrop={event=>{const source=draggedLesson?.slot;const slot=daySlots.slice(segment.start,segment.end+1).find(slot=>slot.id===source)||daySlots[segment.start];dropLesson(event,slot.id,segment.name)}}><header><strong>{segment.name}</strong>{#if auth==='admin'&&hasDayLessons(segment.name)}<TeacherUnassignPopover name={segment.name} options={teacherUnassignOptions(segment.name)} onApply={slots=>clearTeacherDay(segment.name,slots)}/>{/if}</header><div class="teacher-segment-periods" style={`grid-template-columns:repeat(${segment.end-segment.start+1},minmax(0,1fr))`}>{#each daySlots.slice(segment.start,segment.end+1) as sl}<div class="teacher-period" role="group" aria-label={`${sl.start}から${sl.end}`} ondragover={event=>{if(canDropLesson(sl.id)){event.preventDefault();event.stopPropagation()}}} ondrop={event=>dropLesson(event,sl.id,segment.name)}>{#each workAt(s,segment.name,sl.id) as work (work.id)}<button class="fixed-work" disabled={auth!=='admin'} onclick={()=>workEditor.open(sl.id,work)}><strong>{work.title}</strong><small>固定業務</small></button>{/each}{#each lessonsAt(sl.id).filter(l=>l.teacher===segment.name&&!l.absent) as l (l.id)}{@const progressUrl=progressLinkForLesson(l)}<div class="student-card-shell" class:dragging={draggingLesson===l.id} draggable={auth==='admin'} role="group" aria-label={`${l.name}さんの授業`} onmouseenter={event=>showProgressHover(event,l,progressUrl)} onmouseleave={scheduleProgressHide} ondragstart={event=>startLessonDrag(event,l.id)} ondragend={endLessonDrag}><button class="student-card" onclick={()=>viewLesson(l)}><div><strong>{l.name}</strong>{#if l.note}<LessonNote note={l.note}/>{/if}<span class="student-marks">{#if ownsComputer(l)}<span class="pc-owned-mark" title="PC所持" aria-label="PC所持"><Laptop size={12}/></span>{/if}</span></div><span class="course" class:purple={/Unity|JavaScript|Swift/i.test(l.course)}><CourseLabel value={l.exam?'検定本番':l.course} abbreviation={l.exam?'':s.settings?.curriculumAbbreviations?.[l.course]}/></span>{#if l.request}<span class="request-tag">変更希望あり</span>{/if}</button></div>{/each}</div>{/each}</div></section>{/each}
{#each daySlots as sl,slotIndex (sl.id)}{@const ls=lessonsAt(sl.id)}<div class="slot-footer" role="group" aria-label={`${sl.start}のコマへ担当未定で移動`} ondragover={event=>{if(canDropLesson(sl.id)){event.preventDefault();event.stopPropagation()}}} ondrop={event=>dropLesson(event,sl.id,'')} class:last-slot={slotIndex===daySlots.length-1} style={`grid-column:${slotIndex+1};grid-row:${teacherLayout.count+2}`}><div class="slot-drop-hint" class:active={!!draggingLesson} aria-hidden={!draggingLesson}>ここへ移動・担当未定</div>{#if ls.some(l=>!l.teacher&&!l.absent)}<section class="teacher-group unassigned" role="group" aria-label="担当未定"><div class="teacher-heading"><strong>担当未定</strong></div>{#each ls.filter(l=>!l.teacher&&!l.absent) as l (l.id)}{@const progressUrl=progressLinkForLesson(l)}<div class="student-card-shell" class:dragging={draggingLesson===l.id} draggable={auth==='admin'} role="group" aria-label={`${l.name}さんの授業`} onmouseenter={event=>showProgressHover(event,l,progressUrl)} onmouseleave={scheduleProgressHide} ondragstart={event=>startLessonDrag(event,l.id)} ondragend={endLessonDrag}><button class="student-card" onclick={()=>viewLesson(l)}><div><strong>{l.name}</strong>{#if l.note}<LessonNote note={l.note}/>{/if}{#if ownsComputer(l)}<span class="pc-owned-mark" title="PC所持" aria-label="PC所持"><Laptop size={12}/></span>{/if}</div><span class="course"><CourseLabel value={l.course} abbreviation={s.settings?.curriculumAbbreviations?.[l.course]}/></span></button></div>{/each}</section>{/if}{#if ls.some(l=>l.absent)}<section class="teacher-group absent" role="group" aria-label="欠席"><div class="teacher-heading"><strong>欠席</strong></div>{#each ls.filter(l=>l.absent) as l (l.id)}<div class="student-card-shell"><button class="student-card" onclick={()=>viewLesson(l)}><div><strong>{l.name}</strong>{#if l.note}<LessonNote note={l.note}/>{/if}{#if ownsComputer(l)}<span class="pc-owned-mark" title="PC所持" aria-label="PC所持"><Laptop size={12}/></span>{/if}</div><span>欠席</span></button></div>{/each}</section>{/if}{#if auth==='admin'}<Button variant="ghost" class="add-student" onclick={()=>newLesson(sl.id)}><Plus size={15}/>生徒を追加</Button>{/if}</div>{/each}
{:else}<div class="empty"><CalendarDays size={28}/><h3>この日の授業枠はありません</h3></div>{/if}
</div></div>
{#if progressHover&&!draggingLesson}<a class="student-progress-card" href={progressHover.url} target="_blank" rel="noopener noreferrer" style={`left:${progressHover.left}px;top:${progressHover.top}px`} onmouseenter={cancelProgressHide} onmouseleave={scheduleProgressHide} aria-label={`${progressHover.name}さんの進捗シートを開く`}><div><strong>{progressHover.name}</strong><span>{progressHover.title||'進捗シート'}</span><small>Google スプレッドシート</small></div><ExternalLink size={17}/></a>{/if}

{:else}
<MonthCalendar {canOpenShift} openShift={openTeacherShift} state={s} {room} month={date.slice(0,7)} admin={auth==='admin'} currentTeacher={auth==='staff'?teacher:''} {draggingLesson} {teacherStyle} {viewLesson} {newLesson} openDay={d=>{date=d;scheduleView='day'}} openWork={(slot,work)=>workEditor.open(slot,work)} startDrag={startLessonDrag} endDrag={endLessonDrag} canDrop={canDropLesson} drop={dropLesson}/>
{/if}
{#if draggedLesson}<div class="assignment-tray" role="group" aria-label={`${draggedLesson.name}の担当変更`}><div class="assignment-tray-label"><strong>{draggedLesson.name}</strong><span>移動先へドロップ</span></div><div class="assignment-targets">{#each dragTeachers as target (target.name)}<button style={teacherStyle(target.name)} ondragover={event=>event.preventDefault()} ondrop={event=>dropLesson(event,draggedLesson.slot,target.name)}><span></span>{target.name}</button>{/each}<button class="remove-assignment" ondragover={event=>event.preventDefault()} ondrop={event=>dropLesson(event,draggedLesson.slot,'')}>担当を外す</button></div></div>{/if}
</Card.Content></Card.Root>
{#if auth==='admin'}<div class="issues-panel"><AdminPanel title={'確認が必要な項目 · '+relevant.length+'件'}>{#if relevant.length}<div class="issues">{#each relevant as i}<div><span>{#if scheduleView==='month'}{s.slots.find(sl=>sl.id===i.slot)?.date}{' '}{/if}{s.slots.find(sl=>sl.id===i.slot)?.start}</span><p>{i.text}</p></div>{/each}</div>{:else}<p class="good"><Check size={17}/>この{scheduleView==='month'?'月':'日'}の担当・時間のチェックで問題は見つかりませんでした。</p>{/if}</AdminPanel></div>{/if}
{/if}
{#if tab==='shifts'}{#await loadShifts()}<p role="status">画面を読み込んでいます…</p>{:then {default:Shifts}}<Shifts state={s} {room} month={date.slice(0,7)} bind:teacher fixedTeacher={auth==='staff'?teacher:''} canPrepare={auth==='admin'} canSendSlack={auth==='admin'} onMonth={v=>date=v+'-01'} onChange={mutate} onPrepare={()=>prepareShiftSlots()}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='placement'}{#await loadPlacementStatus()}<p role="status">画面を読み込んでいます…</p>{:then {default:PlacementStatus}}<PlacementStatus state={s} {room} month={date.slice(0,7)} onMonth={v=>date=v+'-01'} onStudent={openStudent} onSchedule={()=>requestNavigation(()=>{scheduleView='month';tab='schedule'},'schedule')} onAdopt={adoptParentRequest} onReject={rejectParentRequest}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='messages'}{#await loadMessages()}<p role="status">画面を読み込んでいます…</p>{:then {default:Messages}}<Messages {room} studentId={messageStudentId} onClearStudent={()=>messageStudentId=''} onApplied={async()=>{const previousRoom=room;await load(true);if(rooms.includes(previousRoom))room=previousRoom}}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='imports'&&auth==='admin'&&!roomAdmin}{#await loadStudentImports()}<p role="status">画面を読み込んでいます…</p>{:then {default:StudentImports}}<StudentImports state={s} {revision} blocked={dirty||saving} onApplied={()=>load(true)}/>{:catch}<p role="alert">画面を読み込めませんでした。</p>{/await}{/if}
{#if tab==='students'}{#await loadStudents()}<p role="status">画面を読み込んでいます…</p>{:then {default:Students}}<Students state={s} {room} onChange={mutate} initialName={studentToEdit} onOpened={()=>studentToEdit=''} onMessages={openMessages}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='teachers'}{#await loadTeachers()}<p role="status">画面を読み込んでいます…</p>{:then {default:Teachers}}<Teachers {roomAdmin} state={s} {room} onChange={mutate}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='settings'}{#await loadSettings()}<p role="status">画面を読み込んでいます…</p>{:then {default:Settings}}<Settings {roomAdmin} state={s} {room} onChange={mutate}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='history'}<AdminPanel title="変更履歴">{#each s.history as h}<div class="history-row"><time>{new Date(h.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</time><span>{h.text}</span></div>{:else}<p class="footnote">アプリ内の変更がここに記録されます。</p>{/each}</AdminPanel>{/if}
{#if tab==='attendance'&&(auth==='staff'||roomAdmin)}{#await loadAttendance()}<p role="status">画面を読み込んでいます…</p>{:then {default:Attendance}}<Attendance bind:this={attendanceEditor} {room} name={auth==='staff'?teacher:accountName} state={s} startToday={attendanceStartToday}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='attendance'&&auth==='admin'&&!roomAdmin}{#await loadMasterAttendance()}<p role="status">画面を読み込んでいます…</p>{:then {default:MasterAttendance}}<MasterAttendance bind:this={attendanceEditor} {room} state={s} {dirty}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='account'&&auth==='staff'}{#await loadAccount()}<p role="status">画面を読み込んでいます…</p>{:then {default:Account}}<Account name={accountName} email={accountEmail} {slackName} {slackEmail} curricula={s.teachers.find(item=>item.name===teacher)?.curricula||[]} options={s.settings?.curricula||[]} onSave={saveAccount} onSync={syncAccount} onUnlink={unlinkSlack}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
{#if tab==='feedback'}{#await loadFeedback()}<p role="status">画面を読み込んでいます…</p>{:then {default:Feedback}}<Feedback master={auth==='admin'&&!roomAdmin} {room}/>{:catch}<p role="alert">画面を読み込めませんでした。再読み込みしてください。</p>{/await}{/if}
</div>{/key}</AdminPage></AdminShellFrame>
{/if}
<Dialog.Root bind:open={()=>!!saveConflict,(open:boolean)=>{if(!open&&!saving)saveConflict=null}}>
 <Dialog.Content class="sm:max-w-3xl">
  <Dialog.Header><Dialog.Title>変更が重なった箇所を確認</Dialog.Title><Dialog.Description>変更された部分だけを表示しています。使う内容を項目ごとに選んでください。競合していない変更は自動で統合します。</Dialog.Description></Dialog.Header>
  <Dialog.Body>
   {#if saveConflict}
    <p class="mb-2 text-sm text-muted-foreground">閉じても選択を保持します。内容が変わった項目だけ、もう一度確認します。</p>
    <p class="mb-4 text-sm" role="status">{saveConflict.conflicts.filter(item=>!!conflictChoices[item.id]).length} / {saveConflict.conflicts.length}件 選択済み</p>
    {#each saveConflict.conflicts as item (item.id)}<ConflictComparison conflict={item} comparison={saveConflict} choice={conflictChoices[item.id]} disabled={saving} onChoose={side=>conflictChoices[item.id]=side}/>{/each}
   {/if}
  </Dialog.Body>
  <Dialog.Footer><Button variant="outline" disabled={saving} onclick={()=>saveConflict=null}>保存せず編集に戻る</Button><Button loading={saving} disabled={!saveConflict||saveConflict.conflicts.some(item=>!conflictChoices[item.id])} onclick={resolveSaveConflict}>選んだ内容で保存</Button></Dialog.Footer>
 </Dialog.Content>
</Dialog.Root>
<Dialog.Root bind:open={()=>!!pendingNavigation&&!saveConflict,(open:boolean)=>{if(!open&&!saving)pendingNavigation=null}}><Dialog.Content><Dialog.Header><Dialog.Title>未保存の変更があります</Dialog.Title><Dialog.Description>この画面の変更を保存してから移動しますか？破棄すると、最後に保存した状態に戻ります。</Dialog.Description></Dialog.Header><Dialog.Footer><Button variant="outline" disabled={saving} onclick={()=>pendingNavigation=null}>編集を続ける</Button><Button variant="destructive" disabled={saving} onclick={()=>resolveNavigation('discard')}>変更を破棄して移動</Button><Button loading={saving} onclick={()=>resolveNavigation('save')}>保存して移動</Button></Dialog.Footer></Dialog.Content></Dialog.Root>
<Dialog.Root bind:open={()=>!!viewing,(open:boolean)=>{if(!open&&!changingAbsence)void closeLessonDetails()}}>
 <Dialog.Content class="lesson-detail-dialog">
  <Dialog.Header><Dialog.Title>{viewing?.name}</Dialog.Title><Dialog.Description class="sr-only">授業の詳細</Dialog.Description></Dialog.Header>
  {#if viewing}
   {@const lessonSlot=s.slots.find(slot=>slot.id===viewing!.slot)}
   {@const progressUrl=progressLinkForLesson(viewing)}
   <Dialog.Body>
    <div class="lesson-detail-summary">
     <div class="lesson-detail-date"><CalendarDays size={20}/><div><div class="lesson-detail-when"><strong>{lessonSlot?dateLabel(lessonSlot.date):'日時未設定'}</strong>{#if lessonSlot}<span>{lessonSlot.start}–{lessonSlot.end}</span>{/if}</div><span class="lesson-detail-meta"><span aria-label="担当スタッフ">{viewing.teacher||'担当未定'}</span><span aria-label="カリキュラム">{viewing.course||'カリキュラム未設定'}</span></span></div></div>
     {#if viewing.absent||viewing.exam}<div class="lesson-detail-badges">{#if viewing.absent}<span class="absent">欠席</span>{/if}{#if viewing.exam}<span>検定本番</span>{/if}</div>{/if}
    </div>
    {#if viewing.request}<section class="lesson-detail-note"><h3>保護者からの変更希望</h3><p>{viewing.request}</p></section>{/if}
    {#key viewing.id}<InlineLessonNote bind:this={noteEditor} note={viewing.note||''} bind:blocked={noteBlocked} onSave={(note,previous)=>saveInlineNote(viewing!.id,note,previous)}/>{/key}
    <StudentMonthLessons state={s} lesson={viewing}/>
   </Dialog.Body>
   <Dialog.Footer class="lesson-detail-footer">
    <div>
     {#if progressUrl}<Button variant="outline" href={progressUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>進捗シート</Button>{/if}
     {#if auth==='admin'}<Button variant="outline" onclick={editLessonDetails}>編集</Button><Button variant="outline" onclick={openLessonTransfer}>振替候補</Button>{/if}
     <Button variant={viewing.absent?'default':'outline'} loading={changingAbsence} onclick={setLessonAbsence}>{viewing.absent?'出席に戻す':'欠席に変更'}</Button></div>
   </Dialog.Footer>
  {/if}
 </Dialog.Content>
</Dialog.Root>
<Dialog.Root bind:open={()=>!!edit, (v:boolean)=>{if(!v)edit=null}}><Dialog.Content><Dialog.Header><Dialog.Title>{edit&&s.lessons.some(l=>l.id===edit!.id)?'授業を編集':'生徒の授業を追加'}</Dialog.Title><Dialog.Description>担当の変更、振替、欠席を登録できます。</Dialog.Description></Dialog.Header>{#if edit}{@const selectedSlot=s.slots.find(slot=>slot.id===edit!.slot)}{@const selectedDate=selectedSlot?.date||''}{@const transferDates=[...new Set(s.slots.filter(slot=>slot.room===room).map(slot=>slot.date))].sort()}{@const transferSlots=s.slots.filter(slot=>slot.room===room&&slot.date===selectedDate).sort((a,b)=>a.start.localeCompare(b.start))}<Dialog.Body><div class="form-grid">{#if s.lessons.some(l=>l.id===edit!.id)}<div class="field lesson-student">生徒<strong>{edit.name}</strong></div>{:else}<div class="field">生徒<Picker searchable label="生徒を選択" value={edit.studentId||''} onchange={selectStudent} items={(s.students||[]).filter(student=>student.room===room).sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(student=>({value:student.id,label:student.name+' · '+student.course}))}/></div>{/if}<div class="field">授業内容<Picker label="カリキュラム" bind:value={edit.course} items={(s.settings?.curricula||[]).map(value=>({value,label:value}))}/></div><div class="field">授業日<Picker label="日付" value={selectedDate} onchange={transferDate} items={transferDates.map(value=>({value,label:dateLabel(value)}))}/></div><div class="field">授業コマ<Picker label="コマ" value={edit.slot} onchange={transfer} items={transferSlots.map((slot,index)=>({value:slot.id,label:`${index+1}コマ · ${slot.start}–${slot.end}`}))}/></div><div class="field wide">担当スタッフ<Picker label="担当スタッフ" bind:value={edit.teacher} items={[{value:'',label:'担当未定'},...s.teachers.filter(t=>t.name===edit!.teacher||(t.rooms?.includes(room)&&t.curricula?.includes(edit!.course))).map(t=>({value:t.name,label:t.name+(s.availability[key(t.name,edit!.slot)]==='no'?' · 出勤不可':s.availability[key(t.name,edit!.slot)]?' · 出勤希望あり':' · 希望未入力')}))]}/></div><label class="wide" for="lesson-request">保護者からの変更希望<Input id="lesson-request" value={edit.request||''} oninput={e=>{if(edit)edit.request=e.currentTarget.value}} placeholder="例：9/12は欠席、9/13の午前に振替希望"/></label><label class="wide" for="lesson-note">メモ<Input id="lesson-note" bind:value={edit.note}/></label></div><div class="checks"><label for="exam"><Checkbox id="exam" bind:checked={edit.exam}/>検定本番（検定対応可のスタッフが担当）</label></div></Dialog.Body><Dialog.Footer>{#if auth==='admin'&&s.lessons.some(lesson=>lesson.id===edit!.id)}<Button variant="outline" onclick={()=>removeLesson(edit!)}>この授業から外す</Button>{/if}<Button onclick={updateLesson}>変更を反映</Button></Dialog.Footer>{/if}</Dialog.Content></Dialog.Root>
<WorkAssignmentEditor bind:this={workEditor} state={s} {room} {date} onChange={mutate}/>
<Dialog.Root bind:open={()=>!!proposal, (v:boolean)=>{if(!v)proposal=null}}><Dialog.Content class="sm:max-w-3xl"><Dialog.Header><Dialog.Title>割り当て案を確認</Dialog.Title><Dialog.Description>{proposalLabel} · {room}／固定業務は変更しません。</Dialog.Description></Dialog.Header>{#if proposal}<Dialog.Body><p class="mb-3 text-sm text-muted-foreground">{proposal.workload?'対象範囲の担当を白紙に戻し、自動割り当て対象の先生で組み立てます。担当科目と出勤希望の組合せを比較し、月内の勤務の偏りも調整します。連続勤務・担当条件を守り、固定業務は動かしません。':'自動割り当て対象外の先生には新たに授業を割り当てません。「全体を組み直す」では対象外の先生の既存担当も外して再計算します。'}案を適用するまで保存されません。</p><AssignmentPreview current={s} proposed={proposal.state} scope={proposalScope} reasons={proposal.reasons} workload={proposal.workload}/></Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>proposal=null}>キャンセル</Button><Button disabled={!proposalScope.length} onclick={()=>{if(proposal)mutate(proposal.state,proposalLabel+' '+room+'の割り当て案を適用');proposal=null;showSuccessToast('割り当て案を反映しました')}}>この案を適用</Button></Dialog.Footer>{/if}</Dialog.Content></Dialog.Root>
<Dialog.Root bind:open={()=>!!generation,(value:boolean)=>{if(!value)generation=null}}><Dialog.Content><Dialog.Header><Dialog.Title>{Number(date.slice(5,7))}月の予定を作成</Dialog.Title></Dialog.Header>{#if generation}<Dialog.Body><p>{generation.count}件の授業を追加</p>{#if generation.shortages.length}<p>担当不足の見込み</p>{#each generation.shortages as item}<p>{dateLabel(item.slot.date)} {item.slot.start}：{item.count}人分</p>{/each}{:else}<p>担当不足の見込みなし</p>{/if}</Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>generation=null}>キャンセル</Button><Button disabled={!generation.createdSlots&&!generation.count} onclick={applyGeneration}>予定を作成</Button></Dialog.Footer>{/if}</Dialog.Content></Dialog.Root>
</ThemeProvider>

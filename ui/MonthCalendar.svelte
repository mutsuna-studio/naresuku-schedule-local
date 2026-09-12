<script lang="ts">
import {Search,X,Plus,ArrowLeft,ArrowRight,StickyNote} from '@lucide/svelte';
import type {State,Lesson} from '../lib/scheduler';
import {scheduledForWork,workAt,type WorkAssignment} from '../lib/work-assignments';
import {calendarWeeks,weekdayOf,studentKey,placeLessons,type PlacedLesson} from './month-calendar';
import DateText from './DateText.svelte';
import StudentAttendance from './StudentAttendance.svelte';
let {canOpenShift,openShift,state:s,room,month,admin,currentTeacher='',draggingLesson,teacherStyle,viewLesson,newLesson,openDay,openWork,startDrag,endDrag,canDrop,drop}:{
 canOpenShift:(name:string)=>boolean;openShift:(name:string)=>void;
 state:State;room:string;month:string;admin:boolean;currentTeacher?:string;draggingLesson:string;
 teacherStyle:(name:string)=>string;viewLesson:(lesson:Lesson)=>void;
 newLesson:(slot:string)=>void;openDay:(date:string)=>void;openWork:(slot:string,work:WorkAssignment)=>void;
 startDrag:(event:DragEvent,id:string)=>void;endDrag:()=>void;canDrop:(slot:string)=>boolean;
 drop:(event:DragEvent,slot:string,teacher:string)=>void;
}=$props();
type CalendarDay={slots:State['slots'];lessons:Lesson[];rows:{id:string;name:string;teacher:string;absent:boolean;cells:PlacedLesson[][];lanes:number;laneHeight:number;compact?:boolean}[]};
let mode=$state<'teacher'|'student'>('teacher'),query=$state(''),highlight=$state('');
let showIdle=$state(false);
let chosenDays=$state<number[]|null>(null);
const labels=['日','月','火','水','木','金','土'],weekdayOrder=[1,2,3,4,5,6,0];
const slots=$derived(s.slots.filter(slot=>slot.room===room&&slot.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)));
const slotIds=$derived(new Set(slots.map(slot=>slot.id)));
const monthLessons=$derived(s.lessons.filter(lesson=>slotIds.has(lesson.slot)));
const availableDays=$derived([...new Set(slots.map(slot=>weekdayOf(slot.date)))]);
const selectableDays=$derived(weekdayOrder.filter(day=>availableDays.includes(day)));
const defaultDays=$derived(selectableDays.some(day=>day===6||day===0)?selectableDays.filter(day=>day===6||day===0):selectableDays);
const weekdays=$derived.by(()=>{const selected=selectableDays.filter(day=>(chosenDays||defaultDays).includes(day));return selected.length?selected:defaultDays});
const weeks=$derived(calendarWeeks(month,weekdays));
const columnWidths=$derived(weekdays.map(weekday=>{
 const dates=[...new Set(slots.filter(slot=>weekdayOf(slot.date)===weekday).map(slot=>slot.date))];
 const periods=Math.max(0,...dates.map(date=>slots.filter(slot=>slot.date===date).length));
 return periods?(mode==='student'?58:0)+periods*62:88;
}));
const columns=$derived((mode==='teacher'?'72px ':'')+columnWidths.map(width=>`minmax(${width}px,${width}fr)`).join(' '));
const minimumWidth=$derived(columnWidths.reduce((sum,width)=>sum+width,0)+(mode==='teacher'?72:Math.max(0,weekdays.length-1)*6));
const search=$derived(query.normalize('NFKC').trim().toLocaleLowerCase());
const matches=(lesson:Lesson)=>lesson.name.normalize('NFKC').toLocaleLowerCase().includes(search);
const matched=$derived(monthLessons.filter(matches));
const visibleMatched=$derived(matched.filter(lesson=>slots.some(slot=>slot.id===lesson.slot&&weekdays.includes(weekdayOf(slot.date)))));
const teacherNames=$derived([...new Set([...monthLessons.filter(l=>!l.absent).map(l=>l.teacher).filter(Boolean),...s.teachers.filter(t=>slots.some(slot=>scheduledForWork(s,t.name,slot.id))).map(t=>t.name)])].sort((a,b)=>a.localeCompare(b,'ja')));
const idleTeachers=$derived(s.teachers.filter(t=>t.rooms?.includes(room)&&!teacherNames.includes(t.name)).map(t=>t.name).sort((a,b)=>a.localeCompare(b,'ja')));
const displayedTeachers=$derived([...teacherNames,...(showIdle?idleTeachers:[])]);
const days=$derived.by(()=>{
 const result=new Map<string,CalendarDay>();
 for(const date of [...new Set(slots.map(slot=>slot.date))]){
  const daySlots=slots.filter(slot=>slot.date===date),ids=new Set(daySlots.map(slot=>slot.id));
  const lessons=monthLessons.filter(lesson=>ids.has(lesson.slot));
  const studentRows=[...new Map(lessons.map(lesson=>[studentKey(lesson),lesson.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ja'));
  const rows=mode==='teacher'?[...displayedTeachers.map(name=>({id:`teacher:${name}`,name,teacher:name,absent:false,lessons:lessons.filter(l=>!l.absent&&l.teacher===name)})),{id:'unassigned',name:'担当未定',teacher:'',absent:false,lessons:lessons.filter(l=>!l.absent&&!l.teacher)},...(monthLessons.some(l=>l.absent)?[{id:'absent',name:'欠席',teacher:'',absent:true,lessons:lessons.filter(l=>l.absent)}]:[])]:studentRows.map(([id,name])=>({id,name,teacher:'',absent:false,lessons:lessons.filter(l=>studentKey(l)===id)}));
  result.set(date,{slots:daySlots,lessons,rows:rows.map(row=>{const placed=placeLessons(daySlots,row.lessons,lessons);return {...row,...placed,laneHeight:mode==='student'||placed.cells.flat().some(p=>p.lesson.request||p.previous&&!p.connectedBefore||p.next&&!p.connectedAfter)?46:row.teacher&&daySlots.some(slot=>workAt(s,row.teacher,slot.id).length)?44:32}})});
 }
 // Share row sizes only across the visible dates of each week.
 if(mode==='teacher')for(const week of weeks){
  const visible=week.flatMap(date=>date&&result.has(date)?[result.get(date)!]:[]);
  for(const name of displayedTeachers){
   const id=`teacher:${name}`;
   const rows=visible.map(day=>day.rows.find(row=>row.id===id)!);
   const active=visible.some(day=>day.lessons.some(l=>!l.absent&&l.teacher===name)||day.slots.some(slot=>scheduledForWork(s,name,slot.id)||workAt(s,name,slot.id).length));
   const lanes=active?Math.max(1,...rows.map(row=>row.lanes)):1;
   const laneHeight=active?Math.max(32,...rows.map(row=>row.laneHeight)):20;
   for(const row of rows)Object.assign(row,{lanes,laneHeight,compact:!active});
  }
 }
 return result;
});
function clearHighlight(event:MouseEvent){if(event.target instanceof Element&&!event.target.closest('.lesson-entry')&&!event.target.closest('[role=dialog],[role=alertdialog]'))highlight=''}
function toggleDay(day:number){const next=weekdays.includes(day)?weekdays.filter(item=>item!==day):[...weekdays,day];if(next.length)chosenDays=next}
function dragOver(event:DragEvent,slot:string){if(canDrop(slot)){event.preventDefault();event.stopPropagation()}}
function compactTeacher(name:string){return name.replace(/[ \u3000]/g,'')}
function neighborLabel(lesson:Lesson|undefined){return lesson?compactTeacher(lesson.teacher)||'担当未定':''}
</script>

<svelte:window onclick={clearHighlight}/>

<div class="calendar-controls">
 <div class="weekdays" role="group" aria-label="表示する曜日">
  {#each selectableDays as day}<button class:chosen={weekdays.includes(day)} aria-pressed={weekdays.includes(day)} disabled={weekdays.length===1&&weekdays.includes(day)} onclick={()=>toggleDay(day)}>{labels[day]}</button>{/each}
  <button class="all-days" onclick={()=>chosenDays=[...selectableDays]} aria-label="開催曜日をすべて表示">開催日すべて</button>
 </div>
 <div class="view-mode" role="group" aria-label="時間割の表示方法"><button class:chosen={mode==='teacher'} aria-pressed={mode==='teacher'} onclick={()=>mode='teacher'}>先生別</button><button class:chosen={mode==='student'} aria-pressed={mode==='student'} onclick={()=>mode='student'}>生徒別</button></div>
 <label class="student-search"><Search size={16}/><input aria-label="生徒名で探す" placeholder="生徒名で探す" bind:value={query} oninput={()=>highlight=''}/>{#if query}<button aria-label="検索をクリア" onclick={()=>query=''}><X size={15}/></button>{/if}</label>
</div>
<div class="calendar-guide"><span>{#if mode==='student'}生徒ごとに授業のある日付・時間を並べています。授業を押すと詳細を確認できます。{:else}同じ曜日は縦に、コマは横に並びます。空きコマの希望：○ 出勤可　△ 不足時のみ　× 不可（未入力は空欄）。{#if admin}クリックで生徒を強調、詳細ボタンで内容を確認できます。ドラッグで移動できます。{/if}{/if}</span>{#if search}<strong role="status">表示中 {visibleMatched.length}件 / 月全体 {matched.length}件</strong>{:else if highlight}<button onclick={()=>highlight=''}>生徒の強調を解除 <X size={12}/></button>{/if}</div>
{#if mode==='student'}
<StudentAttendance {month} lessons={monthLessons} {slots} {weekdays} {search} {viewLesson} {teacherStyle}/>
{:else if slots.length}
<!-- Keyboard focus lets users scroll the wide timetable without a mouse. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="calendar-scroll" class:drag-active={!!draggingLesson} tabindex="0" role="region" aria-label="月間時間割・横スクロールできます">
 <div class="calendar-weeks" style={`--columns:${columns};--minimum-width:${minimumWidth}px`}>
 {#each weeks as week,index}
  {@const sharedRows=week.flatMap(date=>date&&days.has(date)?[days.get(date)!]:[])[0]?.rows||[]}
  <div class="calendar-week" class:shared-teachers={mode==='teacher'} style={`--week-rows:${sharedRows.length+2}`}>
  {#if mode==='teacher'}<div class="teacher-rail"><div></div><div class="row-name">先生</div>{#each sharedRows as row}<div class="row-name" class:compact-row={row.compact} title={row.teacher&&s.teachers.find(t=>t.name===row.teacher)?.autoAssignLessons===false?'自動割当の対象外':undefined} style={row.teacher?teacherStyle(row.teacher):''}>{#if row.teacher&&canOpenShift(row.teacher)}<button class="teacher-shift-link" onclick={()=>openShift(row.teacher)} aria-label={`${row.name}のシフト希望を開く`}>{compactTeacher(row.name)}</button>{:else}{compactTeacher(row.name)}{/if}</div>{/each}</div>{/if}
  {#each week as date,dayIndex}
   {@const day=date?days.get(date):undefined}
   <section class="calendar-day" class:outside={!date} aria-label={date||'月外'}>
   {#if date}
    <header class:saturday={weekdays[dayIndex]===6} class:sunday={weekdays[dayIndex]===0}>
     <button onclick={()=>openDay(date)}><strong><DateText value={date}/></strong><span>{day?new Set(day.lessons.filter(l=>!l.absent).map(studentKey)).size:0}人</span></button>
    </header>
    {#if day}
    <div class="timetable" style={`--periods:${day.slots.length}`}>
     <div class="period-heading">{#each day.slots as slot,i}<div class="period-label"><strong>{i+1}コマ</strong><span class="period-time" title={`${slot.start}–${slot.end}`}><span>{slot.start}</span><span>–{slot.end}</span></span>{#if admin}<button aria-label={`${date} ${i+1}コマに生徒を追加`} onclick={()=>newLesson(slot.id)}><Plus size={12}/></button>{/if}</div>{/each}</div>
     {#each day.rows as row (row.id)}
      <div class="timetable-row" class:compact-row={row.compact} class:unassigned={row.id==='unassigned'} class:calendar-absence-row={row.absent} class:current-staff={!!currentTeacher&&row.teacher===currentTeacher} style={`${row.teacher?teacherStyle(row.teacher):''};--lane-height:${row.laneHeight}px`}>
       {#each day.slots as slot,i (slot.id)}
        {@const works=mode==='teacher'&&!row.absent?workAt(s,row.teacher,slot.id):[]}
        {@const present=mode==='teacher'&&row.teacher&&scheduledForWork(s,row.teacher,slot.id)}
        {@const availability=row.teacher?s.availability[row.teacher+'|'+slot.id]:undefined}
        {@const availabilityLabel=availability==='yes'?'出勤可':availability==='reserve'?'不足時のみ':availability==='no'?'不可':'未入力'}
        <div class="period-cell" title={row.teacher?`希望：${availabilityLabel} / ${present?'出勤予定あり':'出勤予定なし'}${!row.cells[i].length&&!works.length?' / 授業・固定業務の割当なし':''}`:undefined} class:off-duty={!!row.teacher&&!present&&!row.cells[i].length&&!works.length} class:available-duty={!!present&&!row.cells[i].length&&!works.length} class:drop-target={!row.absent&&mode==='teacher'} role="group" aria-label={`${date} ${i+1}コマ ${row.name}`} ondragover={event=>{if(!row.absent&&mode==='teacher')dragOver(event,slot.id)}} ondrop={event=>{if(!row.absent&&mode==='teacher')drop(event,slot.id,row.teacher)}}>
         <div class="pupil-lanes" style={`--lanes:${row.lanes}`}>
         {#each row.cells[i] as placed (placed.lesson.id)}
          {@const lesson=placed.lesson}
          {@const selected=search?matches(lesson):highlight===studentKey(lesson)}
          <div class="lesson-entry" style={`grid-row:${placed.lane+1}`}>
          <button class="pupil" class:absent={lesson.absent} class:highlighted={selected} class:dimmed={(!!search||!!highlight)&&!selected} class:dragging={draggingLesson===lesson.id} class:connected-before={placed.connectedBefore} class:connected-after={placed.connectedAfter} style={teacherStyle(lesson.teacher)} draggable={admin&&!lesson.absent} ondragstart={event=>{highlight=studentKey(lesson);startDrag(event,lesson.id)}} ondragend={endDrag} onclick={()=>highlight=studentKey(lesson)} aria-label={`${lesson.name} ${lesson.course} ${lesson.absent?'欠席':lesson.teacher||'担当未定'} ${date} ${i+1}コマ`} title={`${lesson.name} / ${lesson.course} / ${lesson.teacher||'担当未定'}`}>
           <span class="pupil-name"><strong>{lesson.name}</strong>{#if lesson.note}<span class="pupil-note" title={lesson.note} aria-label={`メモ：${lesson.note}`}><StickyNote size={10}/></span>{/if}</span>
           {#if lesson.absent&&mode==='teacher'}<small>欠席</small>{/if}
           {#if placed.previous&&!placed.connectedBefore}<small class="continuation"><ArrowLeft size={10}/>{neighborLabel(placed.previous)}</small>{/if}
           {#if placed.next&&!placed.connectedAfter}<small class="continuation"><ArrowRight size={10}/>{neighborLabel(placed.next)}</small>{/if}
           {#if lesson.request}<small class="request">変更希望</small>{/if}
          </button>
          <button class="lesson-details" aria-label={`${lesson.name} ${date} ${i+1}コマの詳細`} onclick={()=>{highlight=studentKey(lesson);viewLesson(lesson)}}>詳細</button>
          </div>
         {/each}
         {#if !row.cells[i].length&&!works.length}<span class="cell-status" class:availability-yes={availability==='yes'} class:availability-reserve={availability==='reserve'} aria-label={row.teacher&&availability?`希望：${availabilityLabel}`:undefined}>{row.id==='unassigned'&&draggingLesson?'ここへ移動':availability==='yes'?'○':availability==='reserve'?'△':availability==='no'?'×':''}</span>{/if}
         </div>
         {#each works as work}<button class="calendar-work" disabled={!admin} onclick={()=>openWork(slot.id,work)}>{work.title}<small>固定業務</small></button>{/each}
        </div>
       {/each}
      </div>
     {/each}
    </div>
    {:else}<p class="closed-day">授業コマなし</p>{/if}
   {:else}<span class="month-outside">{index===0?'前月':'翌月'}</span>{/if}
   </section>
  {/each}
  </div>
 {/each}
 </div>
</div>
{:else}<div class="calendar-empty">この月に授業コマはありません</div>{/if}

{#if mode==='teacher'&&idleTeachers.length}<div class="idle-teachers"><button aria-expanded={showIdle} onclick={()=>showIdle=!showIdle}>月の予定なし · {idleTeachers.length}人 {showIdle?'を閉じる':'を表示'}</button></div>{/if}

<style>
.calendar-controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:4px 10px 0}.weekdays,.view-mode{display:flex;gap:3px}.calendar-controls button{min-height:34px;border:1px solid var(--line);border-radius:6px;background:var(--surface-raised);color:var(--ink);padding:5px 11px;font-size:12px;cursor:pointer}.calendar-controls button.chosen{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}.calendar-controls button:disabled{cursor:default;opacity:1}.weekdays .all-days{color:var(--ink-muted);background:transparent;border-color:transparent}.view-mode{margin-left:auto}.student-search{display:flex;align-items:center;gap:7px;border:1px solid var(--control-border,var(--line));border-radius:6px;padding:0 9px;min-height:34px;width:210px;color:var(--ink-muted)}.student-search input{width:100%;min-width:0;outline:none;background:transparent;color:var(--ink);border:0;font-size:12px}.student-search button{border:0;padding:0;min-height:24px;display:flex;background:transparent}.calendar-guide{padding:6px 10px 8px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;color:var(--ink-muted);font-size:11px}.calendar-guide strong{color:var(--primary)}.calendar-guide button{display:flex;gap:4px;align-items:center;color:var(--primary);border:0;background:none;cursor:pointer}.calendar-scroll{overflow:auto;margin:0 10px 12px;max-width:100%;border-radius:8px}.calendar-weeks{min-width:var(--minimum-width)}.calendar-week{display:grid;grid-template-columns:var(--columns);gap:6px;margin-bottom:8px;align-items:start}.calendar-day{border:1px solid var(--line);border-radius:8px;overflow:clip;background:var(--surface-raised)}.calendar-day.outside{border-style:dashed;min-height:96px;background:transparent}.calendar-day header{padding:6px 8px;background:var(--surface-sunken);border-bottom:1px solid var(--line)}.calendar-day header button{display:flex;align-items:center;gap:10px;background:none;border:0;cursor:pointer;color:var(--ink);text-align:left;width:100%}.calendar-day header strong{font-size:15px}.calendar-day header span{font-size:11px;color:var(--ink-muted)}.calendar-day header.saturday strong{color:#1764c0}.calendar-day header.sunday strong{color:var(--danger,#bd252c)}.period-heading,.timetable-row{display:grid;grid-template-columns:58px repeat(var(--periods),minmax(0,1fr))}.period-heading{background:var(--surface-sunken)}.period-label{position:relative;text-align:center;padding:5px 1px;border-left:1px solid var(--line);display:flex;flex-direction:column;gap:3px}.period-label strong{font-size:11px}.period-label>span{font-size:9px;color:var(--ink-muted)}.period-time{display:flex;justify-content:center;flex-wrap:wrap;column-gap:1px}.period-time>span{white-space:nowrap}.period-label>button{position:absolute;top:2px;right:0;background:none;border:0;color:var(--ink-muted);padding:0;cursor:pointer}.row-name{padding:6px 4px;display:flex;align-items:center;font-size:12px;font-weight:600;overflow-wrap:anywhere;min-width:0}.timetable-row{border-top:1px solid var(--line);--teacher-bg:var(--surface-sunken)}.period-cell{padding:2px 1px;border-left:1px solid var(--line);min-width:0;position:relative}.pupil-lanes{display:grid;grid-template-rows:repeat(var(--lanes),var(--lane-height,32px));gap:2px;align-content:start}.pupil{position:relative;display:flex;flex-direction:column;justify-content:center;gap:2px;text-align:left;min-width:0;min-height:28px;width:100%;border:1px solid transparent;border-radius:4px;background:var(--teacher-bg,var(--surface-sunken));color:var(--ink);padding:3px 2px;font-size:11px;line-height:1.35;cursor:pointer;overflow:visible}.pupil-name{display:flex;align-items:center;gap:3px;min-width:0}.pupil-name strong{overflow-wrap:anywhere;min-width:0;font-weight:600}.pupil-name :global(svg){flex-shrink:0}.pupil-note{position:absolute;right:3px;top:3px;line-height:1}.pupil small{font-size:9px;color:var(--ink-muted)}.pupil.connected-after:after{content:'';position:absolute;right:-4px;top:50%;width:5px;height:2px;background:var(--teacher-color,var(--primary));z-index:1;pointer-events:none}.pupil.connected-before{border-top-left-radius:0;border-bottom-left-radius:0}.pupil.connected-after{border-top-right-radius:0;border-bottom-right-radius:0}.pupil.highlighted{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}.pupil.dimmed{opacity:.42}.pupil.dragging{opacity:.35}.pupil.absent{background:var(--surface-sunken);color:var(--ink-muted)}.continuation{display:flex;gap:2px;align-items:center}.pupil .request{color:var(--warning,#995c00)}.unassigned{background:color-mix(in srgb,var(--warning-soft,#fff4db) 35%,var(--surface-raised))}.unassigned .pupil{background:var(--warning-soft,#fff4db)}.calendar-absence-row{color:var(--ink-muted)}.cell-status{display:flex;align-items:center;justify-content:center;color:var(--ink-muted);font-size:10px;min-height:34px}.calendar-work{display:block;width:100%;text-align:left;background:var(--surface-sunken);border:1px solid var(--line);border-radius:4px;padding:6px;font-size:11px;cursor:pointer}.calendar-work small{display:block;color:var(--ink-muted);font-size:9px}.period-cell:has(.calendar-work) .pupil-lanes:not(:has(.pupil)){display:none}.drag-active .drop-target{outline:1px dashed var(--control-border);outline-offset:-3px}.drag-active .drop-target:hover{background:var(--primary-soft)}.closed-day,.month-outside{display:block;padding:24px;text-align:center;font-size:12px;color:var(--ink-muted)}.calendar-empty{padding:50px;text-align:center;color:var(--ink-muted)}button:focus-visible,input:focus-visible,.calendar-scroll:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media(max-width:767px){.calendar-controls{padding:4px 12px;gap:8px}.weekdays{width:100%}.calendar-controls button{min-height:36px;padding:6px 10px}.view-mode{margin-left:0}.student-search{flex:1;min-width:130px}.calendar-guide{padding:7px 12px;font-size:10px}.calendar-scroll{margin:0 12px 12px}.calendar-weeks{min-width:var(--minimum-width)}}
.shared-teachers{grid-template-rows:34px 52px;gap:0;align-items:stretch;border-block:1px solid var(--line)}.shared-teachers .calendar-day{border:0;border-radius:0}.shared-teachers .calendar-day header{border-left:1px solid var(--line)}.shared-teachers .calendar-day,.teacher-rail{display:grid;grid-template-rows:subgrid;grid-row:span var(--week-rows)}.shared-teachers .timetable{display:contents}.shared-teachers .period-heading,.shared-teachers .timetable-row{grid-template-columns:repeat(var(--periods),minmax(0,1fr))}.shared-teachers .calendar-day header{padding:4px 8px}.teacher-rail{position:sticky;left:0;z-index:3;background:var(--surface-raised)}.teacher-rail>.row-name{border-top:1px solid var(--line);box-shadow:inset 3px 0 var(--teacher-color,transparent)}.shared-teachers .closed-day{grid-row:2 / span calc(var(--week-rows) - 1)}.calendar-scroll{margin-inline:0;border-radius:0}.calendar-controls,.calendar-guide{padding-inline:4px}
.compact-row>.period-cell{padding-block:1px}.compact-row .cell-status{min-height:20px}.teacher-rail>.compact-row{padding-block:1px;font-size:11px}.idle-teachers{padding:8px 4px}.idle-teachers button{background:none;border:1px solid var(--line);border-radius:4px;color:var(--ink-muted);padding:4px 8px;font-size:12px;cursor:pointer}
.period-cell.off-duty{background:repeating-linear-gradient(135deg,transparent,transparent 5px,color-mix(in srgb,var(--ink-muted) 7%,transparent) 5px,color-mix(in srgb,var(--ink-muted) 7%,transparent) 6px)}.period-cell.available-duty{background:var(--primary-soft)}

/* Keep the continuous table, with quieter grid lines and focused lesson accents. */
.calendar-scroll{--grid-line:color-mix(in srgb,var(--line) 55%,transparent)}
.shared-teachers{margin-bottom:14px;border-color:var(--line);grid-template-rows:40px 48px}
.shared-teachers .calendar-day header{display:flex;align-items:center;background:var(--surface-raised);border-bottom:1px solid var(--line);border-left-color:var(--grid-line);padding:5px 10px}
.calendar-day header strong{font-size:16px;font-weight:750;letter-spacing:-.02em}
.calendar-day header span{margin-left:auto;background:var(--surface-sunken);border-radius:12px;padding:1px 7px;font-size:10px}
.period-heading{background:color-mix(in srgb,var(--surface-sunken) 55%,var(--surface-raised))}
.period-label{border-left-color:var(--grid-line);gap:2px;justify-content:center}
.period-label strong{font-size:10px;font-weight:500;color:var(--ink-muted)}
.period-label>span{font-size:10px;font-weight:600;color:var(--ink)}
.period-label>button{opacity:.55;transition:opacity .15s}.period-label:hover>button,.period-label>button:focus-visible{opacity:1}
.timetable-row,.period-cell{border-color:var(--grid-line)}
.teacher-rail>.row-name{border-color:var(--grid-line);box-shadow:inset 2px 0 var(--teacher-color,transparent);font-weight:650}
.teacher-rail>.compact-row{font-weight:500;color:var(--ink-muted)}
.period-cell{padding:3px 2px}
.pupil{border:1px solid color-mix(in srgb,var(--teacher-color,var(--line)) 20%,transparent);border-left:2px solid var(--teacher-color,var(--line));border-radius:5px;background:color-mix(in srgb,var(--teacher-bg,var(--surface-sunken)) 55%,var(--surface-raised));padding-inline:4px;transition:background .15s,box-shadow .15s}
.pupil:hover{background:var(--teacher-bg,var(--surface-sunken));box-shadow:0 1px 5px color-mix(in srgb,var(--ink) 12%,transparent)}
.pupil.connected-before{border-left-width:1px;border-top-left-radius:0;border-bottom-left-radius:0}.pupil.connected-after{border-top-right-radius:0;border-bottom-right-radius:0}.pupil.connected-after:after{right:-6px;width:7px}
.pupil.highlighted{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}
.period-cell.off-duty{background:color-mix(in srgb,var(--surface-sunken) 80%,var(--surface-raised))}
.period-cell.available-duty{background:color-mix(in srgb,var(--primary-soft) 45%,var(--surface-raised))}
.calendar-work{border-style:dashed;background:var(--surface-raised);font-size:10px;box-shadow:none}
.cell-status{font-size:11px;color:var(--ink-muted)}
.cell-status.availability-yes{color:color-mix(in srgb,var(--primary) 65%,var(--ink-muted))}.cell-status.availability-reserve{color:color-mix(in srgb,var(--warning,#995c00) 65%,var(--ink-muted))}

/* Names are the content; color and outlines are reserved for the row key and interaction. */
.calendar-scroll .pupil{background:transparent;border:0;border-radius:0;box-shadow:none;padding:3px 4px;font-size:12px}
.calendar-scroll .pupil-name strong{font-weight:500}
.calendar-scroll .pupil:hover{background:var(--surface-sunken);box-shadow:none}
.calendar-scroll .pupil.highlighted{background:var(--primary-soft);box-shadow:inset 2px 0 var(--primary)}
.calendar-scroll .pupil.absent{color:var(--ink-muted);text-decoration:line-through}
.calendar-scroll .period-cell{border-left-color:transparent}
.calendar-scroll .period-cell.off-duty{background:color-mix(in srgb,var(--surface-sunken) 35%,var(--surface-raised))}
.calendar-scroll .period-cell.available-duty{background:var(--surface-raised)}
.calendar-scroll .unassigned{background:transparent}
.calendar-scroll .unassigned .pupil{background:var(--warning-soft,#fff4db)}
.calendar-scroll .teacher-rail>.row-name{font-size:12px;padding-inline:5px;font-weight:650}
.calendar-scroll .teacher-rail>.compact-row{font-size:11px;font-weight:400}
.calendar-scroll .calendar-day+.calendar-day{border-left:1px solid var(--line)}
.calendar-scroll .pupil.connected-after:after{right:-5px;width:6px;opacity:.7}

.lesson-entry{position:relative;min-width:0;min-height:0}.lesson-entry>.pupil{height:100%}.lesson-details{position:absolute;right:2px;top:2px;z-index:2;padding:2px 5px;border:1px solid var(--line);border-radius:4px;background:var(--surface-raised);color:var(--ink);font-size:10px;line-height:1.5;cursor:pointer;opacity:0;pointer-events:none}.lesson-entry:hover>.lesson-details,.lesson-entry:focus-within>.lesson-details{opacity:1;pointer-events:auto}.lesson-details:focus-visible{outline:2px solid var(--primary)}@media(hover:none){.lesson-details{opacity:1;pointer-events:auto}.lesson-entry>.pupil{padding-right:34px}}
.teacher-shift-link{display:flex;align-items:center;align-self:stretch;width:100%;text-align:left;font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}.teacher-shift-link:hover{color:var(--primary);text-decoration:underline;text-underline-offset:3px}
</style>

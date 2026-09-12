<script lang="ts">
import type {Lesson,State} from '../lib/scheduler';
import {studentKey,weekdayOf,calendarWeeks} from './month-calendar';
import DateText from './DateText.svelte';
let {lessons,slots,weekdays,search,viewLesson,teacherStyle,month}:{month:string;lessons:Lesson[];slots:State['slots'];weekdays:number[];search:string;viewLesson:(lesson:Lesson)=>void;teacherStyle:(name:string)=>string}=$props();
const weeks=$derived(calendarWeeks(month,[1,2,3,4,5,6,0]));
const weekdayLabels=['日','月','火','水','木','金','土'];
function pattern(dates:{date:string;items:{lesson:Lesson;slot:State['slots'][number];period:number}[]}[]){
 const signature=(day:typeof dates[number])=>weekdayOf(day.date)+':'+day.items.filter(item=>!item.lesson.absent).map(item=>item.slot.start+'–'+item.slot.end).join(',');
 const active=dates.filter(day=>day.items.some(item=>!item.lesson.absent)),counts=new Map<string,number>();
 for(const day of active){const key=signature(day);counts.set(key,(counts.get(key)||0)+1)}
 const top=Math.max(0,...counts.values());
 const typical=new Set([...counts].filter(([,count])=>count>=2&&count>=top*.6).map(([key])=>key));
 const samples=[...typical].map(key=>active.find(day=>signature(day)===key)!);
 const descriptions=samples.map(day=>weekdayLabels[weekdayOf(day.date)]+'曜 '+day.items.filter(item=>!item.lesson.absent).map(item=>item.period).join('・')+'コマ');
 return {label:descriptions.length?'今月の傾向：'+descriptions.join(' / '):'',different:(day:typeof dates[number])=>typical.size>0&&day.items.some(item=>!item.lesson.absent)&&!typical.has(signature(day))};
}
const pupils=$derived.by(()=>{
 const bySlot=new Map(slots.map(slot=>[slot.id,slot]));
 const groups=new Map<string,{name:string;dates:Map<string,Lesson[]>}>();
 for(const lesson of lessons){
  const slot=bySlot.get(lesson.slot);
  if(!slot||!lesson.name.normalize('NFKC').toLocaleLowerCase().includes(search))continue;
  const key=studentKey(lesson),pupil=groups.get(key)||{name:lesson.name,dates:new Map<string,Lesson[]>()};
  const date=pupil.dates.get(slot.date)||[];date.push(lesson);pupil.dates.set(slot.date,date);groups.set(key,pupil);
 }
 return [...groups].sort((a,b)=>a[1].name.localeCompare(b[1].name,'ja')).map(([id,pupil])=>({id,name:pupil.name,dates:[...pupil.dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>({date,items:items.sort((a,b)=>bySlot.get(a.slot)!.start.localeCompare(bySlot.get(b.slot)!.start)).map(lesson=>({lesson,slot:bySlot.get(lesson.slot)!,period:slots.filter(slot=>slot.date===date).findIndex(slot=>slot.id===lesson.slot)+1}))}))}));
});
</script>
<div class="attendance-list" aria-label="生徒別の授業日一覧" style={`--weeks:${weeks.length}`}><div class="attendance-week-head"><strong>生徒</strong>{#each weeks as week,i}<span>第{i+1}週<small>{week.find(Boolean)?.slice(5).replace('-','/')}–{week.filter(Boolean).at(-1)?.slice(5).replace('-','/')}</small></span>{/each}</div>
{#each pupils.filter(pupil=>pupil.dates.some(day=>weekdays.includes(weekdayOf(day.date)))) as pupil (pupil.id)}
 {@const tendency=pattern(pupil.dates)}
 <section class="attendance-pupil" aria-label={pupil.name}>
  <header><strong>{pupil.name}</strong>{#if tendency.label}<small>{tendency.label}</small>{/if}<small>{pupil.dates.filter(day=>day.items.some(item=>!item.lesson.absent)).length}日出席予定</small></header>
  <div class="attendance-dates">
  {#each weeks as week,i}
  {@const weekDates=pupil.dates.filter(day=>week.includes(day.date)&&weekdays.includes(weekdayOf(day.date)))}
  <div class="attendance-week"><span class="mobile-week">第{i+1}週</span>
  {#each weekDates as day (day.date)}
   <div class="attendance-date"><strong class:saturday={weekdayOf(day.date)===6} class:sunday={weekdayOf(day.date)===0}><DateText value={day.date}/></strong>{#if day.items.some(item=>item.lesson.originalDate&&item.lesson.originalDate!==day.date)}<span class="exception">振替</span>{:else if tendency.different(day)}<span class="exception">今月の傾向と異なる日</span>{/if}
   {#each day.items as {lesson,slot,period} (lesson.id)}
    <button class:absent={lesson.absent} class:attention={!lesson.absent&&(!lesson.teacher||!!lesson.request)} style={teacherStyle(lesson.teacher)} onclick={()=>viewLesson(lesson)} aria-label={`${pupil.name} ${day.date} ${period}コマ ${slot.start}から${slot.end} ${lesson.absent?'欠席':lesson.teacher||'担当未定'}`}>
     <span><time>{slot.start}–{slot.end}</time></span><small>{period}コマ</small>
     <small>{lesson.absent?'欠席':lesson.teacher.replace(/[ \u3000]/g,'')||'担当未定'}{lesson.request?' · 変更希望':''}</small>
    </button>
   {/each}</div>
  {:else}<span class="no-lessons">—</span>{/each}
  </div>{/each}
  </div>
 </section>
{:else}<p>表示条件に合う授業はありません。</p>{/each}
</div>
<style>
.attendance-list{border-top:1px solid var(--line)}.attendance-pupil{display:grid;grid-template-columns:110px minmax(0,1fr);border-bottom:1px solid var(--line)}.attendance-pupil>header{padding:10px 6px;background:var(--surface-sunken);border-right:1px solid var(--line);display:flex;flex-direction:column;gap:4px;font-size:13px;overflow-wrap:anywhere}.attendance-pupil>header small{font-size:10px;color:var(--ink-muted)}.attendance-dates{display:flex;flex-wrap:wrap;gap:6px;padding:8px;align-items:flex-start}.attendance-date{width:144px;border:1px solid var(--line);border-radius:4px;overflow:hidden;display:grid;gap:1px;background:var(--line)}.attendance-date>strong{background:var(--surface-sunken);font-size:12px;padding:3px 5px}.saturday{color:#1764c0}.sunday{color:var(--danger,#bd252c)}.attendance-date button{border:0;border-left:3px solid var(--teacher-color,transparent);background:var(--teacher-bg,var(--surface-raised));color:var(--ink);padding:4px;text-align:left;cursor:pointer;font-size:11px}.attendance-date button>span{display:flex;gap:5px;align-items:center}.attendance-date time{font-variant-numeric:tabular-nums;font-weight:600}.attendance-date small{display:block;color:var(--ink-muted);font-size:10px}.attendance-date .absent{opacity:.65;background:var(--surface-sunken)}.attendance-date .absent time{text-decoration:line-through}.attendance-list>p{padding:24px;color:var(--ink-muted)}button:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}@media(max-width:600px){.attendance-pupil{grid-template-columns:80px minmax(0,1fr)}.attendance-pupil>header{font-size:12px}.attendance-dates{padding:5px;gap:5px}.attendance-date{width:min(144px,100%)}}

.attendance-list{container-type:inline-size}.attendance-week-head,.attendance-pupil{display:grid;grid-template-columns:110px repeat(var(--weeks),minmax(0,1fr))}.attendance-week-head{background:var(--surface-sunken);border-bottom:1px solid var(--line);font-size:12px}.attendance-week-head>strong,.attendance-week-head>span{padding:6px;border-right:1px solid var(--line)}.attendance-week-head small{display:block;color:var(--ink-muted);font-size:10px}.attendance-dates{grid-column:2/-1;display:grid;grid-template-columns:repeat(var(--weeks),minmax(0,1fr));padding:0;gap:0;align-items:stretch}.attendance-week{min-width:0;border-right:1px solid var(--line);padding:5px;display:flex;flex-direction:column;gap:5px}.attendance-date{width:100%;min-width:0}.attendance-date>strong{font-size:14px}.attendance-date time{font-size:13px;white-space:normal;overflow-wrap:anywhere}.attendance-date button{background:var(--surface-raised);padding:5px}.attendance-date button.attention{background:var(--warning-soft,#fff4db)}.exception{font-size:10px;padding:2px 4px;color:var(--warning,#995c00);background:var(--warning-soft,#fff4db)}.no-lessons{color:var(--ink-muted);text-align:center;font-size:12px}.mobile-week{display:none}@container(max-width:760px){.attendance-week-head{display:none}.attendance-pupil{grid-template-columns:90px minmax(0,1fr)}.attendance-dates{display:flex;flex-direction:column}.attendance-week{flex-direction:row;flex-wrap:wrap;border-bottom:1px solid var(--line);border-right:0}.attendance-date{width:calc(50% - 3px);min-width:120px;flex:1}.mobile-week{display:block;width:100%;font-size:11px;color:var(--ink-muted)}}
</style>

<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {lessonStatus,lessonStatusLabels} from '../lib/lesson-state';
import type {State,Lesson} from '../lib/scheduler';
import {studentForLesson} from '../lib/students';
import DateText from './DateText.svelte';
let {state,lesson,onSelect,disabled=false}:{state:State;lesson:Lesson;onSelect:(lesson:Lesson)=>void;disabled?:boolean}=$props();
const selectedSlot=$derived(state.slots.find(slot=>slot.id===lesson.slot));
const studentId=$derived(lesson.studentId||studentForLesson(state,lesson)?.id);
const month=$derived(selectedSlot?.date.slice(0,7));
const entries=$derived.by(()=>{
 if(!month)return [];
 return state.lessons.flatMap(item=>{
  const sameStudent=studentId?(item.studentId||studentForLesson(state,item)?.id)===studentId:item.id===lesson.id;
  const slot=state.slots.find(slot=>slot.id===item.slot);
  if(!sameStudent||!slot||slot.date.slice(0,7)!==month)return [];
  const periods=state.slots.filter(other=>other.room===slot.room&&other.date===slot.date).sort((a,b)=>a.start.localeCompare(b.start));
  return [{lesson:item,slot,period:periods.findIndex(other=>other.id===slot.id)+1}];
 }).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.start.localeCompare(b.slot.start)||a.slot.room.localeCompare(b.slot.room));
});
</script>

{#if month}
<section class="student-month-lessons" aria-label="この生徒の月内の授業予定">
 <h3>{Number(month.slice(5,7))}月の授業予定</h3>
 <ul aria-label={`${month}の授業予定`}>
  {#each entries as entry (entry.lesson.id)}
   <li>
    <Button variant="ghost" class="h-auto whitespace-normal" type="button" aria-current={entry.lesson.id===lesson.id?'true':undefined} {disabled} onclick={()=>onSelect(entry.lesson)}><strong><DateText value={entry.slot.date}/> · {entry.period}コマ目</strong>{#if entry.lesson.originalDate&&entry.lesson.originalDate!==entry.slot.date}<span class="label">振替済み（元：<DateText value={entry.lesson.originalDate}/>）</span>{/if}{#if entry.lesson.absent}<span class="label">{lessonStatusLabels[lessonStatus(entry.lesson)]}</span>{/if}</Button>
   </li>
  {/each}
 </ul>
</section>
{/if}

<style>
.student-month-lessons{font-size:13px}
h3{margin:0;color:var(--muted-foreground);font-size:12px;font-weight:500}
ul{display:flex;flex-direction:column;gap:6px;list-style:none;margin:8px 0 0;padding:0;max-height:360px;overflow-y:auto}
.student-month-lessons :global(button){display:flex;width:100%;align-items:flex-start;gap:3px;flex-direction:column;padding:7px 10px;min-height:42px;border:1px solid var(--border);border-radius:5px;background:transparent;color:inherit;text-align:left;cursor:pointer}
.student-month-lessons :global(button:hover:not(:disabled)){background:var(--muted);border-color:var(--primary)}
.student-month-lessons :global(button:focus-visible){outline:2px solid var(--primary);outline-offset:2px}
.student-month-lessons :global(button:disabled){cursor:wait;opacity:.6}
.student-month-lessons :global(button[aria-current="true"]){border-color:var(--primary);background:var(--muted);box-shadow:inset 3px 0 var(--primary)}
.student-month-lessons :global(button[aria-current="true"] strong){font-weight:600}
strong{font-size:12px;font-weight:400}
.label{font-size:11px;color:var(--muted-foreground)}
@media(max-width:700px){.student-month-lessons{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}ul{max-height:160px}}
</style>

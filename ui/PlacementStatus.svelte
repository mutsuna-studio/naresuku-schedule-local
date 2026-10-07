<script lang="ts">
import SearchField from './SearchField.svelte';
import {lessonStatus} from '../lib/lesson-status';
import {AdminPanel} from '@mutsuna/ui/admin-layout';
import {Button} from '@mutsuna/ui/button';
import * as Select from '@mutsuna/ui/select';
import * as Table from '@mutsuna/ui/table';
import {SlidersHorizontal} from '@lucide/svelte';
import MonthNavigator from './MonthNavigator.svelte';
import DateText from './DateText.svelte';
import Picker from './Picker.svelte';
import type {State,Student,Lesson} from '../lib/scheduler';
import {statusAt} from '../lib/students';
import './schedule-status.css';
import {studentScheduleStatus,scheduleStatusLabels,type ScheduleStage} from '../lib/student-schedule-status';

let {state:s,room,month,onMonth,onStudent,onLesson,onSchedule,onStatus}:{state:State;room:string;month:string;onMonth:(v:string)=>void;onStudent:(name:string)=>void;onLesson:(lesson:Lesson)=>void;onSchedule:()=>void;onStatus:(studentId:string,month:string,status:ScheduleStage)=>void}=$props();
let search=$state(''),filter=$state('all'),statusFilter=$state('all');
const slotFor=(lesson:Lesson)=>s.slots.find(slot=>slot.id===lesson.slot);
const belongsToStudent=(lesson:Lesson,student:Student)=>lesson.studentId===student.id||(!lesson.studentId&&lesson.name===student.name);
const allocationDate=(lesson:Lesson)=>lesson.originalDate||slotFor(lesson)?.date||'';
function lessonsFor(student:Student){return s.lessons.filter(lesson=>belongsToStudent(lesson,student)&&slotFor(lesson)?.room===room&&allocationDate(lesson).startsWith(month))}
function scheduledLessonsFor(student:Student){
 return s.lessons.flatMap(lesson=>{
  const slot=slotFor(lesson);
  if(!belongsToStudent(lesson,student)||!slot||slot.room!==room||!slot.date.startsWith(month))return [];
  const periods=s.slots.filter(item=>item.room===room&&item.date===slot.date).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  return [{lesson,slot,period:periods.findIndex(item=>item.id===slot.id)+1}];
 }).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.start.localeCompare(b.slot.start));
}
function transferInfo(student:Student){return s.lessons.filter(lesson=>belongsToStudent(lesson,student)&&slotFor(lesson)?.room===room).flatMap(lesson=>{const actual=slotFor(lesson)?.date||'',original=lesson.originalDate||actual;if(!actual||!original||actual.slice(0,7)===original.slice(0,7)||!actual.startsWith(month)&&!original.startsWith(month))return[];return[{lesson,actual,original,direction:original.startsWith(month)?'outgoing':'incoming'}]})}
const shortDate=(value:string)=>`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`;
const allRows=$derived((s.students||[]).filter(student=>student.room===room&&statusAt(student,month)==='active').map(student=>{const lessons=lessonsFor(student),placed=lessons.length,absent=lessons.filter(lesson=>lessonStatus(lesson)==='absent').length,target=student.monthlyLessons||4,transfers=transferInfo(student);return {student,placed,absent,target,transfers,entries:scheduledLessonsFor(student),schedule:studentScheduleStatus(s,student,month),difference:placed-target}}).sort((a,b)=>a.difference-b.difference||a.student.name.localeCompare(b.student.name,'ja')));
const rows=$derived(allRows.filter(row=>row.student.name.includes(search)&&(statusFilter==='all'||row.schedule.status===statusFilter)&&(filter==='all'||filter==='complete'&&row.difference===0||filter==='incomplete'&&row.difference!==0)));
const complete=$derived(allRows.filter(row=>row.difference===0).length),shortage=$derived(allRows.filter(row=>row.difference<0).length),excess=$derived(allRows.filter(row=>row.difference>0).length);
</script>
<section class="placement-overview" aria-label="配置状況の概要">
 <div class="placement-overview-heading">
  <div class="field">対象月<MonthNavigator label="配置を確認する月" value={month} onchange={onMonth}/></div>
  <Button variant="outline" onclick={onSchedule}>月間予定を開く</Button>
 </div>
 <div class="placement-summary">
  <div><span>対象生徒</span><strong>{allRows.length}<small>人</small></strong></div>
  <div class="complete"><span>配置完了</span><strong>{complete}<small>人</small></strong></div>
  <div class:attention={shortage>0}><span>不足</span><strong>{shortage}<small>人</small></strong></div>
  <div class:attention={excess>0}><span>超過</span><strong>{excess}<small>人</small></strong></div>
 </div>
</section>
<div class="placement-filters">
 <span class="placement-filters-label"><SlidersHorizontal size={15}/>絞り込み</span>
 <div class="app-inline"><SearchField label="生徒名で検索" placeholder="生徒名で検索" bind:value={search}/></div>
 <Picker inlineLabel="配置" label="配置状況で絞り込み" bind:value={filter} items={[{value:'incomplete',label:'不足・超過のみ'},{value:'complete',label:'配置完了のみ'},{value:'all',label:'すべて'}]}/>
 <Picker inlineLabel="ステータス" label="スケジュールステータスで絞り込み" bind:value={statusFilter} items={[{value:'all',label:'全ステータス'},...Object.entries(scheduleStatusLabels).filter(([value])=>value!=='outside').map(([value,label])=>({value,label}))]}/>
</div>
<AdminPanel title={`${Number(month.slice(5))}月の配置状況`} description="振替後も元の契約月に含めて、欠席を含む授業予定を契約回数と照合します。">
<div class="placement-table"><Table.Root><Table.Header><Table.Row><Table.Head>生徒</Table.Head><Table.Head>スケジュール</Table.Head><Table.Head>配置／契約</Table.Head><Table.Head>授業予定</Table.Head><Table.Head>月跨ぎ振替</Table.Head><Table.Head>操作</Table.Head></Table.Row></Table.Header><Table.Body>{#each rows as row (row.student.id)}<Table.Row><Table.Cell><strong>{row.student.name}</strong></Table.Cell><Table.Cell><div class="schedule-status-cell"><Select.Root type="single" value={row.schedule.status} onValueChange={value=>{if(value&&value!==row.schedule.status&&value!=='uncreated')onStatus(row.student.id,month,value as ScheduleStage)}}><Select.Trigger data-schedule-status={row.schedule.status} style="background:var(--schedule-status-bg)" class="w-full" aria-label={`${row.student.name}さんのスケジュールステータス`}>{scheduleStatusLabels[row.schedule.status]}</Select.Trigger><Select.Content>{#if row.schedule.status==='uncreated'}<Select.Item value="uncreated" disabled>未作成</Select.Item>{/if}<Select.Item value="adjusting">調整中</Select.Item><Select.Item value="waiting" disabled={!row.schedule.canAdvance}>確認待ち</Select.Item><Select.Item value="confirmed" disabled={!row.schedule.canAdvance}>確定</Select.Item></Select.Content></Select.Root>{#if row.schedule.pending}<small>変更依頼 {row.schedule.pending}件</small>{:else if !row.schedule.canAdvance}<small>契約回数分の配置が必要</small>{/if}</div></Table.Cell><Table.Cell><div class:shortage={row.difference<0} class:excess={row.difference>0} class="placement-count"><strong class="placement-fraction" aria-label={`契約${row.target}回のうち${row.placed}回配置済み`}>{row.placed} / {row.target}回</strong>{#if row.difference<0}<small>あと{Math.abs(row.difference)}回不足</small>{:else if row.difference>0}<small>{row.difference}回超過</small>{/if}{#if row.absent}<small class="student-period">うち欠席 {row.absent}回</small>{/if}</div></Table.Cell><Table.Cell><ul class="placement-lessons" aria-label={`${row.student.name}さんの${Number(month.slice(5))}月の授業予定`}>{#each row.entries as entry (entry.lesson.id)}<li><button type="button" onclick={()=>onLesson(entry.lesson)}><strong><DateText value={entry.slot.date}/> · {entry.period}コマ目</strong></button></li>{:else}<li class="muted">この月の授業はありません</li>{/each}</ul></Table.Cell><Table.Cell>{#each row.transfers as transfer (transfer.lesson.id)}<span class:incoming={transfer.direction==='incoming'} class="placement-transfer"><strong>{shortDate(transfer.original)} → {shortDate(transfer.actual)}</strong><small>{transfer.direction==='outgoing'?`${Number(transfer.actual.slice(5,7))}月へ振替`:`${Number(transfer.original.slice(5,7))}月分`}</small></span>{:else}<span class="muted">なし</span>{/each}</Table.Cell><Table.Cell><Button size="sm" variant="ghost" onclick={()=>onStudent(row.student.name)}>生徒情報</Button></Table.Cell></Table.Row>{:else}<Table.Row><Table.Cell colspan={6}>{filter==='incomplete'?'不足・超過の生徒はいません。':'該当する生徒はいません。'}</Table.Cell></Table.Row>{/each}</Table.Body></Table.Root></div>
</AdminPanel>
<style>
.schedule-status-cell{display:flex;flex-direction:column;align-items:flex-start;gap:5px;width:150px}.schedule-status-cell small{color:var(--muted-foreground);font-size:12px}
.placement-fraction{white-space:nowrap;font-variant-numeric:tabular-nums}
.placement-count{display:grid;justify-items:start;gap:3px}.placement-count>small{font-size:11px;font-weight:650}.placement-count.shortage{color:var(--destructive)}.placement-count.excess{color:#9a6700}.placement-count .student-period{color:var(--muted-foreground);font-weight:400}
.placement-lessons{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0;min-width:220px;max-width:340px}
.placement-lessons button{display:flex;flex-direction:column;gap:3px;padding:5px 8px;min-height:36px;border:1px solid var(--border);border-radius:5px;background:transparent;color:inherit;text-align:left;cursor:pointer}
.placement-lessons button:hover{background:var(--muted);border-color:var(--primary)}
.placement-lessons button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.placement-lessons strong{font-size:12px;font-weight:400;white-space:nowrap}
</style>

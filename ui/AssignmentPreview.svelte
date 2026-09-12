<script lang="ts">
import type {MonthlyWorkload} from '../lib/monthly-balance';
import type {State} from '../lib/scheduler';
import {issues} from '../lib/scheduler';
import DateText from './DateText.svelte';
let {current,proposed,scope,reasons,workload}:{current:State;proposed:State;scope:string[];reasons:Record<string,string>;workload?:MonthlyWorkload[]}=$props();
const slots=$derived(proposed.slots.filter(slot=>scope.includes(slot.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)));
const lessons=$derived(proposed.lessons.filter(lesson=>scope.includes(lesson.slot)&&!lesson.absent));
const previous=$derived(new Map(current.lessons.map(lesson=>[lesson.id,lesson.teacher])));
const changedLessons=$derived(lessons.filter(lesson=>(previous.get(lesson.id)||'')!==(lesson.teacher||'')));
const changed=$derived(changedLessons.length);
const warnings=$derived(issues(proposed).filter(issue=>scope.includes(issue.slot)));
</script>
<div class="assignment-preview">
 <div class="assignment-summary"><span>担当変更 <strong>{changed}件</strong></span><span>担当未定 <strong>{lessons.filter(lesson=>!lesson.teacher).length}件</strong></span><span>確認事項 <strong>{warnings.length}件</strong></span></div>
 <p class="assignment-help">変更前後と理由を確認してから適用してください。</p>
 {#if workload?.length}
  <section class="workload-summary" aria-label="月内の勤務バランス">
   <h3>月内の勤務バランス</h3>
   <p class="assignment-help">全教室の月内勤務を集計します。確定済みの過去日・固定業務・自動出勤を含み、同じコマの生徒数は勤務コマ数に影響しません。他の先生で代替できない勤務は分けて評価し、「不足時のみ」より「出勤可」を優先します。限られた出勤可の枠を活用し、勤務パターンと担当科目の組合せから配置します。</p>
   <div class="workload-table"><table><thead><tr><th>先生</th><th>勤務可能枠</th><th>出勤日数</th><th>勤務コマ数</th><th>児童割当（延べ）</th></tr></thead><tbody>
   {#each workload as row}<tr><th>{row.name}{#if row.excluded}<small>自動割当対象外</small>{/if}</th><td>{row.availableDays}日 / {row.availablePeriods}コマ</td><td>{row.beforeDays} → <strong>{row.afterDays}日</strong></td><td>{row.beforePeriods} → <strong>{row.afterPeriods}コマ</strong></td><td>{row.beforeLessons} → <strong>{row.afterLessons}件</strong></td></tr>{/each}
   </tbody></table></div>
   <p class="assignment-help">勤務可能枠は、授業の担当条件と連続勤務を満たせる提出枠、および固定の勤務枠です。児童割当は1人・1コマを1件として数えます。対象外の先生の担当授業も外して再計算し、自動では割り当てません。条件によって均等にできない場合があります。</p>
  </section>
 {/if}
 {#if slots.length&&!changed}<p>割り当ての変更はありません。</p>{/if}
 {#each slots as slot}
  {@const list=changedLessons.filter(lesson=>lesson.slot===slot.id)}
  {@const slotWarnings=warnings.filter(issue=>issue.slot===slot.id)}
  {#if list.length||slotWarnings.length}
   <section class="assignment-slot">
    <h3><DateText value={slot.date}/><span>{slot.start}–{slot.end}</span></h3>
    {#each list as lesson (lesson.id)}
     {@const before=previous.get(lesson.id)||''}
     <div class="assignment-row changed" class:unassigned={!lesson.teacher}>
      <div class="assignment-student"><strong>{lesson.name}</strong><small>{lesson.course}{lesson.exam?' · 検定本番':''}</small></div>
      <div class="assignment-teacher"><span>{before||'担当未定'}</span><span aria-label="変更後">→</span><strong>{lesson.teacher||'担当未定'}</strong></div>
      <small class="assignment-state">変更</small>
      <p class="assignment-reason">{reasons[lesson.id]}</p>
     </div>
    {/each}
    {#if slotWarnings.length}<ul class="assignment-warnings" aria-label="この時間帯の確認事項">{#each slotWarnings as warning}<li>{warning.text}</li>{/each}</ul>{/if}
   </section>
  {/if}
 {:else}<p>対象の授業コマがありません。</p>{/each}
</div>
<style>
.workload-summary{display:grid;gap:8px}.workload-summary h3{font-size:14px;font-weight:600}.workload-table{overflow-x:auto}.workload-table table{width:100%;font-size:12px;border-collapse:collapse}.workload-table th,.workload-table td{padding:8px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}.workload-table th small{display:block;font-size:10px;font-weight:400;color:var(--muted-foreground)}
.assignment-preview{display:grid;gap:14px;container-type:inline-size;container-name:assignment-preview}
.assignment-summary{display:flex;flex-wrap:wrap;gap:8px 20px;padding:12px;border-radius:8px;background:var(--muted);font-size:13px}
.assignment-reason{grid-column:1/-1;font-size:12px;color:var(--muted-foreground);margin:0}
.assignment-help{font-size:12px;color:var(--muted-foreground)}
.assignment-slot{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.assignment-slot h3{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 12px;background:var(--muted);font-size:13px}
.assignment-slot h3 span{font-weight:400}
.assignment-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) auto;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--border)}
.assignment-student{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}
.assignment-student small,.assignment-state{font-size:11px;color:var(--muted-foreground)}
.assignment-teacher{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:13px;overflow-wrap:anywhere}
.assignment-teacher>span:first-child{color:var(--muted-foreground)}
.assignment-row.changed{background:color-mix(in srgb,var(--primary) 5%,var(--background))}
.assignment-row.unassigned .assignment-teacher>strong{color:var(--destructive)}
.assignment-warnings{margin:0;padding:10px 12px 10px 28px;border-top:1px solid var(--border);font-size:12px;line-height:1.7;background:var(--muted);overflow-wrap:anywhere}
@container assignment-preview (max-width:440px){.assignment-row{grid-template-columns:minmax(0,1fr) auto}.assignment-teacher{grid-row:2;grid-column:1/-1}.assignment-state{grid-column:2;grid-row:1}}
</style>

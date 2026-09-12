<script lang="ts">
import {onMount} from 'svelte';
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import {Checkbox} from '@mutsuna/ui/checkbox';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import {Layers} from '@lucide/svelte';
import {showSuccessToast} from '@mutsuna/ui/sonner';
import Picker from './Picker.svelte';
import MonthNavigator from './MonthNavigator.svelte';
import SlackNotifications from './SlackNotifications.svelte';
import ShiftCalendar,{type CalendarSlot} from './ShiftCalendar.svelte';
import {key,type State,type Slot} from '../lib/scheduler';
import {scheduledForWork,workAt} from '../lib/work-assignments';
import {configuredSlots} from '../lib/recurrence';
let {state:s,room,month,teacher=$bindable(''),fixedTeacher='',canPrepare=true,canSendSlack=false,onMonth,onChange,onPrepare}:{state:State;room:string;month:string;teacher?:string;fixedTeacher?:string;canPrepare?:boolean;canSendSlack?:boolean;onMonth:(v:string)=>void;onChange:(n:State,text:string)=>void;onPrepare:()=>void}=$props();
let dutyView=$state(false);
let hourlyRate=$state<number|undefined>(1100);
let rateLoaded=$state(false);
const rateStorageKey='naresuku:shift-hourly-rate';
onMount(()=>{if(new URLSearchParams(location.search).get('mode')==='duty')dutyView=true;try{const saved=localStorage.getItem(rateStorageKey);if(saved!==null&&saved.trim()!==''){const value=Number(saved);if(Number.isFinite(value)&&value>=0)hourlyRate=value}}catch{}rateLoaded=true});
$effect(()=>{if(!rateLoaded||hourlyRate===undefined||!Number.isFinite(hourlyRate)||hourlyRate<0)return;try{localStorage.setItem(rateStorageKey,String(hourlyRate))}catch{}});
let mode=$state('yes'),bulk=$state(false),days=$state<number[]>([]),times=$state<string[]>([]),overwrite=$state(false);
let bulkScope=$state<'unfilled'|'custom'>('unfilled');
const weekdays=['月','火','水','木','金','土','日'];
const symbols:Record<string,string>={yes:'○',reserve:'△',no:'×','':''};
const labels:Record<string,string>={yes:'出勤可能',reserve:'不足時のみ',no:'出勤不可','':'未入力'};
const statusValues=['','yes','reserve','no'];
const slots=$derived(s.slots.filter(x=>x.room===room&&x.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)));
const operatingWeekdays=$derived([...new Set(slots.map(slot=>(new Date(slot.date+'T12:00:00Z').getUTCDay()+6)%7))].sort((a,b)=>a-b));
const operatingDates=$derived(new Set(configuredSlots(s,month,room).map(slot=>slot.date)));
const timeOptions=$derived([...new Set(slots.map(x=>x.start+'–'+x.end))].sort());
const roomTeachers=$derived(s.teachers.filter(item=>item.rooms?.includes(room)));
const availableCounts=$derived.by(()=>Object.fromEntries(slots.map(slot=>[slot.id,roomTeachers.filter(item=>s.availability[key(item.name,slot.id)]==='yes').length])));
const scheduledSlots=$derived(slots.filter(slot=>!!teacher&&scheduledForWork(s,teacher,slot.id)));
const paidMinutes=$derived(scheduledSlots.reduce((sum,slot)=>{const [sh,sm]=slot.start.split(':').map(Number),[eh,em]=slot.end.split(':').map(Number);const duration=(eh-sh)*60+em-sm;return sum+(Number.isFinite(duration)&&duration>0?duration+15:0)},0));
const estimatedIncome=$derived(hourlyRate!==undefined&&Number.isFinite(hourlyRate)&&hourlyRate>=0?Math.round(paidMinutes*hourlyRate/60):null);
const calendarSlots=$derived(dutyView?slots.map(slot=>({...slot,activity:workAt(s,teacher,slot.id).map(item=>item.title).join('・'),status:teacher&&scheduledForWork(s,teacher,slot.id)?'yes':''})):slots.map(slot=>({...slot,status:teacher?s.availability[key(teacher,slot.id)]||'':'',adopted:teacher?!!s.duty[key(teacher,slot.id)]:false,count:teacher?undefined:availableCounts[slot.id]||0})));
const unfilledCount=$derived(slots.filter(x=>!s.availability[key(teacher,x.id)]).length);
const targets=$derived(slots.filter(x=>bulkScope==='unfilled'?!s.availability[key(teacher,x.id)]:days.includes((new Date(x.date+'T12:00:00Z').getUTCDay()+6)%7)&&times.includes(x.start+'–'+x.end)&&(overwrite||!s.availability[key(teacher,x.id)])));
const changes=$derived(targets.filter(x=>(s.availability[key(teacher,x.id)]||'')!==mode));
const overwrittenCount=$derived(changes.filter(x=>!!s.availability[key(teacher,x.id)]).length);
const counts=$derived({no:slots.filter(x=>s.availability[key(teacher,x.id)]==='no').length,yes:slots.filter(x=>s.availability[key(teacher,x.id)]==='yes').length,reserve:slots.filter(x=>s.availability[key(teacher,x.id)]==='reserve').length});
function apply(list:Slot[],value=mode){if(!teacher||!list.length)return;const n=structuredClone(s);for(const sl of list){const k=key(teacher,sl.id);if(value)n.availability[k]=value;else delete n.availability[k]}onChange(n,teacher+' '+room+'の出勤希望を'+list.length+'コマ更新（'+labels[value]+'）')}
function toggle(sl:Slot){const current=s.availability[key(teacher,sl.id)]||'',index=statusValues.indexOf(current);apply([sl],statusValues[(index+1)%statusValues.length])}
function toggleCalendar(sl:CalendarSlot){const source=slots.find(slot=>slot.id===sl.id);if(source)toggle(source)}
function setCalendar(sl:CalendarSlot,status:string){const source=slots.find(slot=>slot.id===sl.id);if(source)apply([source],status)}
function allCalendar(list:CalendarSlot[],status:string){apply(slots.filter(slot=>list.some(item=>item.id===slot.id)),status)}
function selectUnfilled(){bulkScope='unfilled';days=[...operatingWeekdays];times=[...timeOptions];overwrite=false;if(!mode)mode='yes'}
function openBulk(){selectUnfilled();bulk=true}
function chooseDay(day:number,v:boolean){days=v?[...days,day]:days.filter(x=>x!==day)}
function chooseTime(time:string,v:boolean){times=v?[...times,time]:times.filter(x=>x!==time)}
</script>
<div class="shift-workspace">
<div class="shift-toolbar">
 <div class="shift-toolbar-top">
  <div class="shift-mode-switch" role="group" aria-label="表示切り替え">
   <Button variant="ghost" aria-pressed={!dutyView} onclick={()=>dutyView=false}>シフト希望</Button>
   <Button variant="ghost" aria-pressed={dutyView} onclick={()=>dutyView=true}>出勤予定</Button>
  </div>
  {#if !fixedTeacher}<div class="shift-staff-select"><Picker label="自分の名前を選択" bind:value={teacher} items={[{value:'',label:'自分の名前を選択'},...roomTeachers.map(x=>({value:x.name,label:x.name}))]}/></div>{/if}
 </div>
 <div class="shift-month-actions">
  <MonthNavigator value={month} onchange={onMonth} label="シフト表示月"/>
  {#if !dutyView}<Button class="shift-bulk-action" variant="ghost" disabled={!teacher||!slots.length} onclick={openBulk}><Layers size={16}/>一括入力</Button>{/if}
 </div>
 {#if teacher&&!dutyView}<div class="shift-status-summary" aria-label="希望の入力状況"><span>○ {counts.yes}</span><span>△ {counts.reserve}</span><span>× {counts.no}</span><span class="shift-unfilled">未入力 {slots.length-counts.yes-counts.reserve-counts.no}</span></div>{/if}
</div>
{#if canSendSlack}<div class="shift-management-actions"><span>スタッフへの連絡</span><SlackNotifications {room} {month}/></div>{/if}
{#if dutyView&&teacher}<div class="shift-income"><span>{room} · <strong>{scheduledSlots.length}コマ</strong></span><label>時給<Input type="number" min="0" step="10" inputmode="numeric" bind:value={hourlyRate} aria-label="概算収入の計算に使う時給"/>円</label><span aria-live="polite">概算 <strong>{estimatedIncome===null?'':estimatedIncome.toLocaleString('ja-JP')+'円'}</strong></span><small>各コマの授業時間＋15分</small></div>{/if}
{#if !slots.length}<div class="shift-empty"><p>この月のシフト入力枠はまだ作成されていません。</p>{#if canPrepare}<Button onclick={onPrepare}>{Number(month.slice(5,7))}月のシフト入力枠を作成</Button><small>教室設定の曜日・コマから作成します。生徒の授業予定は作成されません。</small>{:else}<small>管理者が入力枠を作成すると入力できます。</small>{/if}</div>{/if}
<ShiftCalendar {month} slots={calendarSlots} operatingDates={[...operatingDates]} editable={!!teacher&&!dutyView} {dutyView} onToggle={toggleCalendar} onSet={setCalendar} onAllSet={allCalendar}/>
{#if !dutyView}<p class="footnote">日付の「○・△・×」で、その日の全コマを一括入力できます。入力済みの希望も上書きします。コマを押すと「未入力→出勤可能→不足時のみ→出勤不可」の順に切り替わります。右端のメニューから直接指定もできます。入力後は右上の「変更を保存」を押してください。</p>{/if}
</div>
<Dialog.Root bind:open={bulk}>
 <Dialog.Content class="shift-bulk-dialog">
  <Dialog.Header>
   <Dialog.Title>シフト希望を一括入力</Dialog.Title>
   <Dialog.Description>{Number(month.slice(0,4))}年{Number(month.slice(5,7))}月 · {room} · {teacher}</Dialog.Description>
  </Dialog.Header>
  <Dialog.Body>
   <div class="bulk-form">
    <fieldset class="bulk-fieldset">
     <legend>入力する範囲</legend>
     <div class="bulk-scope-options">
      <label class:chosen={bulkScope==='unfilled'}><input type="radio" name="shift-bulk-scope" value="unfilled" checked={bulkScope==='unfilled'} onchange={selectUnfilled}/><span><strong>未入力をまとめて</strong><small>この月の空欄 {unfilledCount}コマ</small></span></label>
      <label class:chosen={bulkScope==='custom'}><input type="radio" name="shift-bulk-scope" value="custom" bind:group={bulkScope}/><span><strong>条件を指定</strong><small>曜日・時間帯で選ぶ</small></span></label>
     </div>
    </fieldset>
    {#if bulkScope==='custom'}
     <div class="bulk-filters">
      <fieldset class="bulk-fieldset">
       <legend>曜日</legend>
       <div class="bulk-weekdays" style:grid-template-columns={"repeat("+Math.max(1,operatingWeekdays.length)+",minmax(0,1fr))"}>{#each operatingWeekdays as i (i)}<label class:chosen={days.includes(i)}><input type="checkbox" checked={days.includes(i)} onchange={e=>chooseDay(i,e.currentTarget.checked)}/><span>{weekdays[i]}</span></label>{/each}</div>
      </fieldset>
      <fieldset class="bulk-fieldset">
       <legend>時間帯</legend>
       <div class="bulk-shortcuts"><Button size="sm" variant="ghost" onclick={()=>times=[...timeOptions]}>すべて選択</Button><Button size="sm" variant="ghost" onclick={()=>times=[]}>選択解除</Button></div>
       <div class="bulk-times">{#each timeOptions as time (time)}<label class:chosen={times.includes(time)}><Checkbox checked={times.includes(time)} onCheckedChange={v=>chooseTime(time,v===true)}/><span>{time}</span></label>{/each}</div>
      </fieldset>
     </div>
    {/if}
    <fieldset class="bulk-fieldset">
     <legend>入力する希望</legend>
     <div class="bulk-status-options">
      {#each ['yes','reserve','no'] as value (value)}
       <label class={'bulk-status '+value} class:chosen={mode===value}><input type="radio" name="shift-bulk-status" bind:group={mode} {value}/><span class="bulk-symbol" aria-hidden="true">{symbols[value]}</span><strong>{labels[value]}</strong><small>{value==='yes'?'通常の出勤候補':value==='reserve'?'人手が足りない時':'出勤できない'}</small></label>
      {/each}
     </div>
     {#if bulkScope==='custom'}<label class="bulk-reset"><input type="radio" name="shift-bulk-status" bind:group={mode} value=""/>未入力に戻す</label>{/if}
    </fieldset>
    {#if bulkScope==='custom'}<label class="bulk-overwrite"><Checkbox bind:checked={overwrite}/><span><strong>入力済みの希望も上書きする</strong><small>オフの場合は、条件に合う空欄だけに反映します。</small></span></label>{:else}<p class="bulk-preserve">入力済みの希望はそのまま残ります。</p>{/if}
    {#if overwrittenCount>0}<p class="bulk-warning">入力済みの希望 {overwrittenCount}コマを{mode?'上書きします。':'未入力に戻します。'}</p>{/if}
   </div>
  </Dialog.Body>
  <Dialog.Footer class="bulk-footer">
   <div class="bulk-result" aria-live="polite"><div><strong>{changes.length}</strong><span>コマ{changes.length?'を「'+labels[mode]+'」に変更':'が変更対象です'}</span></div><small>{!changes.length?(bulkScope==='unfilled'?'この月の希望はすべて入力済みです。':!days.length||!times.length?'曜日と時間帯を選んでください。':mode===''&&!overwrite?'希望を消すには上書きをオンにしてください。':'この条件で変更するコマはありません。'):'担当・勤務の割り当ては変更しません。'}</small></div>
   <div class="bulk-footer-actions"><Button variant="outline" onclick={()=>bulk=false}>キャンセル</Button><Button disabled={!teacher||!changes.length} onclick={()=>{const count=changes.length;apply(changes);bulk=false;showSuccessToast(count+'コマに反映しました。変更を保存してください。')}}>{changes.length}コマに反映</Button></div>
   <p class="bulk-save-note">反映後、画面上部の「変更を保存」で確定します。</p>
  </Dialog.Footer>
 </Dialog.Content>
</Dialog.Root>

<style>
.bulk-form input[type=radio]{appearance:none;width:16px;height:16px;flex-shrink:0;border:1px solid var(--muted-foreground);border-radius:50%;background:var(--background);cursor:pointer}.bulk-form input[type=radio]:checked{border:5px solid var(--primary)}
:global(.shift-bulk-dialog){width:calc(100% - 32px);max-width:600px;gap:0;overflow:clip}
:global(.shift-bulk-dialog>[data-slot=drawer-header]),:global(.shift-bulk-dialog>[data-slot=dialog-header]),:global(.shift-bulk-dialog>.bulk-footer){flex-shrink:0}
.bulk-form{display:grid;gap:24px;padding:24px 0}
.bulk-fieldset{min-width:0;border:0;padding:0;margin:0}.bulk-fieldset legend{padding:0;margin-bottom:12px;font-size:13px;font-weight:650}
.bulk-scope-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bulk-scope-options label{display:flex;align-items:flex-start;gap:10px;padding:14px;border:1px solid var(--border);border-radius:10px;cursor:pointer}.bulk-scope-options label.chosen{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,var(--background))}.bulk-scope-options input{margin-top:3px;accent-color:var(--primary)}.bulk-scope-options span{display:grid;gap:4px}.bulk-scope-options strong{font-size:14px}.bulk-scope-options small{font-size:12px;color:var(--muted-foreground)}
.bulk-filters{display:grid;gap:20px;padding:18px;border:1px solid var(--border);border-radius:10px;background:color-mix(in srgb,var(--muted) 35%,var(--background))}.bulk-shortcuts{display:flex;gap:4px;margin:-6px 0 8px}.bulk-shortcuts :global(button){padding-inline:8px;min-height:36px;font-size:12px}.bulk-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.bulk-weekdays label{position:relative;display:grid;place-items:center;min-height:42px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--background);font-size:14px}.bulk-weekdays label.chosen{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}.bulk-weekdays input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}.bulk-weekdays label:focus-within{outline:2px solid var(--ring);outline-offset:2px}.bulk-times{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bulk-times label{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--background);font-size:13px;cursor:pointer}.bulk-times label.chosen{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
.bulk-status-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.bulk-status{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--border);border-radius:10px;padding:18px 6px 14px;cursor:pointer;background:var(--background)}.bulk-status input{position:absolute;top:10px;right:10px;accent-color:var(--primary)}.bulk-symbol{font-size:30px;line-height:1.2}.bulk-status strong{font-size:13px}.bulk-status small{font-size:11px;color:var(--muted-foreground)}.bulk-status.chosen{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary);background:color-mix(in srgb,var(--primary) 6%,var(--background))}.bulk-status.yes .bulk-symbol{color:#167247}.bulk-status.reserve .bulk-symbol{color:#926b0c}.bulk-status.no .bulk-symbol{color:var(--muted-foreground)}.bulk-status:focus-within,.bulk-scope-options label:focus-within{outline:2px solid var(--ring);outline-offset:3px}.bulk-reset{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;min-height:36px;cursor:pointer}.bulk-reset input{accent-color:var(--primary)}
.bulk-overwrite{display:flex;align-items:flex-start;gap:10px;cursor:pointer}.bulk-overwrite :global([data-slot=checkbox]){margin-top:2px;flex-shrink:0}.bulk-overwrite span{display:grid;gap:4px}.bulk-overwrite strong{font-size:13px;font-weight:500}.bulk-overwrite small,.bulk-preserve{font-size:12px;color:var(--muted-foreground)}.bulk-preserve{margin:0}.bulk-warning{margin:0;padding:12px;border-radius:8px;background:#fff5dc;color:#745519;font-size:13px}
:global(.bulk-footer){display:flex;flex-direction:column;align-items:stretch;gap:14px;background:color-mix(in srgb,var(--muted) 35%,var(--background))}.bulk-result>div{display:flex;align-items:baseline;gap:6px}.bulk-result strong{font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums}.bulk-result span{font-size:14px}.bulk-result small{display:block;margin-top:6px;font-size:12px;color:var(--muted-foreground)}.bulk-footer-actions{display:flex;gap:10px}.bulk-footer-actions :global(button){min-height:42px}.bulk-footer-actions :global(button:last-child){flex:1}.bulk-save-note{margin:0;text-align:center;font-size:11px;color:var(--muted-foreground)}
@media(max-width:640px){:global(.shift-bulk-dialog){width:100%;max-width:100%}.bulk-form{gap:20px;padding:18px 0}.bulk-scope-options{gap:8px}.bulk-scope-options label{padding:12px 10px;gap:7px}.bulk-scope-options strong{font-size:13px}.bulk-scope-options small{font-size:11px}.bulk-status-options{gap:8px}.bulk-status{padding-top:26px}.bulk-status input{top:8px;right:8px}.bulk-status small{font-size:10px}.bulk-filters{padding:12px}.bulk-weekdays{gap:4px}.bulk-times{grid-template-columns:1fr}}

.shift-management-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:6px 0;color:var(--muted-foreground);font-size:12px}

.shift-income{display:flex;align-items:center;flex-wrap:wrap;gap:10px 20px;padding:10px 0;font-size:14px}.shift-income label{display:flex;align-items:center;gap:6px}.shift-income :global(input){width:96px;height:34px;min-height:34px}.shift-income small{color:var(--muted-foreground);font-size:12px}.shift-income strong{font-variant-numeric:tabular-nums}.shift-workspace{min-width:0;container-type:inline-size;container-name:shift-workspace}
.shift-toolbar{display:grid;gap:12px;padding:4px 0 12px;border-bottom:1px solid var(--border)}
.shift-toolbar-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.shift-mode-switch{display:flex;gap:4px;padding:4px;border-radius:10px;background:var(--muted)}
.shift-mode-switch :global(button){flex:1;min-height:40px;padding-inline:20px;color:var(--muted-foreground)}
.shift-mode-switch :global(button[aria-pressed=true]){background:var(--background);color:var(--foreground);box-shadow:0 1px 3px #00000014}
.shift-staff-select{width:220px;max-width:100%}
.shift-staff-select :global([data-slot=select-trigger]){width:100%}
.shift-month-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}
.shift-month-actions :global(.shift-bulk-action){flex-shrink:0;min-height:40px;padding-inline:10px;gap:6px;font-size:13px}
.shift-status-summary{display:flex;align-items:center;gap:16px;color:var(--muted-foreground);font-size:12px;font-variant-numeric:tabular-nums}
.shift-unfilled{margin-left:auto}
.shift-empty{margin:20px 4px}.shift-workspace>.footnote{margin:16px 4px 0}
@container shift-workspace (min-width:681px){
 .shift-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:12px 20px;padding:8px 0 12px}
 .shift-toolbar-top{display:contents}
 .shift-mode-switch{flex-shrink:0}
 .shift-staff-select{width:190px}
 .shift-month-actions{margin-left:auto;justify-content:flex-end;gap:12px}
 .shift-status-summary{flex-basis:100%;justify-content:flex-end;gap:16px}
 .shift-unfilled{margin-left:0;padding-left:16px;border-left:1px solid var(--border)}
}
@container shift-workspace (max-width:680px){
 .shift-toolbar-top{display:flex}
 .shift-month-actions{min-width:0}
 .shift-mode-switch{width:100%}
 .shift-staff-select{width:100%}
 .shift-month-actions :global(.month-navigator){width:auto;flex:1;max-width:280px;min-width:0;grid-template-columns:32px minmax(0,1fr) 32px;gap:2px}
 .shift-month-actions :global(.month-navigator>[data-slot=button]){width:32px}
 .shift-month-actions :global(.calendar-picker){min-width:0;padding-inline:4px;font-size:13px}
 .shift-workspace>.footnote{margin-inline:0}
}
</style>

<script lang="ts">
import {Calendar} from '@mutsuna/ui/calendar';
import {Button} from '@mutsuna/ui/button';
import {parseDate,type DateValue} from '@internationalized/date';
import DateText from './DateText.svelte';
let {items,value='',label='授業日・授業コマ',onchange}:{items:{id:string;date:string;start:string;end:string;label?:string}[];value?:string;label?:string;onchange:(value:string)=>void}=$props();
const dates=$derived([...new Set(items.map(item=>item.date))].sort());
const selected=$derived(items.find(item=>item.id===value));
let browsingDate=$state('');
const date=$derived(dates.includes(browsingDate)?browsingDate:selected?.date||dates[0]||'');
const dayItems=$derived(items.filter(item=>item.date===date).sort((a,b)=>a.start.localeCompare(b.start)));
const calendarValue=$derived(date?parseDate(date):undefined);
let month=$state<DateValue>();
</script>
<div class="lesson-slot-picker" role="group" aria-label={label}>
 {#if dates.length}
 <div class="slot-layout"><Calendar type="single" value={calendarValue} onValueChange={(day:DateValue|undefined)=>{if(day)browsingDate=day.toString()}} placeholder={month??calendarValue} onPlaceholderChange={(day:DateValue)=>month=day} preventDeselect fixedWeeks={false} showToday={false} disableDaysOutsideMonth minValue={parseDate(dates[0])} maxValue={parseDate(dates[dates.length-1])} isDateDisabled={(day:DateValue)=>!dates.includes(day.toString())} aria-label={label} class="slot-calendar"/>
 <div class="slot-options"><strong><DateText value={date}/>の授業コマ</strong><div class="slot-buttons">{#each dayItems as item (item.id)}<Button type="button" variant={value===item.id?'default':'outline'} aria-pressed={value===item.id} onclick={()=>{if(value!==item.id)onchange(item.id)}}>{item.start}–{item.end}{item.label?' · '+item.label:''}</Button>{/each}</div></div></div>
 {#if selected}<p class="selection" aria-live="polite">選択中：<DateText value={selected.date}/> {selected.start}–{selected.end}</p>{:else}<p class="selection">日付を選び、授業コマを押してください。</p>{/if}
 {:else}<p class="selection">選択できる授業コマがありません。</p>{/if}
</div>
<style>
.lesson-slot-picker{display:grid;gap:12px;min-width:0;container-type:inline-size}.slot-layout{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:24px}.slot-options{display:grid;gap:12px;padding-top:12px;min-width:0}.slot-options strong{font-size:13px}.slot-buttons{display:grid;gap:8px}.slot-buttons :global(button){min-height:44px;width:100%;white-space:normal;height:auto;padding-block:10px}.selection{font-size:13px;color:var(--muted-foreground);margin:0}
@container(max-width:460px){.slot-layout{grid-template-columns:minmax(0,1fr);gap:12px}.slot-layout :global(.slot-calendar){margin-inline:auto}.slot-options{padding-top:0}}
</style>

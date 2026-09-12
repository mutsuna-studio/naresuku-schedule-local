<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import * as Drawer from '@mutsuna/ui/drawer';
import * as DropdownMenu from '@mutsuna/ui/dropdown-menu';
import {Check,ChevronDown,ChevronLeft,ChevronRight} from '@lucide/svelte';
import DateText from './DateText.svelte';

export type CalendarSlot={id:string;date:string;start:string;end:string;status:string;activity?:string;adopted?:boolean;count?:number};
let {month,slots,operatingDates=[],editable=true,dutyView=false,onToggle,onSet,onAllSet}:{month:string;slots:CalendarSlot[];operatingDates?:string[];editable?:boolean;dutyView?:boolean;onToggle?:(slot:CalendarSlot)=>void;onSet?:(slot:CalendarSlot,status:string)=>void;onAllSet?:(slots:CalendarSlot[],status:string)=>void}=$props();
let chosen=$state('');
let detailOpen=$state(false);
const weekdays=['月','火','水','木','金','土','日'];
const statuses=['','yes','reserve','no'];
const symbols:Record<string,string>={'':'',yes:'○',reserve:'△',no:'×'};
const labels:Record<string,string>={'':'未入力',yes:'出勤可能',reserve:'不足時のみ',no:'出勤不可'};
const dates=$derived.by(()=>{const first=new Date(month+'-01T12:00:00Z'),offset=(first.getUTCDay()+6)%7,last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);return Array.from({length:Math.ceil((offset+last.getUTCDate())/7)*7},(_,i)=>{const n=i-offset+1;return n<1||n>last.getUTCDate()?'':month+'-'+String(n).padStart(2,'0')})});
const selected=$derived(chosen.startsWith(month)?chosen:slots[0]?.date||month+'-01');
const operating=$derived(new Set(operatingDates));
const slotDates=$derived([...new Set(slots.filter(slot=>slot.date.startsWith(month+'-')).map(slot=>slot.date))].sort());
const previousDate=$derived(slotDates.filter(date=>date<selected).at(-1));
const nextDate=$derived(slotDates.find(date=>date>selected));
const selectedSlots=$derived(slots.filter(slot=>slot.date===selected));

</script>

{#snippet slotControl(slot:CalendarSlot,full=false)}
 {#if dutyView}
  <div class="shift-chip shift-chip-count shift-duty-slot" class:scheduled={slot.status==='yes'} aria-label={slot.date+' '+slot.start+'〜'+slot.end+(slot.status==='yes'?' 出勤予定':' 出勤予定なし')+(slot.activity?' '+slot.activity:'')}><span>{full?slot.start+'–'+slot.end:slot.start}{#if slot.activity}<small class="activity-label">{slot.activity}</small>{/if}</span><strong>{slot.status==='yes'?'○':''}</strong></div>
 {:else if slot.count!==undefined}
  <div class="shift-chip shift-chip-count" aria-label={slot.date+' '+slot.start+'〜'+slot.end+' 出勤希望 '+slot.count+'人'}><span>{full?slot.start+'–'+slot.end:slot.start}</span><strong>{slot.count}人</strong></div>
 {:else}
  <div class={'shift-chip '+slot.status} class:duty={slot.adopted}>
   <button class="shift-chip-main" disabled={!editable} aria-label={slot.date+' '+slot.start+'〜'+slot.end+' '+labels[slot.status]+(slot.adopted?' 採用済み':'')+'。クリックで次の状態へ変更'} onclick={()=>onToggle?.(slot)}><span>{full?slot.start+'–'+slot.end:slot.start}</span><strong>{symbols[slot.status]}{#if full&&slot.status} {labels[slot.status]}{/if}</strong></button>
   {#if editable}<DropdownMenu.Root><DropdownMenu.Trigger>{#snippet child({props})}<Button {...props} variant="ghost" size="icon-sm" class="shift-chip-menu" aria-label={slot.date+' '+slot.start+'〜'+slot.end+'の希望を直接選択'}><ChevronDown size={14}/></Button>{/snippet}</DropdownMenu.Trigger><DropdownMenu.Content align="end" class="min-w-36">{#each statuses as status}<DropdownMenu.Item onclick={()=>onSet?.(slot,status)}>{#if slot.status===status}<Check size={14}/>{:else}<span class="shift-menu-placeholder"></span>{/if}<span>{symbols[status]} {labels[status]}</span></DropdownMenu.Item>{/each}</DropdownMenu.Content></DropdownMenu.Root>{/if}
  </div>
 {/if}
{/snippet}

{#snippet dayControls(date:string,list:CalendarSlot[])}
 <div class="shift-day-actions" role="group" aria-label={date+'の全コマに一括入力'}>
  {#each ['yes','reserve','no'] as status}
   <Button variant="ghost" size="icon-sm" class="shift-day-symbol" disabled={!list.length} aria-label={date+'の全コマを'+labels[status]+'（'+symbols[status]+'）にする'} title={labels[status]+'を一括入力'} onclick={()=>onAllSet?.(list,status)}>{symbols[status]}</Button>
  {/each}
 </div>
{/snippet}

<div class="shift-calendar" aria-label={month+(dutyView?'の出勤予定カレンダー':'の出勤希望カレンダー')}>
 {#each weekdays as day,i}<div class="shift-weekday" class:weekend={i>4}>{day}</div>{/each}
 {#each dates as date,i}{@const list=slots.filter(slot=>slot.date===date)}<div class="shift-date" class:blank={!date} class:closed={!!date&&operatingDates.length>0&&!operating.has(date)&&!list.length} class:weekend={i%7>4} class:current={date===selected}>{#if date}<div class="shift-date-heading"><b><DateText value={date} dayOnly/></b>{#if list.length&&editable}{@render dayControls(date,list)}{/if}</div><Button variant="ghost" size="sm" class="shift-mobile-date" aria-label={date+'の時間帯を表示'} aria-pressed={date===selected} onclick={()=>{chosen=date;detailOpen=true}}><b><DateText value={date} dayOnly/></b><small>{list.length?(list[0].count!==undefined?list.reduce((sum,slot)=>sum+(slot.count||0),0)+'人':'○'+list.filter(slot=>slot.status==='yes').length+'/'+list.length):''}</small></Button><div class="shift-date-slots">{#each list as slot}{@render slotControl(slot)}{:else}<span class="shift-no-slots"></span>{/each}</div>{/if}</div>{/each}
</div>
<Drawer.Root bind:open={detailOpen}>
 <Drawer.Content>
  <Drawer.Header>
   <div class="shift-drawer-navigation">
    <Button variant="ghost" size="icon" aria-label="前の授業日" disabled={!previousDate} onclick={()=>{if(previousDate)chosen=previousDate}}><ChevronLeft size={18}/></Button>
    <Drawer.Title><DateText value={selected} format="long"/></Drawer.Title>
    <Button variant="ghost" size="icon" aria-label="次の授業日" disabled={!nextDate} onclick={()=>{if(nextDate)chosen=nextDate}}><ChevronRight size={18}/></Button>
   </div>
   <Drawer.Description>{dutyView?'この日の出勤予定':editable?'希望を入力し、完了後に画面上部の「変更を保存」を押してください。':'この日の出勤希望'}</Drawer.Description>
  </Drawer.Header>
  <div class="shift-drawer-body" data-vaul-no-drag>
   {#if editable}<div class="shift-drawer-bulk"><span>この日の全コマ</span>{@render dayControls(selected,selectedSlots)}</div>{/if}
   {#each selectedSlots as slot}{@render slotControl(slot,true)}{:else}<p class="shift-no-detail">この日の授業枠はありません。</p>{/each}
  </div>
  <Drawer.Footer><Button onclick={()=>detailOpen=false}>完了</Button></Drawer.Footer>
 </Drawer.Content>
</Drawer.Root>

<style>
.activity-label{display:block;font-size:11px;overflow-wrap:anywhere}
.shift-drawer-navigation{display:flex;align-items:center;justify-content:space-between;gap:8px}
.shift-drawer-body{min-height:0;overflow-y:auto;padding:0 16px;overscroll-behavior:contain}
.shift-drawer-bulk{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.shift-drawer-body .shift-day-actions :global(.shift-day-symbol){width:44px;height:44px}
.shift-drawer-body .shift-chip{margin-bottom:8px;min-height:44px}
.shift-drawer-body .shift-chip-main{min-height:44px}
.shift-drawer-body :global(.shift-chip-menu){min-width:44px!important}

.shift-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));overflow:visible;border:0;background:transparent}.shift-weekday{padding:10px 8px;border-bottom:1px solid var(--border);color:var(--muted-foreground);font-size:13px;font-weight:650;text-align:center}.shift-date{min-width:0;min-height:116px;padding:8px 7px 10px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}.shift-date:nth-child(7n){border-right:0}.shift-date.blank{background:color-mix(in srgb,var(--muted) 28%,transparent)}.shift-date.closed{background:var(--muted);color:var(--muted-foreground)}.shift-date-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;margin:0 1px 5px;font-size:13px}.shift-date-heading b{font-size:14px}.shift-day-actions{display:flex;flex-shrink:0;gap:2px}.shift-day-actions :global(.shift-day-symbol){width:26px;height:28px;min-height:28px;padding:0;font-size:18px;line-height:1}.shift-date-heading{flex-wrap:wrap}.shift-date-slots{display:grid;gap:5px}.shift-chip{display:flex;min-height:34px;overflow:hidden;border:1px solid var(--border);border-radius:6px;background:var(--background)}.shift-chip-main{display:flex;flex:1;align-items:center;gap:5px;min-width:0;min-height:32px;padding:5px 5px 5px 9px;border:0;background:transparent;color:inherit;text-align:left;font-variant-numeric:tabular-nums}.shift-chip-main>strong{margin-left:auto;margin-right:2px;text-align:center;white-space:nowrap}.shift-chip-count{align-items:center;padding:6px 10px;background:color-mix(in srgb,var(--muted) 55%,transparent)}.shift-chip-count>strong{margin-left:auto;padding-left:10px;color:var(--muted-foreground);white-space:nowrap}.shift-chip.yes{border-color:#86d5a7;background:#ecfdf3;color:#167247}.shift-duty-slot{background:transparent;border-color:transparent;color:var(--muted-foreground)}.shift-duty-slot.scheduled{background:#ecfdf3;border-color:#86d5a7;color:#167247}.shift-duty-slot.scheduled>strong{color:inherit}.shift-chip.reserve{border-color:#ddbd6b;background:#fff5dc;color:#745519}.shift-chip.duty{box-shadow:inset 3px 0 var(--primary)}.shift-chip-menu{width:1.7rem!important;min-width:1.7rem!important;height:auto!important;padding:0!important;border-left:1px solid currentColor!important;border-radius:0!important;color:inherit!important}.shift-menu-placeholder{width:.875rem}.shift-no-slots{padding:16px 0;color:var(--muted-foreground);text-align:center}.shift-mobile-date{display:none}.shift-no-detail{color:var(--muted-foreground)}
@container shift-workspace (max-width:680px){.shift-calendar{overflow:hidden}.shift-weekday{padding:8px 2px}.shift-date{min-height:62px;padding:3px 2px}.shift-date>.shift-date-heading,.shift-date>.shift-date-slots{display:none}.shift-mobile-date{display:flex;width:100%;min-height:56px;flex-direction:column;gap:1px;padding:4px 1px!important}.shift-mobile-date :global(small){font-size:10px}.shift-chip-count{padding:9px 12px}}
</style>

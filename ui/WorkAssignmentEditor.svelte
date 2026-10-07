<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import Picker from './Picker.svelte';
import LessonSlotPicker from './LessonSlotPicker.svelte';
import {Textarea} from '@mutsuna/ui/textarea';
import type {State} from '../lib/scheduler';
import {putWorkAssignment,lessonsReplacedByWork,type WorkAssignment} from '../lib/work-assignments';
let {state:s,room,date,onChange}:{state:State;room:string;date:string;onChange:(state:State,text:string)=>boolean|void}=$props();
let visible=$state(false),id=$state(''),slot=$state(''),teacherId=$state(''),title=$state('体験会'),note=$state(''),error=$state('');
const slots=$derived(s.slots.filter(item=>item.room===room&&item.date.startsWith(date.slice(0,7))).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)));
const teachers=$derived(s.teachers.filter(item=>(!item.archived||item.id===teacherId)&&item.rooms?.includes(room)&&item.id));
const draft=$derived<WorkAssignment>({id,slot,teacherId,title,note});
const replaced=$derived(lessonsReplacedByWork(s,draft));
const existing=$derived((s.workAssignments||[]).some(item=>item.id===id));
export function open(slotId?:string,item?:WorkAssignment){
 id=item?.id||crypto.randomUUID();slot=item?.slot||slotId||slots.find(item=>item.date===date)?.id||slots[0]?.id||'';teacherId=item?.teacherId||teachers[0]?.id||'';title=item?.title||'体験会';note=item?.note||'';error='';visible=true;
}
function apply(){try{const next=putWorkAssignment(s,draft);const staff=teachers.find(item=>item.id===teacherId)?.name||'';if(onChange(next,staff+'の固定業務「'+title.trim()+'」を'+(existing?'変更':'登録'))!==false)visible=false}catch(e){error=(e as Error).message}}
function remove(){const next=structuredClone(s);next.workAssignments=(next.workAssignments||[]).filter(item=>item.id!==id);if(onChange(next,'固定業務「'+title+'」を削除')!==false)visible=false}
</script>
<Dialog.Root bind:open={visible}><Dialog.Content class="sm:max-w-lg"><Dialog.Header><Dialog.Title>{existing?'固定業務を編集':'業務を割り当てる'}</Dialog.Title><Dialog.Description>自動割り当てでは担当者・時間帯を変更しません。</Dialog.Description></Dialog.Header><Dialog.Body><div class="work-fields">
 <div>{#if visible}{#key id}<LessonSlotPicker label="業務の日時" items={slots} value={slot} onchange={value=>slot=value}/>{/key}{/if}</div>
 <div>担当スタッフ<Picker label="業務の担当スタッフ" bind:value={teacherId} items={teachers.map(item=>({value:item.id!,label:item.name}))}/></div>
 <label>固定業務メモ<Textarea bind:value={note} maxlength={5000}/></label>
 <label>業務名<Input bind:value={title} maxlength={100} placeholder="体験会・事務作業など"/></label>
 <div class="work-presets">{#each ['体験会','事務作業','面談'] as value}<Button variant="outline" size="sm" onclick={()=>title=value}>{value}</Button>{/each}</div>
 {#if replaced.length}<p class="work-notice">この業務と重なる授業{replaced.length}件（{replaced.map(item=>item.name).join('、')}）は担当未定に戻します。</p>{/if}
 {#if error}<p role="alert" class="work-error">{error}</p>{/if}
 </div></Dialog.Body><Dialog.Footer>{#if existing}<Button variant="outline" onclick={remove}>業務を削除</Button>{/if}<Button variant="outline" onclick={()=>visible=false}>キャンセル</Button><Button disabled={!slot||!teacherId||!title.trim()} onclick={apply}>{replaced.length?'担当を外して業務を登録':existing?'変更を反映':'業務を登録'}</Button></Dialog.Footer></Dialog.Content></Dialog.Root>
<style>.work-fields{display:grid;gap:14px}.work-fields>div,.work-fields>label{display:grid;gap:6px}.work-fields>.work-presets{display:flex;gap:6px}.work-notice{font-size:13px;padding:10px;background:var(--muted);border-radius:6px}.work-error{font-size:13px;color:var(--destructive)}</style>

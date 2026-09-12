<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import {showErrorToast,showSuccessToast} from '@mutsuna/ui/sonner';
import CalendarPicker from './CalendarPicker.svelte';
import Picker from './Picker.svelte';
import type {State} from '../lib/scheduler';
import {monthlyLineLessons,monthlyLineMessage} from '../lib/line-message';
let {state:s,room,initialMonth,dirty}:{state:State;room:string;initialMonth:string;dirty:boolean}=$props();
let open=$state(false),month=$state(''),studentId=$state(''),note=$state(''),message=$state('');
const students=$derived((s.students||[]).filter(s=>s.room===room).sort((a,b)=>a.name.localeCompare(b.name,'ja')));
const student=$derived(students.find(s=>s.id===studentId));
const count=$derived(student?monthlyLineLessons(s,student,month).length:0);
$effect(()=>{message=student?monthlyLineMessage(s,student,month,note):''});
function launch(){month=initialMonth;studentId=students.find(st=>monthlyLineLessons(s,st,month).length)?.id||students[0]?.id||'';note='';open=true}
async function copy(){try{await navigator.clipboard.writeText(message);showSuccessToast('メッセージをコピーしました')}catch{showErrorToast('コピーできませんでした。本文を選択してコピーしてください')}}
</script>
<Button variant="outline" onclick={launch}>LINE用メッセージ</Button>
<Dialog.Root bind:open><Dialog.Content><Dialog.Header><Dialog.Title>LINE用メッセージ</Dialog.Title><Dialog.Description>{room}の月間スケジュール</Dialog.Description></Dialog.Header><Dialog.Body>
<div class="message-fields"><div>対象月<CalendarPicker mode="month" label="メッセージの対象月" bind:value={month}/></div><div>生徒<Picker label="メッセージの対象生徒" bind:value={studentId} items={students.map(s=>({value:s.id,label:s.name}))}/></div></div>
{#if dirty}<p class="footnote">未保存の変更を含みます。送信前にスケジュールを保存してください。</p>{/if}
<label class="message-label">特記（任意）<textarea rows="2" bind:value={note}></textarea></label>
{#if count}<label class="message-label">本文 · {count}コマ<textarea rows="13" bind:value={message}></textarea></label>{:else}<p class="footnote">この月の出席予定はありません。</p>{/if}
</Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>open=false}>閉じる</Button><Button disabled={!message.trim()||!count} onclick={copy}>コピー</Button></Dialog.Footer></Dialog.Content></Dialog.Root>
<style>
.message-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.message-fields>div{min-width:0}.message-label{display:grid;gap:6px;margin-top:16px;font-size:14px}.message-label textarea{width:100%;box-sizing:border-box;border:1px solid #c9c9cd;border-radius:6px;padding:10px;font:inherit;line-height:1.7;resize:vertical;background:white;color:#252528}@media(max-width:420px){.message-fields{grid-template-columns:1fr}}
</style>

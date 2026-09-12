<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {Checkbox} from '@mutsuna/ui/checkbox';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import {showSuccessToast,showErrorToast} from '@mutsuna/ui/sonner';
import Picker from './Picker.svelte';
import type {State} from '../lib/scheduler';
import {studentForLesson} from '../lib/students';
import {adminTransferCandidates,transferMessage} from '../lib/admin-transfer';
let {state:s,room,dirty}:{state:State;room:string;dirty:boolean}=$props();
let fromLesson=$state(false);
let open=$state(false),studentId=$state(''),lessonId=$state(''),chosen=$state<string[]>([]),message=$state(''),now=$state(Date.now());
const students=$derived((s.students||[]).filter(student=>student.room===room).sort((a,b)=>a.name.localeCompare(b.name,'ja')));
const lessons=$derived(s.lessons.filter(lesson=>(lesson.studentId===studentId||!lesson.studentId&&lesson.name===students.find(student=>student.id===studentId)?.name)&&s.slots.some(slot=>slot.id===lesson.slot&&slot.room===room)).sort((a,b)=>(s.slots.find(slot=>slot.id===b.slot)?.date||'').localeCompare(s.slots.find(slot=>slot.id===a.slot)?.date||'')));
const lesson=$derived(lessons.find(item=>item.id===lessonId));
const source=$derived(s.slots.find(slot=>slot.id===lesson?.slot));
const candidates=$derived(lesson?adminTransferCandidates(s,lesson.id,now):[]);
const selected=$derived(candidates.filter(slot=>chosen.includes(slot.id)));
const label=(slot:{date:string;start:string;end:string})=>new Date(slot.date+'T12:00:00+09:00').toLocaleDateString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'})+` ${slot.start}–${slot.end}`;
$effect(()=>{message=lesson&&source&&selected.length?transferMessage(source,selected,new Date(now)):''});
export function launch(targetId=''){const target=s.lessons.find(item=>item.id===targetId);studentId=target?studentForLesson(s,target)?.id||'':'';lessonId=target?.id||'';fromLesson=!!target;chosen=[];now=Date.now();open=true}
async function copy(){try{await navigator.clipboard.writeText(message);showSuccessToast('振替候補をコピーしました')}catch{showErrorToast('本文を選択してコピーしてください')}}
</script>
<Button variant="outline" onclick={()=>launch()}>振替候補</Button>
<Dialog.Root bind:open><Dialog.Content><Dialog.Header><Dialog.Title>LINE依頼の振替候補</Dialog.Title><Dialog.Description>{fromLesson?'この授業の振替候補から、案内する日時をチェックしてください。':'生徒と元の授業を選び、案内する候補をチェックしてください。'}</Dialog.Description></Dialog.Header><Dialog.Body>
{#if fromLesson&&lesson&&source}<div class="fields"><strong>{lesson.name}さん</strong><span>元の授業：{label(source)}</span></div>{:else}<div class="fields"><div>生徒<Picker searchable label="振替する生徒" value={studentId} onchange={value=>{studentId=value;lessonId='';chosen=[]}} items={students.map(student=>({value:student.id,label:student.name}))}/></div><div>元の授業<Picker label="振替元の授業" value={lessonId} onchange={value=>{lessonId=value;chosen=[];now=Date.now()}} items={lessons.map(lesson=>({value:lesson.id,label:label(s.slots.find(slot=>slot.id===lesson.slot)!)+(lesson.absent?' · 欠席':'')}))}/></div></div>
{/if}
{#if studentId&&!lessons.length}<p>この生徒の登録済み授業はありません。</p>{/if}
{#if dirty}<p class="footnote">未保存の変更を含みます。案内前にスケジュールを保存してください。</p>{/if}
{#if lesson}<p class="footnote">元の授業日から2か月以内の登録済み枠です。翌月以降は出勤希望に基づく候補です。申請期限・回数・再振替の可否は依頼内容と照合してください。</p>
<p class="footnote">スタッフが対応でき、生徒の希望スケジュールにも合う候補を優先表示しています。</p>
<div class="candidates">{#each candidates as candidate (candidate.id)}<label><Checkbox checked={chosen.includes(candidate.id)} onCheckedChange={checked=>chosen=checked?[...chosen,candidate.id]:chosen.filter(id=>id!==candidate.id)}/><span>{label(candidate)}{#if candidate.preferred}<small class="preferred">おすすめ · 第{candidate.priority}希望に一致</small>{/if}<small>{candidate.basis==='confirmed'?'担当配置あり':'出勤希望に基づく・要調整'}</small></span></label>{:else}<p>条件に合う候補がありません。開催枠・スタッフの配置や出勤希望を確認してください。検定の場合はスタッフの検定対応可の設定も確認してください。</p>{/each}</div>{/if}
{#if selected.length}<label class="message">LINE返信文 · {selected.length}件<textarea rows="10" bind:value={message}></textarea></label>{/if}
<p class="footnote">候補の作成・コピーでは、授業予定や欠席状態は変更されません。</p>
</Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>open=false}>閉じる</Button><Button disabled={!selected.length||!message.trim()} onclick={copy}>返信文をコピー</Button></Dialog.Footer></Dialog.Content></Dialog.Root>
<style>
.fields{display:grid;gap:14px}.candidates{display:grid;gap:10px;max-height:280px;overflow:auto;margin:16px 0}.candidates label{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:8px}.candidates small{display:block;color:var(--muted-foreground)}.candidates .preferred{color:var(--primary);font-weight:600}.message{display:grid;gap:8px}.message textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font:inherit;line-height:1.7;background:var(--background);color:var(--foreground);resize:vertical}
</style>

<script lang="ts">
import {AdminPanel} from '@mutsuna/ui/admin-layout';
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import {Badge} from '@mutsuna/ui/badge';
import * as Table from '@mutsuna/ui/table';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import {Check,Search,TriangleAlert} from '@lucide/svelte';
import CalendarPicker from './CalendarPicker.svelte';
import Picker from './Picker.svelte';
import type {State,Student,Lesson,Slot} from '../lib/scheduler';
import {statusAt} from '../lib/students';

type Wish={priority:number;slotId?:string;date?:string;start?:string;end?:string;later?:boolean};
type RequestView={lesson:Lesson;date:string;kind:string;reason:string;message:string;wishes:Wish[]};
type AdoptTarget={lesson:Lesson;wish:Wish}|null;

let {state:s,room,month,onMonth,onStudent,onSchedule,onAdopt,onReject}:{state:State;room:string;month:string;onMonth:(v:string)=>void;onStudent:(name:string)=>void;onSchedule:()=>void;onAdopt:(lessonId:string,slotId:string,priority:number)=>void;onReject:(lessonId:string)=>void}=$props();
let search=$state(''),filter=$state('all'),adoptTarget=$state<AdoptTarget>(null);
const slotFor=(lesson:Lesson)=>s.slots.find(slot=>slot.id===lesson.slot);
const belongsToStudent=(lesson:Lesson,student:Student)=>lesson.studentId===student.id||(!lesson.studentId&&lesson.name===student.name);
const allocationDate=(lesson:Lesson)=>lesson.originalDate||slotFor(lesson)?.date||'';
function lessonsFor(student:Student){return s.lessons.filter(lesson=>belongsToStudent(lesson,student)&&slotFor(lesson)?.room===room&&allocationDate(lesson).startsWith(month))}
function transferInfo(student:Student){return s.lessons.filter(lesson=>belongsToStudent(lesson,student)&&slotFor(lesson)?.room===room).flatMap(lesson=>{const actual=slotFor(lesson)?.date||'',original=lesson.originalDate||actual;if(!actual||!original||actual.slice(0,7)===original.slice(0,7)||!actual.startsWith(month)&&!original.startsWith(month))return[];return[{lesson,actual,original,direction:original.startsWith(month)?'outgoing':'incoming'}]})}
const shortDate=(value:string)=>`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`;
const dateLabel=(value:string)=>value?new Date(value+'T12:00:00+09:00').toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}):'';
function slotWish(slot:Slot|undefined,priority:number):Wish{return slot?{priority,slotId:slot.id,date:slot.date,start:slot.start,end:slot.end}:{priority}}
function requestView(lesson:Lesson):RequestView{
 const text=(lesson.request||'').replace(/^\*\*\d{1,2}\/\d{1,2}\*\*/,'').trim(),parts=text.split('｜').filter(Boolean);
 const kind=lesson.requestData?.kind||parts.find(part=>['欠席','振替希望','時間変更','その他'].includes(part))||'変更希望';
 const reason=lesson.requestData?.reason||parts.find(part=>part.startsWith('理由：'))?.slice(3)||'理由なし';
 const message=lesson.requestData?.message||parts.filter(part=>!part.startsWith('理由：')&&!/^第[123]希望：/.test(part)&&part!==kind).join('｜');
 let wishes:Wish[]=[];
 if(lesson.requestData?.preferredSlots?.length){wishes=lesson.requestData.preferredSlots.map((id,index)=>id==='later'?{priority:index+1,later:true}:slotWish(s.slots.find(slot=>slot.id===id),index+1))}
 else {for(const part of parts){const match=part.match(/^第([123])希望：(\d{4}-\d{2}-\d{2}) ([0-9:]+)[–-]([0-9:]+)$/);if(match){const [,priority,date,start,end]=match,slot=s.slots.find(item=>item.room===room&&item.date===date&&item.start===start&&item.end===end);wishes.push(slot?slotWish(slot,Number(priority)):{priority:Number(priority),date,start,end})}else {const later=part.match(/^第([123])希望：来月以降で調整$/);if(later)wishes.push({priority:Number(later[1]),later:true})}}}
 return {lesson,date:allocationDate(lesson),kind,reason,message,wishes};
}
const allRows=$derived((s.students||[]).filter(student=>student.room===room&&statusAt(student,month)==='active').map(student=>{const lessons=lessonsFor(student),placed=lessons.length,absent=lessons.filter(lesson=>lesson.absent).length,target=student.monthlyLessons||4,transfers=transferInfo(student),requests=lessons.filter(lesson=>!!lesson.request).map(requestView);return {student,placed,absent,target,transfers,requests,difference:placed-target}}).sort((a,b)=>a.difference-b.difference||a.student.name.localeCompare(b.student.name,'ja')));
const rows=$derived(allRows.filter(row=>row.student.name.includes(search)&&(filter==='all'||filter==='complete'&&row.difference===0||filter==='incomplete'&&row.difference!==0)));
const complete=$derived(allRows.filter(row=>row.difference===0).length),shortage=$derived(allRows.filter(row=>row.difference<0).length),excess=$derived(allRows.filter(row=>row.difference>0).length),requesting=$derived(allRows.filter(row=>row.requests.length).length);
function confirmAdopt(){if(adoptTarget?.wish.slotId){onAdopt(adoptTarget.lesson.id,adoptTarget.wish.slotId,adoptTarget.wish.priority);adoptTarget=null}}
</script>
<div class="placement-toolbar"><div class="field">対象月<CalendarPicker mode="month" label="配置を確認する月" value={month} onchange={onMonth}/></div><div class="app-inline"><Search size={17}/><Input aria-label="生徒名で検索" placeholder="生徒名で検索" bind:value={search}/></div><Picker label="配置状況で絞り込み" bind:value={filter} items={[{value:'incomplete',label:'不足・超過のみ'},{value:'complete',label:'配置完了のみ'},{value:'all',label:'すべて'}]}/><Button variant="outline" onclick={onSchedule}>月間予定を開く</Button></div>
<div class="placement-summary"><div><span>対象生徒</span><strong>{allRows.length}</strong></div><div class="complete"><span>配置完了</span><strong>{complete}</strong></div><div class:attention={shortage>0}><span>不足</span><strong>{shortage}</strong></div><div class:attention={excess>0}><span>超過</span><strong>{excess}</strong></div><div class:attention={requesting>0}><span>変更希望あり</span><strong>{requesting}</strong></div></div>
<AdminPanel title={`${Number(month.slice(5))}月の配置状況`} description="振替後も元の契約月に含めて、欠席を含む授業予定を契約回数と照合します。">
<div class="placement-table"><Table.Root><Table.Header><Table.Row><Table.Head>生徒</Table.Head><Table.Head>契約</Table.Head><Table.Head>配置済み</Table.Head><Table.Head>保護者からの変更希望</Table.Head><Table.Head>月跨ぎ振替</Table.Head><Table.Head>状況</Table.Head><Table.Head>操作</Table.Head></Table.Row></Table.Header><Table.Body>{#each rows as row (row.student.id)}<Table.Row><Table.Cell><strong>{row.student.name}</strong></Table.Cell><Table.Cell>月{row.target}回</Table.Cell><Table.Cell><strong>{row.placed}回</strong>{#if row.absent}<small class="student-period">うち欠席 {row.absent}回</small>{/if}</Table.Cell><Table.Cell>{#each row.requests as request}<section class="placement-request-card"><div class="request-heading"><div><strong>{dateLabel(request.date)}の授業</strong><span>{request.kind}</span></div><small>理由：{request.reason}</small></div>{#if request.wishes.length}<div class="request-wishes">{#each request.wishes as wish}<div class="request-wish"><span class="wish-priority">第{wish.priority}希望</span>{#if wish.later}<strong>来月以降で調整</strong>{:else}<strong>{dateLabel(wish.date||'')}<small>{wish.start}–{wish.end}</small></strong>{#if wish.slotId}<Button size="sm" variant="outline" onclick={()=>adoptTarget={lesson:request.lesson,wish}}>この枠を採用</Button>{:else}<Badge variant="secondary">現在は選択不可</Badge>{/if}{/if}</div>{/each}</div>{/if}{#if request.message}<p class="request-message">{request.message}</p>{/if}{#if request.kind!=='欠席'}<Button size="sm" variant="outline" onclick={()=>onReject(request.lesson.id)}>振替希望を拒否して元に戻す</Button>{/if}</section>{:else}<span class="muted">なし</span>{/each}</Table.Cell><Table.Cell>{#each row.transfers as transfer}<span class:incoming={transfer.direction==='incoming'} class="placement-transfer"><strong>{shortDate(transfer.original)} → {shortDate(transfer.actual)}</strong><small>{transfer.direction==='outgoing'?`${Number(transfer.actual.slice(5,7))}月へ振替`:`${Number(transfer.original.slice(5,7))}月分`}</small></span>{:else}<span class="muted">なし</span>{/each}</Table.Cell><Table.Cell>{#if row.difference===0}<Badge variant="outline" class="placement-ok"><Check/>配置完了</Badge>{:else if row.difference<0}<Badge variant="destructive"><TriangleAlert/>{Math.abs(row.difference)}回不足</Badge>{:else}<Badge variant="secondary"><TriangleAlert/>{row.difference}回超過</Badge>{/if}</Table.Cell><Table.Cell><Button size="sm" variant="ghost" onclick={()=>onStudent(row.student.name)}>生徒情報</Button></Table.Cell></Table.Row>{:else}<Table.Row><Table.Cell colspan={7}>{filter==='incomplete'?'不足・超過の生徒はいません。':'該当する生徒はいません。'}</Table.Cell></Table.Row>{/each}</Table.Body></Table.Root></div>
</AdminPanel>
<Dialog.Root bind:open={()=>!!adoptTarget,(open:boolean)=>{if(!open)adoptTarget=null}}><Dialog.Content><Dialog.Header><Dialog.Title>この希望枠を採用しますか？</Dialog.Title><Dialog.Description>{adoptTarget?.lesson.name}さんの授業を第{adoptTarget?.wish.priority}希望へ移動します。</Dialog.Description></Dialog.Header>{#if adoptTarget}<Dialog.Body><div class="adopt-summary"><span>元の授業</span><strong>{dateLabel(allocationDate(adoptTarget.lesson))}</strong><span>採用する枠</span><strong>{dateLabel(adoptTarget.wish.date||'')} {adoptTarget.wish.start}–{adoptTarget.wish.end}</strong></div><p class="footnote">担当スタッフは未定に戻ります。右上の「変更を保存」を押すと確定します。</p></Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>adoptTarget=null}>キャンセル</Button><Button onclick={confirmAdopt}>第{adoptTarget.wish.priority}希望を採用</Button></Dialog.Footer>{/if}</Dialog.Content></Dialog.Root>

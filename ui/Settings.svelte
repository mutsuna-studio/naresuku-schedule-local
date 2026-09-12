<script lang="ts">
import {tick} from 'svelte';
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import {Textarea} from '@mutsuna/ui/textarea';
import {Switch} from '@mutsuna/ui/switch';
import {AdminPanel} from '@mutsuna/ui/admin-layout';
import TimePicker from '@mutsuna/ui/time-picker/time-picker.svelte';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import {showErrorToast,showSuccessToast} from '@mutsuna/ui/sonner';
import {Plus,Trash2,Clock3,ArrowUp,ArrowDown} from '@lucide/svelte';
import Picker from './Picker.svelte';
import type {State,SettingsData,CampusSchedule} from '../lib/scheduler';
import {lineSnippets,validLineSnippets} from '../lib/line-snippets';
import {lineEmojis,validLineEmoji} from '../lib/line-emojis';
import {curriculumUsage,replaceCurriculum} from '../lib/curriculum';

let {roomAdmin=false,state:s,room,onChange}:{roomAdmin?:boolean;state:State;room:string;onChange:(s:State,text:string)=>void}=$props();
function initialSettings(){return structuredClone(s.settings!)}
let draft=$state<SettingsData>(initialSettings());
draft.curriculumAbbreviations??={};
let visibleAccountsText=$state((draft.lineVisibleAccounts||[]).join('\n'));
let snippets=$state(lineSnippets(draft.lineSnippets));
const snippetVariables=['挨拶','今月','先月','来月','今年','去年','来年'];
async function insertSnippetVariable(id:string,key:string){
 const item=snippets.find(item=>item.id===id),input=document.getElementById('snippet-body-'+id) as HTMLTextAreaElement|null;if(!item||!input)return;
 const token='{'+key+'}',start=input.selectionStart,end=input.selectionEnd;
 if(item.body.length-(end-start)+token.length>2000){showErrorToast('本文は2,000文字以内にしてください');return}
 item.body=item.body.slice(0,start)+token+item.body.slice(end);await tick();input.focus();input.setSelectionRange(start+token.length,start+token.length);
}
function addSnippet(){if(snippets.length<20)snippets=[...snippets,{id:crypto.randomUUID(),title:'',body:''}]}
function moveSnippet(index:number,offset:number){const target=index+offset;if(target<0||target>=snippets.length)return;[snippets[index],snippets[target]]=[snippets[target],snippets[index]]}
let emoji=$state('');
function addEmoji(){const value=emoji.trim();const list=lineEmojis(draft.lineEmojis);if(!validLineEmoji(value)||list.includes(value)||list.length>=12){showErrorToast('絵文字を1つ入力してください（重複なし・最大12個）');return}draft.lineEmojis=[...list,value];emoji=''}
function moveEmoji(index:number,offset:number){const list=lineEmojis(draft.lineEmojis);const target=index+offset;if(target<0||target>=list.length)return;[list[index],list[target]]=[list[target],list[index]];draft.lineEmojis=list}
let curriculum=$state(''),campus=$state('');
let pendingCurriculum=$state(''),replacement=$state('');
const days=[{value:1,label:'月曜日'},{value:2,label:'火曜日'},{value:3,label:'水曜日'},{value:4,label:'木曜日'},{value:5,label:'金曜日'},{value:6,label:'土曜日'},{value:0,label:'日曜日'}];
const schedules=$derived(days.map(day=>({day,schedule:draft.schedules.find(x=>x.room===room&&x.weekday===day.value)!})));
function addCurriculum(){const value=curriculum.trim();if(!value||draft.curricula.includes(value)){showErrorToast('重複しないカリキュラム名を入力してください');return}draft.curricula=[...draft.curricula,value];curriculum=''}
function usage(value:string){return curriculumUsage(s,value)}
function removeCurriculum(value:string){const used=usage(value);if(Object.values(used).some(Boolean)){const choices=draft.curricula.filter(x=>x!==value);if(!choices.length){showErrorToast('置換先となるカリキュラムを先に追加してください');return}pendingCurriculum=value;replacement=choices[0];return}draft.curricula=draft.curricula.filter(x=>x!==value);delete draft.curriculumAbbreviations?.[value]}
function replaceAndRemove(){if(!pendingCurriculum||!replacement||pendingCurriculum===replacement){showErrorToast('置換先のカリキュラムを選択してください');return}const from=pendingCurriculum,to=replacement;draft.curricula=draft.curricula.filter(x=>x!==from);delete draft.curriculumAbbreviations?.[from];const next=replaceCurriculum(s,from,to,draft.curricula);next.settings=structuredClone($state.snapshot(draft));onChange(next,`${from}を${to}へ置換して削除`);pendingCurriculum='';replacement='';showSuccessToast(`${from}を${to}へ置換しました。右上の「変更を保存」で確定してください`)}
function addCampus(){const value=campus.trim();if(!value||draft.campuses.includes(value)){showErrorToast('重複しない教室名を入力してください');return}draft.campuses=[...draft.campuses,value];draft.schedules=[...draft.schedules,...days.map(day=>({room:value,weekday:day.value,periods:[]}))];draft.closeOnHolidays={...draft.closeOnHolidays,[value]:true};campus=''}
function removeCampus(value:string){if(s.slots.some(x=>x.room===value)||(s.students||[]).some(x=>x.room===value)){showErrorToast('授業枠または生徒が登録されている教室は削除できません');return}draft.campuses=draft.campuses.filter(x=>x!==value);draft.schedules=draft.schedules.filter(x=>x.room!==value);if(draft.closeOnHolidays)delete draft.closeOnHolidays[value]}
function setCloseOnHolidays(value:boolean){draft.closeOnHolidays={...draft.closeOnHolidays,[room]:value}}
function addPeriod(schedule:CampusSchedule){insertPeriod(schedule,schedule.periods.length)}
function insertPeriod(schedule:CampusSchedule,index:number){const previous=schedule.periods[index-1],next=schedule.periods[index];let start='09:00',end='10:30';if(previous){start=addMinutes(previous.end,15);end=addMinutes(start,90)}else if(next){end=addMinutes(next.start,-15);start=addMinutes(end,-90)}if(!start||!end){showErrorToast('同じ日の範囲に90分のコマを追加できません');return}schedule.periods.splice(index,0,{id:crypto.randomUUID(),order:index+1,start,end});schedule.periods.forEach((p,i)=>p.order=i+1)}
function changeStart(period:CampusSchedule['periods'][number],value:string){const end=addMinutes(value,90);if(!end){showErrorToast('終了時刻が翌日になる開始時刻は選べません');return}period.start=value;period.end=end}

function movePeriod(schedule:CampusSchedule,index:number,offset:number){const target=index+offset;if(target<0||target>=schedule.periods.length)return;const [period]=schedule.periods.splice(index,1);schedule.periods.splice(target,0,period);schedule.periods.forEach((p,i)=>p.order=i+1)}
function removePeriod(schedule:CampusSchedule,index:number){schedule.periods.splice(index,1);schedule.periods.forEach((p,i)=>p.order=i+1)}
function addMinutes(value:string,minutes:number){const [h,m]=value.split(':').map(Number),total=h*60+m+minutes;if(!Number.isFinite(total)||total<0||total>=1440)return '';return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')}
function apply(){if(!roomAdmin){const ids=visibleAccountsText.split(/\r?\n/).map(value=>value.trim()).filter(Boolean).map(value=>{if(/^U[0-9a-f]{32}$/.test(value))return value;try{const url=new URL(value);if(url.origin==='https://chat.line.biz')return /^\/(U[0-9a-f]{32})(?:\/|$)/.exec(url.pathname)?.[1]||''}catch{}return ''});if(ids.some(id=>!id)||ids.length>100){showErrorToast('表示対象の公式LINE IDまたはchat.line.bizのURLを確認してください');return}draft.lineVisibleAccounts=[...new Set(ids)];if(!validLineSnippets(snippets)){showErrorToast('定型文の名前と本文を入力してください（名前80文字・本文2,000文字以内）');return}draft.lineSnippets=$state.snapshot(snippets)}for(const schedule of draft.schedules){const sorted=[...schedule.periods].sort((a,b)=>a.start.localeCompare(b.start));for(let i=0;i<sorted.length;i++){if(!sorted[i].start||!sorted[i].end||sorted[i].start>=sorted[i].end){showErrorToast(`${schedule.room}の${days.find(x=>x.value===schedule.weekday)?.label}に正しくない時間があります`);return}if(i&&sorted[i-1].end>sorted[i].start){showErrorToast(`${schedule.room}の${days.find(x=>x.value===schedule.weekday)?.label}で時間が重複しています`);return}}schedule.periods=sorted.map((p,i)=>({...p,order:i+1}))}const next=structuredClone(s);next.settings=structuredClone($state.snapshot(draft));onChange(next,'設定を更新');showSuccessToast('設定を反映しました。右上の「変更を保存」で確定してください')}
</script>
<div class="settings-workspace">
 <div class="settings-page-actions"><p>編集後に「設定を反映」を押し、画面上部の「変更を保存」で確定してください。</p><Button onclick={apply}>設定を反映</Button></div>
<AdminPanel title={`${room}の授業開催リスト`} class="schedule-settings">
 <p class="settings-help">曜日ごとに開催するコマと時間を設定します。開催しない曜日はコマを空にしてください。</p>
 <label class="holiday-setting"><span><strong>祝日は授業を開催しない</strong><small>開催曜日が祝日の場合は、その月の第5週へ振り替えます。</small></span><Switch checked={draft.closeOnHolidays?.[room]??true} onCheckedChange={setCloseOnHolidays}/></label>
 <div class="weekday-settings">{#each schedules as {day,schedule}}<section class="weekday-card"><div class="weekday-title"><strong>{day.label}</strong><div class="weekday-tools"><small>{schedule.periods.length?`${schedule.periods.length}コマ`:'開催なし'}</small><Button variant="ghost" size="sm" aria-label={`${day.label}にコマを追加`} onclick={()=>addPeriod(schedule)}>＋ 追加</Button></div></div><div class="period-list">{#each schedule.periods as period,i (period.id)}<div class="period-row"><Button class="insert-period" variant="ghost" size="sm" onclick={()=>insertPeriod(schedule,i)} aria-label={`${day.label}${i+1}コマ目の前に追加`} title={`${i+1}コマ目の前に追加`}><Plus size={13}/></Button><span class="period-number"><Clock3 size={14}/>{i+1}</span><TimePicker bind:value={()=>period.start,(value:string)=>changeStart(period,value)} minuteStep={5}/><span class="time-separator">〜</span><TimePicker bind:value={period.end} minuteStep={5}/><div class="period-actions"><Button variant="ghost" size="icon-sm" disabled={i===0} aria-label={`${day.label}${i+1}コマ目を上へ`} onclick={()=>movePeriod(schedule,i,-1)}><ArrowUp size={14}/></Button><Button variant="ghost" size="icon-sm" disabled={i===schedule.periods.length-1} aria-label={`${day.label}${i+1}コマ目を下へ`} onclick={()=>movePeriod(schedule,i,1)}><ArrowDown size={14}/></Button><Button variant="ghost" size="icon-sm" aria-label={`${day.label}${i+1}コマ目を削除`} onclick={()=>removePeriod(schedule,i)}><Trash2 size={14}/></Button></div></div>{/each}</div></section>{/each}</div>

</AdminPanel>



{#if !roomAdmin}<div class="settings-grid">
 <AdminPanel title="カリキュラムリスト">
  <div class="settings-add"><Input aria-label="カリキュラム名" bind:value={curriculum} placeholder="例：Scratch"/><Button onclick={addCurriculum}><Plus size={16}/>追加</Button></div>
  <p class="settings-help">表示略称は2文字以内で設定できます。空欄の場合は正式名を表示します。</p><div class="settings-list curriculum-settings-list">{#each draft.curricula as item}<div><span>{item}</span><Input aria-label={`${item}の表示略称`} placeholder="略称" maxlength={2} value={draft.curriculumAbbreviations?.[item]||''} oninput={event=>{draft.curriculumAbbreviations={...draft.curriculumAbbreviations,[item]:event.currentTarget.value.trim()}}}/><Button variant="ghost" size="icon-sm" aria-label={`${item}を削除`} onclick={()=>removeCurriculum(item)}><Trash2 size={15}/></Button></div>{/each}</div>
 </AdminPanel>
 <AdminPanel title="教室リスト">
  <div class="settings-add"><Input aria-label="教室名" bind:value={campus} placeholder="例：本社校"/><Button onclick={addCampus}><Plus size={16}/>追加</Button></div>
  <div class="settings-list">{#each draft.campuses as item}<div class:current={item===room}><span>{item}</span>{#if item===room}<small>選択中</small>{/if}<Button variant="ghost" size="icon-sm" aria-label={`${item}を削除`} onclick={()=>removeCampus(item)}><Trash2 size={15}/></Button></div>{/each}</div>
 </AdminPanel>
</div>
{/if}<p>外部連携はローカル検証の対象外です。</p>
</div>

<Dialog.Root bind:open={()=>!!pendingCurriculum,(open:boolean)=>{if(!open){pendingCurriculum='';replacement=''}}}>
 <Dialog.Content>
  <Dialog.Header><Dialog.Title>カリキュラムを置換して削除</Dialog.Title><Dialog.Description>「{pendingCurriculum}」を使用しているデータを別のカリキュラムへ変更してから削除します。</Dialog.Description></Dialog.Header>
  {#if pendingCurriculum}{@const used=usage(pendingCurriculum)}<Dialog.Body><div class="replacement-summary"><div><strong>{used.students}</strong><span>生徒</span></div><div><strong>{used.preferences}</strong><span>希望スケジュール</span></div><div><strong>{used.lessons}</strong><span>授業</span></div><div><strong>{used.teachers}</strong><span>スタッフ</span></div></div><div class="field">置換先<Picker label="置換先のカリキュラム" bind:value={replacement} items={draft.curricula.filter(x=>x!==pendingCurriculum).map(value=>({value,label:value}))}/></div><p class="settings-help">置換後も、右上の「変更を保存」を押すまでは確定されません。</p></Dialog.Body><Dialog.Footer><Button variant="outline" onclick={()=>pendingCurriculum=''}>キャンセル</Button><Button onclick={replaceAndRemove}>置換して削除</Button></Dialog.Footer>{/if}
 </Dialog.Content>
</Dialog.Root>

<style>



.settings-workspace{display:grid;gap:20px;min-width:0;container-type:inline-size;container-name:settings-page}
.settings-page-actions{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.settings-page-actions p{font-size:12px;color:var(--muted-foreground)}
.settings-page-actions :global(button){flex-shrink:0}



.settings-grid{align-items:start}
.settings-list>div{gap:8px}
.settings-list span{min-width:0;overflow-wrap:anywhere}
.curriculum-settings-list :global(input){width:72px;flex:0 0 72px}

.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.settings-add{display:flex;gap:.5rem;margin-bottom:1rem}.settings-add :global(input){min-width:0}.settings-list{display:grid;gap:.4rem}.settings-list>div{display:flex;align-items:center;min-height:2.5rem;padding:.35rem .4rem .35rem .75rem;border:1px solid var(--border);border-radius:.65rem;background:var(--background)}.settings-list span{flex:1;font-weight:600}.settings-list small{color:var(--muted-foreground);margin-right:.4rem}.settings-list .current{border-color:color-mix(in oklch,var(--primary) 45%,var(--border));background:color-mix(in oklch,var(--primary) 7%,var(--background))}.settings-help{color:var(--muted-foreground);margin:0 0 1rem}.weekday-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.weekday-card{padding:.75rem;border:1px solid var(--border);border-radius:.8rem;background:var(--background)}.weekday-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem}.weekday-title small{color:var(--muted-foreground)}.weekday-tools{display:flex;align-items:center;gap:.5rem}.period-list{display:grid;gap:.65rem}.period-row{position:relative;display:grid;grid-template-columns:2.4rem minmax(7rem,1fr) auto minmax(7rem,1fr) auto;gap:.4rem;align-items:center}.period-number{display:flex;align-items:center;gap:.3rem;font-weight:700;color:var(--muted-foreground)}.time-separator{color:var(--muted-foreground)}.period-actions{display:flex}:global(.insert-period){position:absolute;z-index:2;top:-12px;left:50%;transform:translateX(-50%);width:24px!important;min-width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid var(--border)!important;background:var(--background)!important;color:var(--muted-foreground)!important;opacity:0;pointer-events:none}.period-row:hover :global(.insert-period),.period-row:focus-within :global(.insert-period),:global(.insert-period:focus-visible){opacity:1;pointer-events:auto}@media(hover:none){:global(.insert-period){opacity:1;pointer-events:auto}}.replacement-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1rem}.replacement-summary>div{display:grid;place-items:center;padding:.8rem;border:1px solid var(--border);border-radius:.7rem;background:var(--muted)}.replacement-summary strong{font-size:1.35rem}.replacement-summary span{font-size:.75rem;color:var(--muted-foreground)}.replacement-summary+.field{margin-bottom:1rem}@media(max-width:900px){.weekday-settings{grid-template-columns:1fr}}@media(max-width:780px){.settings-grid{grid-template-columns:1fr}.period-row{grid-template-columns:2rem minmax(6rem,1fr) auto minmax(6rem,1fr)}.period-actions{grid-column:2/-1;justify-content:flex-end}.time-separator{display:block}}
.holiday-setting{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem 0 1rem;border-bottom:1px solid var(--border);margin-bottom:1rem}.holiday-setting>span{display:grid;gap:.2rem}.holiday-setting small{color:var(--muted-foreground);font-size:.8rem}
.replacement-summary{grid-template-columns:repeat(4,1fr)}
@media(max-width:780px){.replacement-summary{grid-template-columns:repeat(2,1fr)}}
@container settings-page (max-width:1000px){.weekday-settings{grid-template-columns:minmax(0,1fr)}}
@container settings-page (max-width:680px){
 .settings-grid{grid-template-columns:minmax(0,1fr)}
 .settings-page-actions{align-items:flex-start;gap:8px}
 .period-row{grid-template-columns:24px minmax(0,1fr) auto minmax(0,1fr);gap:4px}
 .period-actions{grid-column:2/-1;justify-content:flex-end}
 .period-row :global(button){min-width:0}
 .holiday-setting{gap:8px}
}

</style>

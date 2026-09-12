<script lang="ts">
import {onMount} from 'svelte';
import {ChevronRight} from '@lucide/svelte';
import {Button} from '@mutsuna/ui/button';
import * as Dialog from '@mutsuna/ui/responsive-dialog';
import type {State} from '../lib/scheduler';
import {followingMonth,nextMonthAction} from '../lib/next-month-action';
import SlackNotifications from './SlackNotifications.svelte';
let {state:s,room,role,teacher,today,revision,disabled=false,onCreate,onInput,onGuard}:{state:State;room:string;role:'admin'|'staff';teacher:string;today:string;revision:number;disabled?:boolean;onCreate:(month:string)=>void;onInput:(month:string)=>void;onGuard:(action:()=>void)=>void}=$props();
const month=$derived(followingMonth(today));
let info=$state<{history:{kind:string;status:string;target?:string}[];channel:string}|null>(null);
let refresh=$state(0),createOpen=$state(false);
let notifications=$state<ReturnType<typeof SlackNotifications>>();
$effect(()=>{
 const campus=room,m=month,v=revision,r=refresh,admin=role==='admin';
 info=null;
 if(!admin||!campus)return;
 const controller=new AbortController();
 fetch('/api/slack-notifications?'+new URLSearchParams({room:campus,month:m}),{signal:controller.signal}).then(async response=>{if(!response.ok)return;const result=await response.json();if(!controller.signal.aborted)info=result}).catch(()=>{});
 return ()=>controller.abort();
});
onMount(()=>{const update=()=>refresh++;window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update)});
const action=$derived(nextMonthAction(s,room,month,role,teacher,info?.history??null,info?.channel));
function open(){if(!action)return;const kind=action.kind;onGuard(()=>{if(kind==='create')createOpen=true;else if(kind==='input')onInput(month);else notifications?.launch(kind==='reminder'?'reminder':'request')})}
</script>
{#if action}<button class="next-month-badge" {disabled} onclick={open} aria-label={room+'・'+action.label} title={room+'・翌月の準備'}>{action.label}<ChevronRight size={13}/></button>{/if}
{#if role==='admin'}
<SlackNotifications bind:this={notifications} {room} {month} hideTrigger onUpdated={()=>refresh++}/>
<Dialog.Root bind:open={createOpen}><Dialog.Content><Dialog.Header><Dialog.Title>{Number(month.slice(5,7))}月のコマを作成</Dialog.Title><Dialog.Description>{room}の開催設定からシフト入力用のコマを作成します。作成後に「変更を保存」を押してください。</Dialog.Description></Dialog.Header><Dialog.Footer><Button variant="outline" onclick={()=>createOpen=false}>キャンセル</Button><Button onclick={()=>{createOpen=false;onCreate(month)}}>コマを作成</Button></Dialog.Footer></Dialog.Content></Dialog.Root>
{/if}
<style>
.next-month-badge{display:inline-flex;align-items:center;justify-content:center;gap:2px;min-height:36px;padding:4px 9px;border:1px solid color-mix(in srgb,var(--primary) 28%,var(--border));border-radius:999px;background:color-mix(in srgb,var(--primary) 8%,var(--background));color:var(--foreground);font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;flex-shrink:0}.next-month-badge:focus-visible{outline:2px solid var(--primary);outline-offset:2px}.next-month-badge:disabled{opacity:.5;cursor:default}@media(max-width:700px){.next-month-badge{min-height:40px;padding-inline:8px}}
</style>

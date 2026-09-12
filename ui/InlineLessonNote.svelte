<script lang="ts">
import {tick,untrack} from 'svelte';
let {note,onSave,blocked=$bindable(false)}:{note:string;onSave:(note:string,previous:string)=>Promise<void>;blocked?:boolean}=$props();
let draft=$state(untrack(()=>note)),baseline=$state(untrack(()=>note)),busy=$state(false),error=$state('');
let field:HTMLTextAreaElement;
$effect(()=>{blocked=busy||draft!==baseline});
function resize(){if(field){field.style.height='auto';field.style.height=`${field.scrollHeight}px`}}
$effect(()=>{draft;tick().then(resize)});
let pending:Promise<void>|null=null;
async function save(){if(pending)return pending;if(draft===baseline)return;busy=true;error='';const value=draft;pending=(async()=>{try{await onSave(value,baseline);baseline=value}catch(e){error=(e as Error).message}finally{busy=false;pending=null}})();return pending}
export async function flush(){await save();return draft===baseline}
function revert(){if(busy)return;draft=baseline;error=''}
</script>
<div class="inline-note">
 <textarea bind:this={field} bind:value={draft} aria-label="授業メモ" placeholder="メモを追加…" rows="1" maxlength={5000} readonly={busy} onblur={save} onkeydown={event=>{if(event.key==='Escape'){event.stopPropagation();if(!busy)revert()}if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();field.blur()}}}></textarea>
 {#if busy}<small role="status">保存中…</small>{/if}
 {#if error}<div class="note-error" role="alert">{error}<div><button onclick={save}>再試行</button><button disabled={busy} onclick={revert}>入力を戻す</button></div></div>{/if}
</div>
<style>
.inline-note{margin-top:12px}textarea{display:block;box-sizing:border-box;width:100%;min-height:24px;max-height:140px;resize:none;border:0;border-radius:3px;background:transparent;color:var(--foreground);padding:0;font:inherit;font-size:14px;line-height:1.7;overflow-y:auto}textarea::placeholder{color:var(--muted-foreground)}textarea:hover{background:var(--muted)}textarea:focus{outline:1px solid var(--border);outline-offset:3px}small{font-size:11px;color:var(--muted-foreground)}.note-error{font-size:12px;color:var(--destructive)}.note-error button{margin:4px 12px 0 0;text-decoration:underline}
</style>

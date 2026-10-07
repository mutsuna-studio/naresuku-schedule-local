<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {tick,untrack} from 'svelte';
import {EditableText} from '@mutsuna/ui/editable-text';
let {note,onSave,blocked=$bindable(false),label='授業メモ'}:{note:string;onSave:(note:string,previous:string)=>Promise<void>;blocked?:boolean;label?:string}=$props();
let draft=$state(untrack(()=>note)),baseline=$state(untrack(()=>note)),busy=$state(false),error=$state('');
let container:HTMLDivElement;
let editingDraft=$state(untrack(()=>note));
$effect(()=>{blocked=busy||editingDraft!==baseline||draft!==baseline});
let pending:Promise<void>|null=null;
async function save(){if(pending)return pending;if(draft===baseline)return;busy=true;error='';const value=draft;pending=(async()=>{try{await onSave(value,baseline);baseline=value}catch(e){error=(e as Error).message}finally{busy=false;pending=null}})();return pending}
export async function flush(){container?.querySelector('textarea')?.blur();await tick();await save();return draft===baseline}
function revert(){if(busy)return;draft=baseline;editingDraft=baseline;error=''}
</script>
<div class="inline-note" bind:this={container} oninput={event=>{if(event.target instanceof HTMLTextAreaElement)editingDraft=event.target.value}}>
 <EditableText bind:value={draft} multiline aria-label={label} placeholder="メモを追加…" disabled={busy} textareaProps={{maxlength:5000}} onCommit={()=>{editingDraft=draft;void save()}} onCancel={()=>editingDraft=draft}/>
 {#if busy}<small role="status">保存中…</small>{/if}
 {#if error}<div class="note-error" role="alert">{error}<div><Button variant="ghost" class="h-auto whitespace-normal" onclick={save}>再試行</Button><Button variant="ghost" class="h-auto whitespace-normal" disabled={busy} onclick={revert}>入力を戻す</Button></div></div>{/if}
</div>
<style>
.inline-note{margin-top:12px;min-width:0;width:100%}.inline-note :global(textarea[data-slot="editable-text-textarea"]){width:100%!important;max-width:100%;box-sizing:border-box}small{font-size:11px;color:var(--muted-foreground)}.note-error{font-size:12px;color:var(--destructive)}.note-error :global(button){margin:4px 12px 0 0;text-decoration:underline}
</style>

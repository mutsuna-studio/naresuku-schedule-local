<script lang="ts">
import {describeConflict,type Conflict,type SaveConflict} from '../lib/schedule-merge';
let {conflict,comparison,choice,disabled=false,onChoose}:{conflict:Conflict;comparison:SaveConflict;choice?:'local'|'remote';disabled?:boolean;onChoose:(side:'local'|'remote')=>void}=$props();
const details=$derived(describeConflict(conflict,comparison));
const sides=['local','remote'] as const;
</script>

<fieldset class="comparison">
 <legend>{details.title}</legend>
 {#if details.context}<p class="context">{details.context}</p>{/if}
 {#if conflict.path[2]==='$schedule'}<p class="context">担当・欠席・振替・保護者申請は関連するため、授業予定をまとめて選びます。</p>{/if}
 <div class="choices">
  {#each sides as side}
   <label class="choice" class:selected={choice===side}>
    <span class="choice-heading"><input type="radio" name={conflict.id} value={side} checked={choice===side} {disabled} onchange={()=>onChoose(side)}/><strong>{side==='local'?'自分の編集を使う':'最新の保存内容を使う'}</strong></span>
    <span class="changes">
     {#each details.rows as row}
      {@const changed=side==='local'?row.localChanged:row.remoteChanged}
      <span class="change-row">
       <span class="field-name">{row.label}</span>
       {#if changed}
        <span class="before"><span class="sr-only">編集前：</span>{row.base}</span>
        <span class="after"><span aria-hidden="true">→ </span><span class="sr-only">変更後：</span>{row[side]}</span>
       {:else}<span class="unchanged">{row[side]} <small>変更なし</small></span>{/if}
      </span>
     {/each}
    </span>
   </label>
  {/each}
 </div>
</fieldset>

<style>
.comparison{min-width:0;border:1px solid var(--border);border-radius:10px;padding:12px;margin:0 0 20px}
legend{max-width:100%;padding:0 6px;font-weight:600;overflow-wrap:anywhere}
.context{margin:0 0 12px;color:var(--muted-foreground);font-size:13px;overflow-wrap:anywhere}
.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.choice{display:block;min-width:0;border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer}
.choice.selected{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 5%,var(--background))}
.choice:focus-within{outline:2px solid var(--ring);outline-offset:2px}
.choice-heading{display:flex;align-items:center;gap:8px;font-size:14px}
input{accent-color:var(--primary);flex:none}
.changes{display:grid;margin-top:12px;gap:12px}
.change-row{display:grid;gap:3px;font-size:13px;overflow-wrap:anywhere;white-space:pre-wrap}
.field-name{font-weight:600}
.before{color:var(--muted-foreground);font-size:12px}
.after{font-weight:600}
.unchanged{color:var(--muted-foreground)}
.unchanged small{font-size:11px}
@media(max-width:600px){.choices{grid-template-columns:1fr}}
</style>

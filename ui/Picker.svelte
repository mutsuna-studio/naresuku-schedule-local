<script lang="ts">
import * as Select from '@mutsuna/ui/select';
let {value=$bindable(''),items,label='選択',searchable=false,inlineLabel=false,disabled=false,onchange}:{value?:string;items:{value:string;label:string}[];label?:string;searchable?:boolean;inlineLabel?:boolean|string;disabled?:boolean;onchange?:(v:string)=>void}=$props();
const caption=$derived(typeof inlineLabel==='string'?inlineLabel:label);
const selected=$derived(items.find(item=>item.value===value));
function change(v:string){value=v;onchange?.(v)}
</script>
{#snippet pickerLabel()}<span class="text-muted-foreground text-xs">{caption}：</span>{/snippet}
{#if searchable}
<Select.Root {disabled} searchable {value} options={items} ariaLabel={label} placeholder={inlineLabel?'選択してください':label} class={inlineLabel?'w-full min-w-0':undefined} onValueChange={change} leading={inlineLabel?pickerLabel:undefined}/>
{:else}
<Select.Root {disabled} type="single" {value} onValueChange={change}>
  <Select.Trigger class="w-full min-w-0" aria-label={label}>
    <span class="flex min-w-0 items-center gap-1">{#if inlineLabel}<span class="text-muted-foreground shrink-0 text-xs">{caption}：</span>{/if}<span class="truncate" title={selected?.label} class:text-muted-foreground={!selected}>{selected?.label||(inlineLabel?'選択してください':label)}</span></span>
  </Select.Trigger>
  <Select.Content>
    {#each items as item (item.value)}<Select.Item value={item.value}>{item.label}</Select.Item>{/each}
  </Select.Content>
</Select.Root>
{/if}

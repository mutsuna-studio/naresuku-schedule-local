<script lang="ts">
import * as Select from '@mutsuna/ui/select';
let {value=$bindable(''),items,label='選択',searchable=false,onchange}:{value?:string;items:{value:string;label:string}[];label?:string;searchable?:boolean;onchange?:(v:string)=>void}=$props();
const selected=$derived(items.find(item=>item.value===value));
function change(v:string){value=v;onchange?.(v)}
</script>
{#if searchable}
<Select.Root searchable {value} options={items} ariaLabel={label} placeholder={label} onValueChange={change}/>
{:else}
<Select.Root type="single" {value} onValueChange={change}>
  <Select.Trigger class="w-full min-w-0" aria-label={label}>
    <span class:text-muted-foreground={!selected}>{selected?.label||label}</span>
  </Select.Trigger>
  <Select.Content>
    {#each items as item (item.value)}<Select.Item value={item.value}>{item.label}</Select.Item>{/each}
  </Select.Content>
</Select.Root>
{/if}

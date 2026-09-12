<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {Checkbox} from '@mutsuna/ui/checkbox';
import * as Popover from '@mutsuna/ui/popover';
import {UserRoundMinus} from '@lucide/svelte';
let {name,options,onApply}:{name:string;options:{id:string;period:number;start:string;end:string}[];onApply:(slots:string[])=>void}=$props();
const checkboxId=$props.id();
let open=$state(false);
let selected=$state<string[]>([]);
const chosen=$derived(options.filter(slot=>selected.includes(slot.id)));
const all=$derived(options.length>0&&chosen.length===options.length);
const some=$derived(chosen.length>0&&!all);
function setOpen(value:boolean){
 if(value===open)return;
 if(value){selected=[];open=true;return}
 const slots=chosen.map(slot=>slot.id);
 open=false;selected=[];
 if(slots.length)onApply(slots);
}
</script>
<Popover.Root bind:open={()=>open,setOpen}>
 <Popover.Trigger>{#snippet child({props})}<Button {...props} variant="ghost" size="icon" class="unassign-teacher" title={`${name}の担当を解除するコマを選ぶ`} aria-label={`${name}の担当を解除するコマを選ぶ`}><UserRoundMinus size={16}/></Button>{/snippet}</Popover.Trigger>
 <Popover.Content align="start" class="w-60 gap-2">
  <Popover.Header><Popover.Title>担当を解除</Popover.Title></Popover.Header>
  <div class="unassign-options">
   <label for={`${checkboxId}-all`}><Checkbox id={`${checkboxId}-all`} checked={all} indeterminate={some} onCheckedChange={checked=>selected=checked?options.map(slot=>slot.id):[]}/><strong>全コマ</strong></label>
   <div class="unassign-periods">{#each options as slot (slot.id)}<label for={`${checkboxId}-${slot.id}`}><Checkbox id={`${checkboxId}-${slot.id}`} checked={selected.includes(slot.id)} onCheckedChange={checked=>selected=checked?[...selected.filter(id=>id!==slot.id),slot.id]:selected.filter(id=>id!==slot.id)}/><span>{slot.period}コマ目 <span class="unassign-time">{slot.start}–{slot.end}</span></span></label>{/each}</div>
  </div>
 </Popover.Content>
</Popover.Root>

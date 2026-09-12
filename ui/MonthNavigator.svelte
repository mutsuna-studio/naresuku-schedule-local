<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {ChevronLeft,ChevronRight} from '@lucide/svelte';
import CalendarPicker from './CalendarPicker.svelte';
let {value,onchange,label='表示月'}:{value:string;onchange:(value:string)=>void;label?:string}=$props();
function move(offset:number){const date=new Date(value+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);onchange(date.toISOString().slice(0,7))}
</script>
<div class="month-navigator"><Button variant="outline" aria-label="前月" onclick={()=>move(-1)}><ChevronLeft size={16}/></Button><CalendarPicker mode="month" {label} {value} {onchange}/><Button variant="outline" aria-label="翌月" onclick={()=>move(1)}><ChevronRight size={16}/></Button></div>
<style>.month-navigator{display:grid;grid-template-columns:40px minmax(140px,1fr) 40px;gap:6px;max-width:280px}.month-navigator :global(>[data-slot=button]:first-child),.month-navigator :global(>[data-slot=button]:last-child){width:40px;height:40px;padding:0}.month-navigator :global(.calendar-picker){width:100%;height:40px}@media(max-width:680px){.month-navigator{width:100%;max-width:none}}</style>

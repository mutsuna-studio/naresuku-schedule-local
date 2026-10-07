<script lang="ts">
import {Button} from '@mutsuna/ui/button';
import {ButtonGroup} from '@mutsuna/ui/button-group';
import {DatePicker} from '@mutsuna/ui/date-picker';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@mutsuna/ui/tooltip';
import {CalendarClock,ChevronLeft,ChevronRight} from '@lucide/svelte';
let {value,onchange,label='表示月',min,max}:{value:string;onchange:(value:string)=>void;label?:string;min?:string;max?:string}=$props();
const currentMonth=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).slice(0,7);
function move(offset:number){const date=new Date(value+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);onchange(date.toISOString().slice(0,7))}
</script>
<TooltipProvider><ButtonGroup aria-label={`${label}を変更`} class="month-navigator">
 <Tooltip><TooltipTrigger>{#snippet child({props})}<Button {...props} type="button" variant="outline" size="icon" icon={CalendarClock} aria-label="今月へ移動" disabled={value===currentMonth} onclick={()=>onchange(currentMonth)}/>{/snippet}</TooltipTrigger><TooltipContent sideOffset={6}>今月へ移動</TooltipContent></Tooltip>
 <DatePicker {value} onValueChange={onchange} {min} {max} precision="month" ariaLabel={label} showCurrent={false} showIcon={false} class="w-28"/>
 <Button type="button" variant="outline" size="icon" icon={ChevronLeft} aria-label="前月" disabled={!!min&&value<=min} onclick={()=>move(-1)}/>
 <Button type="button" variant="outline" size="icon" icon={ChevronRight} aria-label="翌月" disabled={!!max&&value>=max} onclick={()=>move(1)}/>
</ButtonGroup></TooltipProvider>

<script lang="ts">
import {DatePicker} from '@mutsuna/ui/date-picker';
import {Button} from '@mutsuna/ui/button';
let {value=$bindable(''),mode='date',label='日付を選択',clearable=false,onchange}:{value?:string;mode?:'date'|'month';label?:string;clearable?:boolean;onchange?:(value:string)=>void}=$props();
function clear(){value='';onchange?.('')}
</script>
<DatePicker bind:value precision={mode==='month'?'month':'day'} showWeekday={mode==='date'} ariaLabel={label} placeholder={label} class="calendar-picker" onValueChange={onchange}/>
{#if clearable && value}<Button type="button" size="sm" variant="ghost" class="calendar-picker-clear" onclick={clear}>設定しない</Button>{/if}

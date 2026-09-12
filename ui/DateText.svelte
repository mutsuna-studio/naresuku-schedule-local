<script lang="ts">
import {getCalendarDayColorClass} from '@mutsuna/ui/calendar/calendar-day-color';
import {parseDate} from '@internationalized/date';
let {value,format='short',dayOnly=false,selected=false}:{value:string;format?:'short'|'long';dayOnly?:boolean;selected?:boolean}=$props();
const color=$derived(getCalendarDayColorClass(parseDate(value)));
const weekday=$derived(new Date(value+'T12:00:00Z').getUTCDay());
const text=$derived(dayOnly?String(Number(value.slice(-2))):new Date(value+'T12:00:00Z').toLocaleDateString('ja-JP',{month:format==='long'?'long':'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}));
</script>
<span class={selected?'':color} data-selected={selected?true:undefined} class:calendar-saturday={weekday===6} class:calendar-sunday={weekday===0}>{text}</span>

<script lang="ts">
import Picker from './Picker.svelte';
import type {State} from '../lib/scheduler';
import {configuredPeriods} from '../lib/settings';
let {state,room,weekday,start,end,onchange}:{state:State;room:string;weekday?:number;start:string;end:string;onchange:(start:string,end:string)=>void}=$props();
const value=$derived(start+'|'+end);
const items=$derived.by(()=>{
 const periods=new Map(configuredPeriods(state,room,weekday).map(x=>[x.value,x]));
 if(!state.settings)for(const slot of state.slots.filter(x=>x.room===room)){const value=slot.start+'|'+slot.end;periods.set(value,{value,label:slot.start+'〜'+slot.end});}
 if(start&&end&&!periods.has(value))periods.set(value,{value,label:start+'〜'+end+'（登録中の時間）'});
 return [...periods.values()].sort((a,b)=>a.value.localeCompare(b.value));
});
</script>
<Picker label="授業コマ" {value} {items} onchange={v=>{const [a,b]=v.split('|');if(a&&b)onchange(a,b)}}/>

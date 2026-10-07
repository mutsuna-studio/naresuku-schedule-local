<script lang="ts">
import * as InputGroup from '@mutsuna/ui/input-group';
import Search from '@lucide/svelte/icons/search';
import X from '@lucide/svelte/icons/x';
let {value=$bindable(''),label='検索',placeholder='キーワードを入力',oninput,shortcut}:{value?:string;label?:string;placeholder?:string;oninput?:()=>void;shortcut?:string}=$props();
let input=$state<HTMLInputElement|null>(null);
export function focus(){input?.focus();input?.select()}
function clear(){value='';oninput?.();input?.focus()}
</script>
<InputGroup.Root>
 <InputGroup.Addon align="inline-start"><Search aria-hidden="true"/></InputGroup.Addon>
 <InputGroup.Input bind:ref={input} bind:value aria-label={label} aria-keyshortcuts={shortcut} {placeholder} {oninput}/>
 {#if value}<InputGroup.Addon align="inline-end"><InputGroup.Button type="button" size="icon-xs" aria-label="検索をクリア" onclick={clear}><X aria-hidden="true"/></InputGroup.Button></InputGroup.Addon>{/if}
</InputGroup.Root>

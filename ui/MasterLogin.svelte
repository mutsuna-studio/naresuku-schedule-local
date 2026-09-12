<script lang="ts">
import * as Dialog from '@mutsuna/ui/dialog';
import {Button} from '@mutsuna/ui/button';
import {Input} from '@mutsuna/ui/input';
import {KeyRound,ArrowRight,X} from '@lucide/svelte';
import LoginMark from './LoginMark.svelte';
let {password=$bindable(''),loggingIn,error,onLogin}:{password:string;loggingIn:boolean;error:string;onLogin:()=>void}=$props();
let open=$state(false);
function changeOpen(value:boolean){open=value;if(!value)password=''}
</script>
<Dialog.Root bind:open={()=>open,changeOpen}>
  <Dialog.Trigger class="master-entry"><KeyRound size={13}/><span>その他のログイン方法</span><span class="master-entry-star" aria-hidden="true">✦</span></Dialog.Trigger>
  <Dialog.Content class="master-vault" showCloseButton={false} aria-describedby={undefined}>
    <Dialog.Close class="vault-close" aria-label="パスワードログインを閉じる"><X size={18}/></Dialog.Close>
    <div class="vault-scenery" aria-hidden="true"><div class="vault-grid"></div><div class="vault-border-light"></div></div>
    <div class="vault-content" class:verifying={loggingIn} class:has-error={!!error&&!loggingIn}>
      <div class="vault-optics"><span class="optic-corner top-left" aria-hidden="true"></span><span class="optic-corner top-right" aria-hidden="true"></span><span class="optic-corner bottom-left" aria-hidden="true"></span><span class="optic-corner bottom-right" aria-hidden="true"></span><div class="optic-track" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><LoginMark/><div class="optic-track right" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>
      <Dialog.Title class="sr-only">パスワードログイン</Dialog.Title>
      <form class="vault-form" onsubmit={event=>{event.preventDefault();onLogin()}}>
        <label class="sr-only" for="admin-password">パスワード</label>
        <div class="vault-password"><Input id="admin-password" type="password" autocomplete="current-password" required disabled={loggingIn} bind:value={password} placeholder="パスワードを入力" aria-invalid={!!error&&!loggingIn} aria-describedby={error?'password-error':undefined}/></div>
        {#if error}<p id="password-error" class="vault-error" role="alert">{error}</p>{/if}
        <Button class="vault-submit" type="submit" disabled={!password||loggingIn} loading={loggingIn}>{loggingIn?'確認中…':'ログイン'}{#if !loggingIn}<ArrowRight size={17}/>{/if}</Button>
      </form>
      <div class="vault-index" aria-hidden="true"><span></span>{#each Array(6) as _,i}<i class:primary={i===0||i===5}></i>{/each}<span></span></div>
    </div>
  </Dialog.Content>
</Dialog.Root>

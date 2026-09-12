<script lang="ts">
let {...props}: Record<string, any> = $props();
export function isDirty(){return false}
export function guard(action:()=>void){action()}
</script>
<p role="status">この画面はローカル検証の対象外です。外部サービスには接続しません。</p>

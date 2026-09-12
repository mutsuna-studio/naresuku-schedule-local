<script lang="ts">
import {showErrorToast} from '@mutsuna/ui/sonner';
let {...props}: Record<string, any> = $props();
export function launch(value=''){showErrorToast('ローカル検証では外部通知を送信しません')}
</script>

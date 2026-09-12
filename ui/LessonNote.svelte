<script lang="ts">
import * as Tooltip from '@mutsuna/ui/tooltip';
let {note}:{note:string}=$props();
</script>

<Tooltip.Provider delayDuration={100}>
 <Tooltip.Root>
  <Tooltip.Trigger>
   {#snippet child({props})}
   <!-- The parent lesson button provides keyboard access to the full note in its detail dialog. -->
   <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
   <span {...props} class="lesson-note-preview" tabindex={-1}>{note}</span>{/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content side="top" align="start" sideOffset={10} class="lesson-note-tooltip">{note}</Tooltip.Content>
 </Tooltip.Root>
</Tooltip.Provider>

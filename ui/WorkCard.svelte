<script lang="ts">
import * as Tooltip from '@mutsuna/ui/tooltip';
import type {WorkAssignment} from '../lib/work-assignments';
let {work,compact=false,disabled=false,onOpen}:{work:WorkAssignment;compact?:boolean;disabled?:boolean;onOpen:()=>void}=$props();
</script>
{#if compact}<Tooltip.Provider delayDuration={100}><Tooltip.Root><Tooltip.Trigger>{#snippet child({props})}<button {...props} class={compact?'calendar-work':'fixed-work'} {disabled} onclick={onOpen}><strong>{work.title}</strong></button>{/snippet}</Tooltip.Trigger>{#if work.note}<Tooltip.Content side="top" align="start" sideOffset={10} class="lesson-note-tooltip">{work.note}</Tooltip.Content>{/if}</Tooltip.Root></Tooltip.Provider>{:else}<button class="fixed-work" {disabled} onclick={onOpen}><strong>{work.title}</strong></button>{/if}

<style>.fixed-work,.calendar-work{display:flex;align-items:center;gap:6px}</style>

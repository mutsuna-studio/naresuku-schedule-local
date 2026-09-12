<script lang="ts">
let {compact=false}:{compact?:boolean}=$props();
</script>
<svg class:compact class="login-optic" viewBox="-140 -140 280 280" fill="none" aria-hidden="true">
  <g class="optic-mechanics">
    <circle r="130" stroke="currentColor" stroke-width=".5" stroke-opacity=".3"/>
    <circle r="123" stroke="currentColor" stroke-width="2" stroke-dasharray="18 5 2 5" stroke-opacity=".45"/>
    {#each Array(72) as _,i}<path d={i%6===0?'M0 -129v7':'M0 -129v3'} transform={`rotate(${i*5})`} stroke="currentColor" stroke-opacity={i%6===0?'.7':'.3'} stroke-width=".6"/>{/each}
  </g>
  <g class="optic-tracers">
    <!-- Symmetric bounds keep partial arcs rotating around the optical center. -->
    <circle r="136" fill="none" stroke="none"/>
    {#each Array(3) as _,i}<path transform={`rotate(${i*120})`} d="M-30 -114A118 118 0 0 1 62 -100" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path transform={`rotate(${i*120})`} d="M0 -136 3 -133 0 -130-3 -133Z" fill="currentColor" fill-opacity=".6"/>{/each}
  </g>
  <g class="optic-calibration">
    <circle r="111" stroke="currentColor" stroke-opacity=".18" stroke-width=".5"/>
    {#each Array(60) as _,i}<path d={i%5===0?'M0 -110v7':'M0 -110v3'} transform={`rotate(${i*6})`} stroke="currentColor" stroke-opacity={i%5===0?'.6':'.25'} stroke-width={i%5===0?'1':'.5'}/>{/each}

  </g>
  <g class="optic-orbits">
    <circle r="98" stroke="currentColor" stroke-opacity=".13" stroke-width=".5"/>
    {#each Array(6) as _,i}<g transform={`rotate(${i*60})`}><path d="M-23 -98A101 101 0 0 1 23 -98" stroke="currentColor" stroke-opacity=".65" stroke-width="1"/><path d="M0 -102v-3" stroke="currentColor" stroke-opacity=".4" stroke-width=".7"/></g>{/each}
  </g>
  <g class="optic-blades">
    {#each Array(6) as _,i}
      <path class="optic-blade" style={`--blade:${i}`} transform={`rotate(${i*60})`} d="M0 -92 79.674 -46 79.674 10 34.641 -20 0 -40Z" fill="currentColor" fill-opacity={i%2===0?'.10':'.035'} stroke="currentColor" stroke-opacity=".72" stroke-width=".65"/>
      <path transform={`rotate(${i*60})`} d="M5 -83 69 -46" stroke="currentColor" stroke-opacity=".22" stroke-width=".5"/>
    {/each}
  </g>
  <g class="optic-core">
    <path d="m0 -32 27.713 16v32L0 32-27.713 16v-32Z" stroke="currentColor" stroke-opacity=".2" stroke-width=".6"/>
    <circle r="23" stroke="currentColor" stroke-opacity=".09" stroke-width=".5"/>
    <path d="M-12 14v-28L12 14v-28" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>
  </g>

</svg>

<script lang="ts">
let {value,abbreviation=''}:{value:string;abbreviation?:string}=$props();
const short=$derived(abbreviation.trim()||value);
</script>
<span class="course-label" title={value} aria-label={value}><span class="course-full" aria-hidden="true">{value}</span><span class="course-short" aria-hidden="true">{short}</span></span>
<style>
.course-short{display:none}
@container student-card (max-width:190px){.course-full{display:none}.course-short{display:inline}}
</style>

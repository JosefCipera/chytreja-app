<script>
  let { sources = [] } = $props();
  // Guard against null items from API
  const safeSources = $derived((sources || []).filter(Boolean));

  function statusNeon(status) {
    return status === 'VERIFIED' ? 'neon-green' :
           status === 'AUTHENTICATED' ? 'neon-cyan' : '';
  }

  function statusColor(status) {
    return status === 'VERIFIED' ? 'text-green-400 border-green-500/20 bg-green-500/[0.07]' :
           status === 'AUTHENTICATED' ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/[0.07]' :
           'text-slate-400 border-slate-500/20 bg-slate-500/[0.07]';
  }
</script>

{#if safeSources.length > 0}
  <div>
    <span class="hud-mono text-[10px] text-slate-600 tracking-[2px] mb-2 block px-1">
      SOURCE_VALIDATION
    </span>
    <div class="grid grid-cols-2 gap-2">
      {#each safeSources as source, i}
        <div class="hud-glass rounded-lg p-3 text-xs hud-fade-in" style="animation-delay: {0.5 + i * 0.1}s">
          <div class="hud-mono text-cyan-500/50 mb-1 text-[10px]">
            [MED_ID: {source.med_id}]
          </div>
          <div class="hud-mono text-slate-500 mb-1.5 uppercase text-[9px] leading-relaxed">
            {source.type}: {source.title.length > 35 ? source.title.slice(0, 35) + '...' : source.title}
          </div>
          <div class="text-slate-500 font-sans text-[10px] italic mb-2">
            {source.journal}, {source.year}
          </div>
          <span class="hud-mono text-[9px] px-2 py-0.5 rounded border {statusColor(source.status)} {statusNeon(source.status)}">
            [{source.status}]
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

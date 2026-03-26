<script>
  let { sources = [] } = $props();
  const safeSources = $derived((sources || []).filter(Boolean));

  // Shorten UUID to first segment, keep numeric IDs as-is
  function shortId(id) {
    if (!id) return '???';
    const s = String(id);
    const dash = s.indexOf('-');
    return dash > 0 ? s.slice(0, dash).toUpperCase() : s;
  }

  function statusColor(status) {
    return status === 'VERIFIED'      ? '#4ade80' :
           status === 'AUTHENTICATED' ? '#22d3ee' : '#94a3b8';
  }

  function statusBorder(status) {
    return status === 'VERIFIED'      ? 'rgba(74,222,128,0.25)' :
           status === 'AUTHENTICATED' ? 'rgba(34,211,238,0.25)' : 'rgba(148,163,184,0.15)';
  }
</script>

{#if safeSources.length > 0}
  <div class="grid grid-cols-2 gap-2">
    {#each safeSources as source, i}
      <div class="rounded-lg p-3 hud-fade-in" style="
        animation-delay: {0.5 + i * 0.1}s;
        background: rgba(6,182,212,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-top: 2px solid {statusBorder(source.status)};
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      ">
        <!-- SOURCE_VALIDATION_0N -->
        <div class="hud-mono mb-1" style="font-size: 11px; letter-spacing: 0.08em; color: #e2e8f0;">
          SOURCE_VALIDATION_{String(i + 1).padStart(2, '0')}
        </div>

        <!-- MED_ID short -->
        <div class="hud-mono mb-1" style="font-size: 12px; color: rgba(6,182,212,0.7);">
          [MED_ID: {shortId(source.med_id)}]
        </div>

        <!-- Type + title -->
        <div class="hud-mono leading-snug mb-1" style="font-size: 11px; color: #64748b; text-transform: uppercase;">
          {source.type}: {source.title.length > 38 ? source.title.slice(0, 38) + '...' : source.title}
        </div>

        <!-- Journal + year -->
        <div class="font-sans italic mb-2" style="font-size: 11px; color: #475569;">
          {source.journal}, {source.year}
        </div>

        <!-- Status badge -->
        <span class="hud-mono" style="
          font-size: 11px;
          color: {statusColor(source.status)};
          border: 1px solid {statusBorder(source.status)};
          padding: 1px 6px;
          border-radius: 3px;
        ">[{source.status}]</span>
      </div>
    {/each}
  </div>
{/if}

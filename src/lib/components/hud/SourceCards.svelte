<script>
  let { sources = [] } = $props();
  const safeSources = $derived((sources || []).filter(Boolean));

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

  const SEP = 'border-bottom: 1px solid rgba(6,182,212,0.18);';
</script>

{#if safeSources.length > 0}
  <div class="grid grid-cols-2 gap-2">
    {#each safeSources as source, i}
      <div class="rounded-lg hud-fade-in" style="
        animation-delay: {0.5 + i * 0.1}s;
        background: rgba(6,182,212,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-top: 2px solid {statusBorder(source.status)};
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        overflow: hidden;
      ">
        <!-- SOURCE_VALIDATION_0N -->
        <div style="padding: 7px 10px 6px;">
          <span class="hud-mono" style="
            font-size: 12px; letter-spacing: 0.08em; color: #94a3b8;
            display: inline-block;
            border-bottom: 1px solid rgba(6,182,212,0.22);
            padding-bottom: 5px;
          ">SOURCE_VALIDATION_{String(i + 1).padStart(2, '0')}</span>
        </div>

        <!-- Content block -->
        <div style="padding: 7px 10px;">
          <!-- MED_ID short -->
          <div class="hud-mono mb-1" style="font-size: 13px; color: rgba(6,182,212,0.85);">
            [MED_ID: {shortId(source.med_id)}]
          </div>

          <!-- Type + title -->
          <div class="hud-mono leading-snug mb-1" style="font-size: 11px; color: #64748b; text-transform: uppercase;">
            {source.type}: {source.title.length > 38 ? source.title.slice(0, 38) + '...' : source.title}
          </div>

          <!-- Journal + year -->
          <div class="font-sans italic" style="font-size: 11px; color: #475569;">
            {source.journal}, {source.year}
          </div>
        </div>

        <!-- Status badge with inline top separator -->
        <div style="padding: 6px 10px 8px;">
          <span class="hud-mono" style="
            display: inline-block;
            border-top: 1px solid rgba(6,182,212,0.22);
            padding-top: 5px;
          ">
            <span class="hud-mono" style="
              font-size: 11px;
              color: {statusColor(source.status)};
              border: 1px solid {statusBorder(source.status)};
              padding: 1px 6px;
              border-radius: 3px;
            ">[{source.status}]</span>
          </span>
        </div>
      </div>
    {/each}
  </div>
{/if}

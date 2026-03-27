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

  function openSource(source) {
    window.parent.postMessage({ type: 'chj:source:open', source }, '*');
  }
</script>

{#if safeSources.length > 0}
  <div class="grid grid-cols-2 gap-2">
    {#each safeSources as source, i}
      <button
        onclick={() => openSource(source)}
        class="rounded-lg hud-fade-in text-left"
        style="
          animation-delay: {0.5 + i * 0.1}s;
          background: rgba(6,182,212,0.03);
          border: 1px solid rgba(255,255,255,0.18);
          border-top: 2px solid {statusBorder(source.status)};
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          overflow: hidden;
          cursor: pointer;
          transition: background 0.15s;
        "
        onmouseenter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.07)'}
        onmouseleave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.03)'}
      >
        <div style="padding: 9px 10px 0;">
          <div class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #94a3b8; border-bottom: 1px solid rgba(6,182,212,0.22); padding-bottom: 6px;">
            SOURCE_VALIDATION_{String(i + 1).padStart(2, '0')}
          </div>
        </div>
        <div style="padding: 7px 10px;">
          <div class="hud-mono mb-1" style="font-size: 13px; color: rgba(6,182,212,0.85);">
            [MED_ID: {shortId(source.med_id)}]
          </div>
          <div class="hud-mono leading-snug mb-1" style="font-size: 11px; color: #64748b; text-transform: uppercase;">
            {source.type}: {source.title.length > 38 ? source.title.slice(0, 38) + '...' : source.title}
          </div>
          <div class="font-sans italic" style="font-size: 11px; color: #475569;">
            {source.journal}, {source.year}
          </div>
        </div>
        <div style="padding: 0 10px 9px;">
          <div style="border-top: 1px solid rgba(6,182,212,0.22); padding-top: 8px;">
            <span class="hud-mono" style="
              font-size: 11px;
              color: {statusColor(source.status)};
              border: 1px solid {statusBorder(source.status)};
              padding: 1px 6px; border-radius: 3px;
            ">[{source.status}]</span>
          </div>
        </div>
      </button>
    {/each}
  </div>
{/if}

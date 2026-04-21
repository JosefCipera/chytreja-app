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

  // Media type metadata
  const TYPE_META = {
    video:   { icon: '▶', label: 'VIDEO',   color: '#f87171', border: 'rgba(248,113,113,0.35)' },
    audio:   { icon: '◉', label: 'AUDIO',   color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
    pdf:     { icon: '▤', label: 'PDF',     color: '#fb923c', border: 'rgba(251,146,60,0.35)'  },
    md:      { icon: '✦', label: 'MD',      color: '#34d399', border: 'rgba(52,211,153,0.35)'  },
    image:   { icon: '◈', label: 'IMAGE',   color: '#60a5fa', border: 'rgba(96,165,250,0.35)'  },
    article: { icon: '◇', label: 'ARTICLE', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' },
  };

  function typeMeta(type) {
    return TYPE_META[type] || TYPE_META.article;
  }

  function openSource(source) {
    window.parent.postMessage({ type: 'chj:source:open', source }, '*');
  }
</script>

{#if safeSources.length > 0}
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: stretch;">
    {#each safeSources as source, i}
      {@const meta = typeMeta(source.type)}
      {@const isCzech = source.lang === 'cs'}
      <button
        onclick={() => openSource(source)}
        class="rounded-lg hud-fade-in text-left"
        style="
          animation-delay: {0.5 + i * 0.1}s;
          background: rgba(6,182,212,0.03);
          border: 1px solid rgba(255,255,255,0.52);
          border-top: 2px solid {statusBorder(source.status)};
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          overflow: hidden;
          cursor: pointer;
          transition: background 0.15s;
          display: flex; flex-direction: column;
          height: 100%;
        "
        onmouseenter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.07)'}
        onmouseleave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.03)'}
      >
        <!-- Header: SOURCE_01 + type badge -->
        <div style="padding: 9px 10px 0; flex-shrink: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(6,182,212,0.22); padding-bottom: 6px;">
            <span class="hud-mono" style="font-size: 11px; letter-spacing: 0.08em; color: #94a3b8; line-height: 1.2;">
              SOURCE_{String(i + 1).padStart(2, '0')}
            </span>
            <span class="hud-mono" style="
              font-size: 10px;
              color: {meta.color};
              border: 1px solid {meta.border};
              padding: 1px 5px; border-radius: 3px;
              letter-spacing: 0.06em; flex-shrink: 0;
            ">{meta.icon} {meta.label}</span>
          </div>
        </div>

        <!-- Body — grows to fill space -->
        <div style="padding: 7px 10px; flex: 1;">
          <div class="hud-mono mb-1" style="font-size: 13px; color: rgba(6,182,212,0.85);">
            [ID: {shortId(source.med_id)}]
          </div>
          <div class="hud-mono leading-snug mb-1" style="font-size: 13px; color: #94a3b8; text-transform: uppercase;">
            {source.title.length > 38 ? source.title.slice(0, 38) + '...' : source.title}
          </div>
          {#if source.journal || source.year}
            <div class="font-sans italic" style="font-size: 12px; color: #64748b;">
              {[source.journal, source.year].filter(Boolean).join(', ')}
            </div>
          {/if}
        </div>

        <!-- Footer — vždy na spodku karty -->
        <div style="padding: 0 10px 9px; flex-shrink: 0;">
          <div style="border-top: 1px solid rgba(6,182,212,0.22); padding-top: 8px; display: flex; align-items: center; gap: 6px;">
            <span class="hud-mono" style="
              font-size: 11px;
              color: {statusColor(source.status)};
              border: 1px solid {statusBorder(source.status)};
              padding: 1px 6px; border-radius: 3px;
            ">[{source.status}]</span>
            {#if isCzech}
              <span class="hud-mono" style="
                font-size: 10px;
                color: #34d399;
                border: 1px solid rgba(52,211,153,0.3);
                padding: 1px 5px; border-radius: 3px;
                letter-spacing: 0.05em;
              ">CZ</span>
            {/if}
          </div>
        </div>
      </button>
    {/each}
  </div>
{/if}

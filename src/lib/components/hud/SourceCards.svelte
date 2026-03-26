<script>
  let { sources = [] } = $props();
  const safeSources = $derived((sources || []).filter(Boolean));

  let activeSource = $state(null);

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
      <button
        onclick={() => activeSource = source}
        class="rounded-lg hud-fade-in text-left"
        style="
          animation-delay: {0.5 + i * 0.1}s;
          background: rgba(6,182,212,0.03);
          border: 1px solid rgba(255,255,255,0.07);
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
        <!-- SOURCE_VALIDATION_0N -->
        <div style="padding: 7px 10px 6px; border-bottom: 1px solid rgba(6,182,212,0.22);">
          <span class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #94a3b8;">
            SOURCE_VALIDATION_{String(i + 1).padStart(2, '0')}
          </span>
        </div>

        <!-- Content block -->
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

        <!-- Status badge -->
        <div style="padding: 6px 10px 8px; border-top: 1px solid rgba(6,182,212,0.22);">
          <span class="hud-mono" style="
            font-size: 11px;
            color: {statusColor(source.status)};
            border: 1px solid {statusBorder(source.status)};
            padding: 1px 6px;
            border-radius: 3px;
          ">[{source.status}]</span>
        </div>
      </button>
    {/each}
  </div>
{/if}

<!-- Source detail modal -->
{#if activeSource}
  <!-- backdrop -->
  <div
    onclick={() => activeSource = null}
    style="
      position: fixed; inset: 0; z-index: 200;
      background: rgba(2,6,14,0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    "
  ></div>

  <!-- modal -->
  <div style="
    position: fixed; inset: 0; z-index: 201;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    pointer-events: none;
  ">
    <div style="
      width: 100%; max-width: 380px;
      background: rgba(2,6,14,0.97);
      border: 1px solid rgba(6,182,212,0.3);
      border-top: 2px solid {statusBorder(activeSource.status)};
      border-radius: 12px;
      overflow: hidden;
      pointer-events: auto;
      box-shadow: 0 0 40px rgba(6,182,212,0.1);
    ">
      <!-- Header -->
      <div style="padding: 10px 14px; border-bottom: 1px solid rgba(6,182,212,0.18); display: flex; justify-content: space-between; align-items: center;">
        <span class="hud-mono" style="font-size: 11px; letter-spacing: 0.1em; color: #94a3b8;">
          SOURCE_VALIDATION / [MED_ID: {shortId(activeSource.med_id)}]
        </span>
        <button onclick={() => activeSource = null} style="color: #475569; font-size: 16px; background: none; border: none; cursor: pointer; line-height: 1;">✕</button>
      </div>

      <!-- Body -->
      <div style="padding: 14px;">
        <div class="hud-mono mb-2" style="font-size: 10px; letter-spacing: 0.12em; color: #475569; text-transform: uppercase;">
          {activeSource.type}
        </div>
        <p style="font-size: 14px; color: #e2e8f0; line-height: 1.5; margin: 0 0 10px;">
          {activeSource.title}
        </p>
        <div class="font-sans italic mb-3" style="font-size: 12px; color: #64748b;">
          {activeSource.journal}, {activeSource.year}
        </div>
        <span class="hud-mono" style="
          font-size: 11px;
          color: {statusColor(activeSource.status)};
          border: 1px solid {statusBorder(activeSource.status)};
          padding: 2px 8px; border-radius: 3px;
        ">[{activeSource.status}]</span>
      </div>

      <!-- Open source button -->
      {#if activeSource.url}
        <div style="padding: 0 14px 14px;">
          <a
            href={activeSource.url}
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: block; text-align: center;
              padding: 9px;
              background: rgba(6,182,212,0.08);
              border: 1px solid rgba(6,182,212,0.25);
              border-radius: 8px;
              color: #22d3ee;
              font-size: 12px;
              letter-spacing: 0.08em;
              text-decoration: none;
            "
            class="hud-mono"
          >▶ OTEVŘÍT ZDROJ</a>
        </div>
      {/if}
    </div>
  </div>
{/if}

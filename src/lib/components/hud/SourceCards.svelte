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

  // Detect media type from URL
  function mediaType(url) {
    if (!url) return 'link';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.match(/\.(mp4|webm|mov)(\?|$)/)) return 'video';
    if (u.match(/\.(mp3|ogg|wav|m4a)(\?|$)/)) return 'audio';
    if (u.match(/\.(pdf)(\?|$)/)) return 'pdf';
    if (u.match(/\.(md|markdown)(\?|$)/)) return 'md';
    return 'iframe';
  }

  function youtubeEmbed(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1` : url;
  }

  function pdfEmbed(url) {
    return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(url)}`;
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
        <div style="padding: 7px 10px 6px; border-bottom: 1px solid rgba(6,182,212,0.22);">
          <span class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #94a3b8;">
            SOURCE_VALIDATION_{String(i + 1).padStart(2, '0')}
          </span>
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
        <div style="padding: 6px 10px 8px; border-top: 1px solid rgba(6,182,212,0.22);">
          <span class="hud-mono" style="
            font-size: 11px;
            color: {statusColor(source.status)};
            border: 1px solid {statusBorder(source.status)};
            padding: 1px 6px; border-radius: 3px;
          ">[{source.status}]</span>
        </div>
      </button>
    {/each}
  </div>
{/if}

<!-- Viewer modal -->
{#if activeSource}
  <div
    onclick={() => activeSource = null}
    style="
      position: fixed; inset: 0; z-index: 200;
      background: rgba(2,6,14,0.85);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    "
  ></div>

  <div style="
    position: fixed; inset: 0; z-index: 201;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    pointer-events: none;
  ">
    <div style="
      width: 100%; max-width: 560px;
      max-height: 80dvh;
      background: rgba(2,6,14,0.98);
      border: 1px solid rgba(6,182,212,0.3);
      border-top: 2px solid {statusBorder(activeSource.status)};
      border-radius: 12px;
      overflow: hidden;
      pointer-events: auto;
      display: flex; flex-direction: column;
      box-shadow: 0 0 40px rgba(6,182,212,0.12);
    ">
      <!-- Header row -->
      <div style="
        padding: 9px 14px;
        border-bottom: 1px solid rgba(6,182,212,0.18);
        display: flex; justify-content: space-between; align-items: center;
        flex-shrink: 0;
      ">
        <span class="hud-mono" style="font-size: 11px; letter-spacing: 0.08em; color: #64748b;">
          [MED_ID: {shortId(activeSource.med_id)}] · {activeSource.journal}, {activeSource.year}
        </span>
        <button
          onclick={() => activeSource = null}
          style="color: #475569; font-size: 18px; background: none; border: none; cursor: pointer; line-height: 1; padding: 0 0 0 12px;"
        >✕</button>
      </div>

      <!-- Viewer body -->
      <div style="flex: 1; overflow: hidden; min-height: 0;">
        {#if mediaType(activeSource.url) === 'youtube'}
          <iframe
            src={youtubeEmbed(activeSource.url)}
            style="width: 100%; height: 100%; min-height: 300px; border: none;"
            allow="autoplay; encrypted-media"
            allowfullscreen
          ></iframe>

        {:else if mediaType(activeSource.url) === 'video'}
          <video
            src={activeSource.url}
            controls
            style="width: 100%; max-height: 360px; background: #000;"
          ></video>

        {:else if mediaType(activeSource.url) === 'audio'}
          <div style="padding: 24px 16px; display: flex; flex-direction: column; gap: 12px;">
            <p style="color: #e2e8f0; font-size: 14px; line-height: 1.5; margin: 0;">{activeSource.title}</p>
            <audio src={activeSource.url} controls style="width: 100%;"></audio>
          </div>

        {:else if mediaType(activeSource.url) === 'pdf'}
          <iframe
            src={pdfEmbed(activeSource.url)}
            style="width: 100%; height: 100%; min-height: 420px; border: none;"
            title={activeSource.title}
          ></iframe>

        {:else if activeSource.url}
          <!-- Fallback: iframe attempt, pokud selže → link -->
          <iframe
            src={activeSource.url}
            style="width: 100%; height: 100%; min-height: 420px; border: none;"
            title={activeSource.title}
            sandbox="allow-scripts allow-same-origin allow-popups"
          ></iframe>

        {:else}
          <!-- Žádné URL -->
          <div style="padding: 24px 16px;">
            <p style="color: #e2e8f0; font-size: 14px; line-height: 1.5;">{activeSource.title}</p>
            <p class="font-sans italic" style="color: #475569; font-size: 12px; margin-top: 8px;">
              {activeSource.journal}, {activeSource.year}
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

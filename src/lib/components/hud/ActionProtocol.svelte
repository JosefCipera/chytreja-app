<script>
  let { action, killer = null, verdict = null, dayType = 'STIMUL', onComplete = null } = $props();

  // Determine action UI mode from type
  // timed → countdown timer
  // reps  → rep counter (+1)
  // habit → single HOTOVO button (no START step)
  const actionMode = $derived(
    action.type === 'habit' ? 'habit' :
    action.type === 'reps'  ? 'reps'  :
    'timed'
  );

  let status = $state(action.status || 'READY');
  let timer  = $state(action.duration || 60);
  let count  = $state(0);
  let interval = $state(null);

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function startTimer() {
    status = 'ACTIVE';
    interval = setInterval(() => {
      timer--;
      if (timer <= 0) { clearInterval(interval); complete(); }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(interval);
    complete();
  }

  function addRep() {
    count++;
    if (navigator?.vibrate) navigator.vibrate(40);
    if (count >= (action.reps || Infinity)) complete();
  }

  function complete() {
    status = 'COMPLETE';
    clearInterval(interval);
    onComplete?.();
  }

  let statusColor = $derived(
    status === 'READY'    ? '#22d3ee' :
    status === 'ACTIVE'   ? '#BED255' :
    '#86C46A'
  );

  // Strip leading discipline name if orchestrator prefixed verdict with it
  // e.g. "Metabolismus. Budeš..." → "Budeš..."  "Stabilita — záda..." → "záda..."
  const DISCIPLINE_NAMES = ['Síla','Kardio','Stabilita','Spánek','Výživa','Metabolismus','Kognice','Emoce','Prevence','Smysl'];
  function stripDisciplinePrefix(text) {
    if (!text) return text;
    for (const name of DISCIPLINE_NAMES) {
      if (text.startsWith(name)) {
        const rest = text.slice(name.length).replace(/^[.,:;—–\s]+/, '');
        if (rest.length > 0) return rest;
      }
    }
    return text;
  }

  const DISCIPLINE_LABELS = {
    sila: 'SÍLA', kardio: 'KARDIO', stabilita: 'STABILITA',
    spanek: 'SPÁNEK', kognitivni: 'KOGNICE', emocni: 'EMOCE',
    vyziva: 'VÝŽIVA', metabolismus: 'METABOLISMUS', prevence: 'PREVENCE', smysl: 'SMYSL',
  };
  let protocolLabel = $derived(DISCIPLINE_LABELS[dayType] ?? dayType);
</script>

<div class="rounded-lg hud-c4 {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(6, 182, 212, 0.03);
  border: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
">
  <span class="hc hc-bl"></span><span class="hc hc-br"></span>

  <!-- KILLER sekce -->
  {#if killer}
    <div class="px-4 pt-3 pb-2">
      <div class="hud-mono" style="font-size: 20px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; margin-bottom: 4px;">
        KILLER: <span style="color: #94a3b8;">{killer.label}</span>
      </div>
      <div class="flex items-center gap-2">
        <span style="font-size: 17px; color: #C97272;">{@html '\u26A0\uFE0E'}</span>
        <span style="font-size: 15px; color: #C97272;">{killer.description}</span>
      </div>
      {#if verdict}
        <div style="margin-top: 8px; font-size: 15px; color: #94a3b8; line-height: 1.4;">
          {stripDisciplinePrefix(verdict)}
        </div>
      {/if}
    </div>
    <div style="margin: 0 16px; border-top: 1px solid rgba(6,182,212,0.30);"></div>
  {/if}

  <!-- ACTION sekce -->
  <div class="px-4 pt-2 pb-3">
    <div class="hud-mono mb-2" style="letter-spacing: 0.04em; font-weight: 300; line-height: 1.5;">
      <div class="flex items-center justify-between" style="font-size: 20px;">
        <span style="color: #c8d4df;">ACTION: <span style="color: #64748b; font-size: 16px;">{protocolLabel}</span></span>
        <span style="color: {statusColor};">[{status}]</span>
      </div>
    </div>

    <div class="font-sans mb-1 flex items-baseline gap-2" style="font-size: 17px; line-height: 1.3;">
      <span class="hud-mono" style="color: #475569; flex-shrink: 0; font-size: 15px;">[ ]</span>
      <span style="color: #e2e8f0;">{action.label}</span>
    </div>

    {#if action.coaching_note}
      <div class="font-sans mb-3" style="font-size: 13px; color: #64748b; line-height: 1.5;">
        {action.coaching_note}
      </div>
    {/if}

    <!-- ── TIMED ── -->
    {#if actionMode === 'timed'}
      {#if status === 'ACTIVE'}
        <div class="text-center mb-3">
          <span class="hud-mono tabular-nums"
            style="font-size: 2.2rem; font-weight: 400; color: #e2e8f0; text-shadow: 0 0 16px rgba(6,182,212,0.45);">
            {formatTime(timer)}
          </span>
        </div>
        <button onclick={stopTimer} class="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] hud-mono tracking-wider hover:bg-yellow-500/[0.12] transition-all cursor-pointer"
          style="padding: 14px; font-size: 16px; color: #BED255;">
          ⏹ STOP
        </button>
      {:else if status === 'COMPLETE'}
        <div class="text-center" style="padding: 14px; font-size: 16px; color: #86C46A;">✔ HOTOVO</div>
      {:else}
        <button onclick={startTimer} class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
          style="padding: 14px; font-size: 16px; color: #22d3ee;">
          ▶ START PROTOCOL
        </button>
      {/if}

    <!-- ── REPS ── -->
    {:else if actionMode === 'reps'}
      {#if status === 'COMPLETE'}
        <div class="text-center" style="padding: 14px; font-size: 16px; color: #86C46A;">✔ HOTOVO</div>
      {:else}
        <div class="text-center mb-3">
          <span class="hud-mono tabular-nums" style="font-size: 2.2rem; font-weight: 400; color: #e2e8f0;">
            {count}
          </span>
          <span class="hud-mono" style="font-size: 1rem; color: #64748b;"> / {action.reps || '?'}</span>
        </div>
        <button onclick={addRep} class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] transition-all cursor-pointer"
          style="padding: 14px; font-size: 16px; color: #22d3ee;">
          +1
        </button>
      {/if}

    <!-- ── HABIT ── -->
    {:else}
      {#if status === 'COMPLETE'}
        <div class="text-center" style="padding: 14px; font-size: 16px; color: #86C46A;">✔ HOTOVO</div>
      {:else}
        <button onclick={complete} class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] transition-all cursor-pointer"
          style="padding: 14px; font-size: 16px; color: #22d3ee;">
          ✓ HOTOVO
        </button>
      {/if}
    {/if}
  </div>
</div>

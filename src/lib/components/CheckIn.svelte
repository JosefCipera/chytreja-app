<script>
  let { userId, onComplete = null } = $props();

  let energie   = $state(3);
  let spanek    = $state(7);
  let hrv       = $state('');
  let saving    = $state(false);
  let error     = $state(null);

  const energieLabels = ['', 'vyčerpaný', 'unavený', 'ujde', 'dobrý', 'nabitý'];

  async function submit() {
    saving = true;
    error  = null;
    try {
      const res = await fetch('/api/readiness', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId,
          energie,
          spanek_hod: Number(spanek),
          hrv: hrv !== '' ? Number(hrv) : null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Chyba uložení.');
      onComplete?.();
    } catch (e) {
      error  = e.message;
      saving = false;
    }
  }
</script>

<!-- Modal backdrop -->
<div style="
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(6, 10, 20, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
">
  <!-- Modal card -->
  <div class="hud-fade-in" style="
    width: 100%;
    max-width: 380px;
    background: rgba(6, 10, 22, 0.96);
    border: 1px solid rgba(6,182,212,0.22);
    border-radius: 16px;
    padding: 28px 24px 24px;
    position: relative;
    box-shadow: 0 0 40px rgba(6,182,212,0.08), 0 20px 60px rgba(0,0,0,0.6);
  ">
    <!-- Header -->
    <div class="mb-6">
      <div class="hud-mono mb-1" style="font-size: 11px; letter-spacing: 0.12em; color: #475569;">MORNING_CHECK-IN</div>
      <div style="font-size: 20px; font-weight: 300; color: #e2e8f0;">Jak se dnes cítíš?</div>
    </div>

    <!-- Energie -->
    <div class="mb-6">
      <div class="flex justify-between items-baseline mb-3">
        <div class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #64748b;">ENERGIE</div>
        <div class="hud-mono" style="font-size: 14px; color: #22d3ee;">{energieLabels[energie]}</div>
      </div>
      <input
        type="range"
        min="1" max="5" step="1"
        bind:value={energie}
        class="w-full"
        style="
          accent-color: #06b6d4;
          height: 4px;
          cursor: pointer;
        "
      />
      <div class="flex justify-between mt-1 hud-mono" style="font-size: 10px; color: #334155;">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>

    <!-- Spánek -->
    <div class="mb-6">
      <div class="flex justify-between items-baseline mb-3">
        <div class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #64748b;">SPÁNEK</div>
        <div class="hud-mono" style="font-size: 14px; color: #22d3ee;">{spanek} h</div>
      </div>
      <input
        type="range"
        min="0" max="12" step="0.5"
        bind:value={spanek}
        class="w-full"
        style="
          accent-color: #06b6d4;
          height: 4px;
          cursor: pointer;
        "
      />
      <div class="flex justify-between mt-1 hud-mono" style="font-size: 10px; color: #334155;">
        <span>0</span><span>4</span><span>8</span><span>12</span>
      </div>
    </div>

    <!-- HRV optional -->
    <div class="mb-6">
      <div class="flex justify-between items-baseline mb-3">
        <div class="hud-mono" style="font-size: 12px; letter-spacing: 0.08em; color: #2d3f52;">
          HRV <span style="color:#1e2d3d;">(ms · volitelné)</span>
        </div>
        {#if hrv !== ''}
          <div class="hud-mono" style="font-size: 14px; color: #475569;">{hrv} ms</div>
        {/if}
      </div>
      <input
        type="range"
        min="0" max="120" step="1"
        bind:value={hrv}
        class="w-full"
        style="
          accent-color: #334155;
          height: 4px;
          cursor: pointer;
          opacity: 0.4;
        "
      />
      <div class="flex justify-between mt-1 hud-mono" style="font-size: 10px; color: #1e293b;">
        <span>0</span><span>40</span><span>80</span><span>120</span>
      </div>
    </div>

    {#if error}
      <div class="hud-mono mb-3" style="font-size: 12px; color: #ef4444;">{error}</div>
    {/if}

    <!-- Submit -->
    <button
      onclick={submit}
      disabled={saving}
      class="w-full rounded-lg border hud-mono tracking-wider transition-all cursor-pointer"
      style="
        padding: 14px;
        font-size: 15px;
        border-color: {saving ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.28)'};
        background: {saving ? 'transparent' : 'rgba(6,182,212,0.07)'};
        color: {saving ? '#334155' : '#22d3ee'};
      "
    >
      {saving ? 'UKLÁDÁM…' : 'POTVRDIT'}
    </button>

    <div class="text-center mt-3 hud-mono" style="font-size: 10px; color: #1a2535; letter-spacing: 0.06em;">
      wearable · Apple Health doplní automaticky
    </div>
  </div>
</div>

<script>
  let { userId, onComplete = null } = $props();

  let energie   = $state(3);
  let spanek    = $state('');
  let hrv       = $state('');
  let saving    = $state(false);
  let error     = $state(null);

  async function submit() {
    if (!spanek || Number(spanek) < 0 || Number(spanek) > 24) {
      error = 'Zadej počet hodin spánku (0–24).';
      return;
    }
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
    <div class="mb-5">
      <div class="hud-mono mb-2" style="font-size: 12px; letter-spacing: 0.08em; color: #64748b;">ENERGIE</div>
      <div class="flex gap-2">
        {#each [1,2,3,4,5] as n}
          <button
            onclick={() => energie = n}
            class="flex-1 rounded-lg border transition-all cursor-pointer hud-mono"
            style="
              padding: 12px 0;
              font-size: 16px;
              border-color: {energie >= n ? 'rgba(6,182,212,0.55)' : 'rgba(255,255,255,0.06)'};
              background: {energie >= n ? 'rgba(6,182,212,0.10)' : 'transparent'};
              color: {energie >= n ? '#22d3ee' : '#334155'};
            "
          >{n}</button>
        {/each}
      </div>
      <div class="flex justify-between mt-1 hud-mono" style="font-size: 10px; color: #1e293b; letter-spacing: 0.05em;">
        <span>vyčerpaný</span><span>nabitý</span>
      </div>
    </div>

    <!-- Spánek -->
    <div class="mb-5">
      <label for="checkin-spanek" class="hud-mono mb-2 block" style="font-size: 12px; letter-spacing: 0.08em; color: #64748b;">
        SPÁNEK <span style="color:#334155;">(hodiny)</span>
      </label>
      <input
        id="checkin-spanek"
        type="number"
        min="0"
        max="24"
        step="0.5"
        placeholder="7,5"
        bind:value={spanek}
        class="w-full rounded-lg hud-mono text-center"
        style="
          background: rgba(6,182,212,0.04);
          border: 1px solid rgba(6,182,212,0.18);
          color: #e2e8f0;
          font-size: 22px;
          padding: 12px;
          outline: none;
        "
      />
    </div>

    <!-- HRV optional -->
    <div class="mb-6">
      <label for="checkin-hrv" class="hud-mono mb-2 block" style="font-size: 12px; letter-spacing: 0.08em; color: #2d3f52;">
        HRV <span style="color:#1e2d3d;">(ms · volitelné)</span>
      </label>
      <input
        id="checkin-hrv"
        type="number"
        min="0"
        max="300"
        placeholder="—"
        bind:value={hrv}
        class="w-full rounded-lg hud-mono text-center"
        style="
          background: transparent;
          border: 1px solid rgba(255,255,255,0.04);
          color: #334155;
          font-size: 18px;
          padding: 10px;
          outline: none;
        "
      />
    </div>

    {#if error}
      <div class="hud-mono mb-3" style="font-size: 12px; color: #ef4444;">{error}</div>
    {/if}

    <!-- Submit -->
    <button
      onclick={submit}
      disabled={saving || !spanek}
      class="w-full rounded-lg border hud-mono tracking-wider transition-all cursor-pointer"
      style="
        padding: 14px;
        font-size: 15px;
        border-color: {saving ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.28)'};
        background: {saving ? 'transparent' : 'rgba(6,182,212,0.07)'};
        color: {saving ? '#334155' : '#22d3ee'};
        opacity: {!spanek ? 0.45 : 1};
      "
    >
      {saving ? 'UKLÁDÁM…' : 'POTVRDIT'}
    </button>

    <div class="text-center mt-3 hud-mono" style="font-size: 10px; color: #1a2535; letter-spacing: 0.06em;">
      wearable · Apple Health doplní automaticky
    </div>
  </div>
</div>

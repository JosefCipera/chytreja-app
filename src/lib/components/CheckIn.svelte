<script>
  let { userId, onComplete = null } = $props();

  let energie   = $state(3);   // 1–5 stars
  let spanek    = $state('');  // hours, string → number on submit
  let hrv       = $state('');  // optional
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

<div class="hud-shell hud-glow relative overflow-hidden hud-fade-in"
  style="width: 420px; min-height: 100dvh; border-radius: 20px 0 0 20px; overflow-y: auto; display: flex; flex-direction: column; justify-content: center;">

  <div class="absolute inset-0 hud-grid opacity-30"></div>

  <div class="relative z-10 px-6 py-10 space-y-8">

    <!-- Header -->
    <div>
      <div class="hud-mono tracking-widest mb-1" style="font-size: 11px; color: #475569;">MORNING_CHECK-IN</div>
      <div style="font-size: 22px; font-weight: 300; color: #e2e8f0; line-height: 1.3;">
        Jak se dnes cítíš?
      </div>
    </div>

    <!-- Energie -->
    <div>
      <div class="hud-mono mb-3" style="font-size: 13px; letter-spacing: 0.08em; color: #64748b;">ENERGIE</div>
      <div class="flex gap-3" role="group" aria-label="Energie 1 až 5">
        {#each [1,2,3,4,5] as n}
          <button
            onclick={() => energie = n}
            class="flex-1 rounded-lg border transition-all cursor-pointer"
            style="
              padding: 14px 0;
              font-size: 18px;
              border-color: {energie >= n ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.07)'};
              background: {energie >= n ? 'rgba(6,182,212,0.12)' : 'transparent'};
              color: {energie >= n ? '#22d3ee' : '#334155'};
            "
            aria-pressed={energie === n}
          >{n}</button>
        {/each}
      </div>
      <div class="flex justify-between mt-1 hud-mono" style="font-size: 10px; color: #334155; letter-spacing: 0.06em;">
        <span>VYČERPANÝ</span><span>NABITÝ</span>
      </div>
    </div>

    <!-- Spánek -->
    <div>
      <label for="spanek" class="hud-mono mb-3 block" style="font-size: 13px; letter-spacing: 0.08em; color: #64748b;">
        SPÁNEK <span style="color:#334155;">(hodiny)</span>
      </label>
      <input
        id="spanek"
        type="number"
        min="0"
        max="24"
        step="0.5"
        placeholder="7.5"
        bind:value={spanek}
        class="w-full rounded-lg hud-mono text-center transition-all"
        style="
          background: rgba(6,182,212,0.04);
          border: 1px solid rgba(6,182,212,0.2);
          color: #e2e8f0;
          font-size: 24px;
          padding: 14px;
          outline: none;
        "
      />
    </div>

    <!-- HRV optional -->
    <div>
      <label for="hrv" class="hud-mono mb-3 block" style="font-size: 13px; letter-spacing: 0.08em; color: #334155;">
        HRV <span style="color:#1e293b;">(ms · volitelné)</span>
      </label>
      <input
        id="hrv"
        type="number"
        min="0"
        max="300"
        placeholder="—"
        bind:value={hrv}
        class="w-full rounded-lg hud-mono text-center transition-all"
        style="
          background: transparent;
          border: 1px solid rgba(255,255,255,0.05);
          color: #475569;
          font-size: 20px;
          padding: 12px;
          outline: none;
        "
      />
    </div>

    <!-- Error -->
    {#if error}
      <div class="hud-mono" style="font-size: 13px; color: #ef4444;">{error}</div>
    {/if}

    <!-- Submit -->
    <button
      onclick={submit}
      disabled={saving || !spanek}
      class="w-full rounded-lg border hud-mono tracking-wider transition-all cursor-pointer"
      style="
        padding: 16px;
        font-size: 16px;
        border-color: {saving ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.3)'};
        background: {saving ? 'transparent' : 'rgba(6,182,212,0.08)'};
        color: {saving ? '#334155' : '#22d3ee'};
        opacity: {!spanek ? 0.4 : 1};
      "
    >
      {saving ? 'UKLÁDÁM…' : 'SPUSTIT PROTOKOL'}
    </button>

    <!-- Skip (dev/wearable note) -->
    <div class="text-center hud-mono" style="font-size: 11px; color: #1e293b; letter-spacing: 0.06em;">
      Automaticky vyplní wearable · Apple Health
    </div>

  </div>
</div>

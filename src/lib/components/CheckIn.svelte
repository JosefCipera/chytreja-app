<script>
  let { userId, onComplete = null } = $props();

  let energie   = $state(3);
  let spanek    = $state(7);
  let hrv       = $state('');
  let saving    = $state(false);
  let error     = $state(null);

  const energieLabels = ['', 'vyčerpaný', 'unavený', 'ujde to', 'dobrý', 'nabitý'];

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
      <div class="hud-mono" style="font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">ENERGIE</div>
      <p style="color:#64748b;font-size:13px;margin-bottom:16px;font-style:italic;">Vyčerpaný=1, Ujde to=3, Nabitý=5</p>
      <input
        type="range"
        min="1" max="5" step="1"
        bind:value={energie}
        class="w-full"
        style="height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
               background:linear-gradient(to right,#ef4444 0%,#eab308 50%,#22c55e 100%);"
      />
      <div class="flex justify-between items-center mt-2">
        <span style="color:#64748b;font-size:13px;">Vyčerpaný</span>
        <span style="color:#06b6d4;font-size:22px;font-weight:600;">{energieLabels[energie]}</span>
        <span style="color:#64748b;font-size:13px;">Nabitý</span>
      </div>
    </div>

    <!-- Spánek -->
    <div class="mb-6">
      <div class="hud-mono" style="font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">SPÁNEK</div>
      <p style="color:#64748b;font-size:13px;margin-bottom:16px;font-style:italic;">Méně než 5 h=nízko, 7–8 h=ideál, 10+ h=přespáno</p>
      <input
        type="range"
        min="0" max="12" step="0.5"
        bind:value={spanek}
        class="w-full"
        style="height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
               background:linear-gradient(to right,#1e3a5f 0%,#06b6d4 58%,#0e7490 100%);"
      />
      <div class="flex justify-between items-center mt-2">
        <span style="color:#64748b;font-size:13px;">0 h</span>
        <span style="color:#06b6d4;font-size:22px;font-weight:600;">{spanek} h</span>
        <span style="color:#64748b;font-size:13px;">12 h</span>
      </div>
    </div>

    <!-- HRV optional -->
    <div class="mb-6">
      <h3 style="color:#2d3f52;font-size:16px;margin-bottom:6px;">HRV <span style="font-size:13px;font-weight:400;">(ms · volitelné)</span></h3>
      <p style="color:#1e2d3d;font-size:13px;margin-bottom:16px;font-style:italic;">Nech vlevo pokud nemáš wearable</p>
      <input
        type="range"
        min="0" max="120" step="1"
        bind:value={hrv}
        class="w-full"
        style="height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
               background:linear-gradient(to right,#1e293b 0%,#334155 100%);opacity:0.5;"
      />
      <div class="flex justify-between items-center mt-2">
        <span style="color:#334155;font-size:13px;">—</span>
        <span style="color:#475569;font-size:22px;font-weight:600;">{hrv > 0 ? hrv + ' ms' : ''}</span>
        <span style="color:#334155;font-size:13px;">120 ms</span>
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

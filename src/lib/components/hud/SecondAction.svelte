<script>
  let { offerText = 'Chceš jít dál?', onAccept = null, onDecline = null } = $props();
</script>

<div class="hud-fade-in rounded-lg" style="
  background: rgba(6,182,212,0.04);
  border: 1px solid rgba(6,182,212,0.18);
  padding: 16px;
">
  <div class="hud-mono mb-1" style="font-size: 11px; letter-spacing: 0.12em; color: #334155;">SECOND_ACTION</div>
  <div style="font-size: 16px; color: #94a3b8; margin-bottom: 14px; line-height: 1.4;">{offerText}</div>

  <div class="flex gap-3">
    <button
      onclick={onAccept}
      class="flex-1 rounded-lg border hud-mono tracking-wider cursor-pointer transition-all"
      style="
        padding: 12px;
        font-size: 14px;
        border-color: rgba(6,182,212,0.35);
        background: rgba(6,182,212,0.08);
        color: #22d3ee;
      "
    >ANO</button>

    <button
      onclick={onDecline}
      class="flex-1 rounded-lg border hud-mono tracking-wider cursor-pointer transition-all"
      style="
        padding: 12px;
        font-size: 14px;
        border-color: rgba(255,255,255,0.06);
        background: transparent;
        color: #334155;
      "
    >NE</button>
  </div>
</div>

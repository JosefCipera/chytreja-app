<script>
  import NodeHeader from './hud/NodeHeader.svelte';
  import LifeBattery from './hud/LifeBattery.svelte';
  import KillerCard from './hud/KillerCard.svelte';
  import ActionProtocol from './hud/ActionProtocol.svelte';
  import SourceCards from './hud/SourceCards.svelte';

  let { data, children, onActionComplete = null } = $props();

</script>

<div class="hud-shell hud-glow hud-scanline relative overflow-hidden hud-fade-in" style="width: 420px; min-height: 100dvh; border-radius: 20px 0 0 20px; overflow-y: auto;">
  <!-- Grid background visible through glass -->
  <div class="absolute inset-0 hud-grid opacity-50"></div>


  <!-- Content above grid -->
  <div class="relative z-10">
    <NodeHeader
      label={data.node_label}
      version={data.node_version}
      onClose={() => window.parent !== window ? window.parent.postMessage('chj:hud:close', '*') : window.history.back()}
    />

    <div class="p-4 space-y-4">
      <div class="hud-fade-in" style="animation-delay: 0.1s">
        <LifeBattery
          percent={data.life_battery.percent}
          trend={data.life_battery.trend_label}
          spanekIndex={data.metrics?.spanek ?? 50}
          vyzivaIndex={data.metrics?.vyziva ?? 50}
          chronoAge={data.user?.chrono_age ?? 40}
          bioAvailableKeys={data.user?.bio_available_keys ?? []}
          biomarkers={data.user?.biomarkers ?? {}}
        />
      </div>

      <div class="hud-fade-in" style="animation-delay: 0.2s">
        {#if data.action}
          <ActionProtocol
            action={data.action}
            killer={data.killer}
            dayType={data.day_type}
            onComplete={() => onActionComplete?.(data.action.id, data.action.type, data.action.node_id)}
          />
        {:else if data.all_done_today}
          <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;">
            <span style="color:#4ade80;font-size:1.1rem;">✔</span>
            <div>
              <div class="hud-mono" style="font-size:14px;letter-spacing:0.1em;color:#4ade80;margin-bottom:2px;">MISSION_COMPLETE</div>
              <div style="font-size:16px;color:#94a3b8;">
                {data.completion_feedback || (data.today_count >= 2 ? 'Pokrok na uzlu.' : 'Pro pokrok na uzlu pokračuj zítra.')}
              </div>
              {#if data.weekly_hint}
                <div style="font-size:13px;color:#475569;margin-top:6px;">{data.weekly_hint}</div>
              {/if}
            </div>
          </div>
        {:else}
          <div style="background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.15);border-radius:10px;padding:14px 16px;">
            <div class="hud-mono" style="font-size:13px;letter-spacing:0.1em;color:#475569;">NO_ACTION_AVAILABLE</div>
            <div style="font-size:15px;color:#64748b;margin-top:4px;">Pro tento uzel zatím nejsou akce.</div>
          </div>
        {/if}
      </div>

      <!-- Connector line: ACTION → SOURCE_VALIDATION -->
      <div style="position: relative; height: 38px; margin: -6px 0 -2px;">
        <div style="
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          transform: translateX(-50%);
          background: linear-gradient(to bottom, transparent, rgba(6,182,212,0.38) 45%, rgba(6,182,212,0.12));
        "></div>
        <!-- mini stars on connector -->
        <span style="position:absolute;left:20%;top:18%;font-size:5px;color:rgba(6,182,212,0.5);line-height:1;user-select:none;">✦</span>
        <span style="position:absolute;left:68%;top:44%;font-size:4px;color:rgba(255,255,255,0.22);line-height:1;user-select:none;">✦</span>
        <span style="position:absolute;right:18%;top:20%;font-size:8px;color:rgba(6,182,212,0.2);line-height:1;user-select:none;">✦</span>
        <span style="position:absolute;left:30%;top:68%;font-size:3px;color:rgba(6,182,212,0.38);line-height:1;user-select:none;">✦</span>
        <!-- glowing dot at bottom -->
        <div style="
          position:absolute;
          left:50%;
          bottom:0;
          transform:translateX(-50%);
          width:5px;
          height:5px;
          border-radius:50%;
          background:rgba(6,182,212,0.65);
          box-shadow:0 0 8px rgba(6,182,212,0.5), 0 0 16px rgba(6,182,212,0.2);
        "></div>
      </div>

      <div class="hud-fade-in" style="animation-delay: 0.4s">
        <SourceCards
          sources={data.sources}
        />
      </div>
    </div>

    {#if children}{@render children()}{/if}

    <!-- System status bar -->
    <div class="px-4 pb-4 pt-0 hud-fade-in" style="animation-delay: 0.5s">
      <div class="flex items-center justify-between px-3 py-2 rounded border border-white/[0.04] bg-black/20" style="backdrop-filter: blur(8px);">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style="box-shadow: 0 0 6px rgba(34,197,94,0.8);"></span>
          <span class="hud-mono tracking-widest" style="font-size: 12px; color: #475569;">SYSTEM_ONLINE</span>
        </div>
        <span class="hud-mono tracking-widest" style="font-size: 12px; color: #334155;">// DATA_ENCRYPTED</span>
        <span class="hud-mono" style="font-size: 12px; color: #334155;">CHJ_v0.2</span>
      </div>
    </div>
  </div>
</div>

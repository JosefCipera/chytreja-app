<script>
  import NodeHeader from './hud/NodeHeader.svelte';
  import LifeBattery from './hud/LifeBattery.svelte';
  import KillerCard from './hud/KillerCard.svelte';
  import ActionProtocol from './hud/ActionProtocol.svelte';
  import SourceCards from './hud/SourceCards.svelte';

  let { data, children } = $props();
</script>

<div class="hud-shell hud-glow hud-scanline w-full relative overflow-hidden hud-fade-in" style="min-height: 100dvh; border-radius: 20px 0 0 20px; overflow-y: auto;">
  <!-- Grid background visible through glass -->
  <div class="absolute inset-0 hud-grid opacity-50"></div>

  <!-- Content above grid -->
  <div class="relative z-10">
    <NodeHeader
      label={data.node_label}
      version={data.node_version}
      onClose={() => window.parent !== window ? window.parent.postMessage('chj:hud:close', '*') : window.history.back()}
    />

    <div class="p-4 space-y-3">
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
        <KillerCard
          label={data.killer.label}
          energyDrain={data.killer.energy_drain}
          description={data.killer.description}
        />
      </div>

      {#if data.action}
      <div class="hud-fade-in" style="animation-delay: 0.3s">
        <ActionProtocol
          action={data.action}
        />
      </div>
      {/if}

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
          <span class="hud-mono text-[10px] text-slate-600 tracking-widest">SYSTEM_ONLINE</span>
        </div>
        <span class="hud-mono text-[10px] text-slate-700 tracking-widest">// DATA_ENCRYPTED</span>
        <span class="hud-mono text-[10px] text-slate-700">CHJ_v0.1</span>
      </div>
    </div>
  </div>
</div>

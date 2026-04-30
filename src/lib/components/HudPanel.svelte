<script>
  import NodeHeader from './hud/NodeHeader.svelte';
  import LifeBattery from './hud/LifeBattery.svelte';
  import KillerCard from './hud/KillerCard.svelte';
  import ActionProtocol from './hud/ActionProtocol.svelte';
  import SourceCards from './hud/SourceCards.svelte';
  import SecondAction from './hud/SecondAction.svelte';
  import HealthUpload from './HealthUpload.svelte';

  let {
    data,
    userId             = null,
    children,
    agentLoading       = false,
    onActionComplete   = null,
    secondOffer        = null,
    secondOfferText    = 'Chceš jít dál?',
    onAcceptSecond     = null,
    onDeclineSecond    = null,
    onDataRefresh      = null,   // called after health doc parsed → refresh HUD
  } = $props();

  let showHealthUpload = $state(false);

  function handleDocParsed(result) {
    showHealthUpload = false;
    if (onDataRefresh) onDataRefresh();
  }
</script>

<div class="hud-shell hud-glow hud-scanline relative overflow-hidden hud-fade-in" style="width: 420px; min-height: 100dvh; border-radius: 20px 0 0 20px; overflow-y: auto;">
  <!-- Grid background visible through glass -->
  <div class="absolute inset-0 hud-grid opacity-50"></div>


  <!-- Content above grid -->
  <div class="relative z-10">
    <NodeHeader
      label={data.node_label}
      version={data.node_version}
      universe={data.universe ?? 'longevity'}
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
          universe={data.universe ?? 'longevity'}
        />
      </div>

      <div class="hud-fade-in" style="animation-delay: 0.2s">
        {#if agentLoading && !data.action}
          <!-- PREPARING only when there is truly no action yet (new node, no DB fallback) -->
          <div style="background:rgba(6,182,212,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px 16px;">
            <div class="hud-mono animate-pulse" style="font-size:13px;letter-spacing:0.1em;color:#06b6d4;margin-bottom:8px;">
              ACTION: PREPARING…
            </div>
            <div style="height:6px;border-radius:3px;background:rgba(6,182,212,0.12);overflow:hidden;">
              <div class="animate-pulse" style="height:100%;width:60%;background:rgba(6,182,212,0.35);border-radius:3px;"></div>
            </div>
          </div>
        {:else if secondOffer === 'pending'}
          <SecondAction
            offerText={secondOfferText}
            onAccept={onAcceptSecond}
            onDecline={onDeclineSecond}
          />
        {:else if data.action && !data.all_done_today && data.today_count < 2}
          <ActionProtocol
            action={data.action}
            killer={data.killer}
            verdict={data.verdict}
            dayType={data.day_type}
            universe={data.universe ?? 'longevity'}
            onComplete={() => onActionComplete?.(data.action.id, data.action.type, data.action.node_id)}
          />
        {:else if secondOffer === 'declined' || data.all_done_today || (data.today_count > 0 && !data.action)}
          <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:16px;">
            <div class="flex items-center gap-2" style="margin-bottom:10px;">
              <span style="color:#4ade80;font-size:1rem;">✔</span>
              <div class="hud-mono" style="font-size:12px;letter-spacing:0.1em;color:#4ade80;">MISSION_COMPLETE</div>
            </div>
            <div style="font-size:18px;color:#e2e8f0;line-height:1.5;font-weight:400;">
              {data.completion_feedback || (data.today_count >= 2 ? 'Pokrok na uzlu.' : 'Pro pokrok na uzlu pokračuj zítra.')}
            </div>
            {#if data.weekly_hint}
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(34,197,94,0.15);font-size:16px;color:#cbd5e1;line-height:1.5;">
                → {data.weekly_hint}
              </div>
            {/if}
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

<!-- Health Document Upload modal -->
{#if showHealthUpload && userId}
  <HealthUpload
    {userId}
    onComplete={handleDocParsed}
    onClose={() => showHealthUpload = false}
  />
{/if}

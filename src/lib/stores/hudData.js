// HUD data store — fetches from /api/hud-data and exposes reactive state

import { writable, derived } from 'svelte/store';

// ── STATE ──────────────────────────────────────────────
export const loading  = writable(true);
export const error    = writable(null);
export const rawData  = writable(null);

// ── DERIVED: HudPanel-compatible nodeData ──────────────
export const nodeData = derived(rawData, ($raw) => {
  if (!$raw) return null;

  return {
    node_id:      $raw.node.id,
    node_label:   $raw.node.label,
    node_version: $raw.node.version,

    life_battery: {
      percent:      $raw.battery.percent,
      trend:        $raw.battery.trend_direction,
      trend_label:  $raw.battery.trend_label,
      cell_vitality: $raw.battery.percent,
    },

    // Pass through for REPAIR_RATE calculation in LifeBattery
    metrics: {
      spanek:  $raw.battery.spanek_index,
      vyziva:  $raw.battery.vyziva_index,
    },

    killer:  $raw.killer,
    action:  $raw.action || null,
    sources: ($raw.sources || []).filter(Boolean),
    verdict: $raw.verdict,

    completion_feedback: $raw.completion_feedback || null,
    weekly_hint:         $raw.weekly_hint || null,

    today_count:    $raw.today_count,
    all_done_today: $raw.all_done_today,
    streak:         $raw.streak,
    day_type:       $raw.day_type || 'STIMUL',
  };
});

// ── FETCH ──────────────────────────────────────────────
export async function loadHudData(userId, nodeId) {
  loading.set(true);
  error.set(null);

  try {
    const res = await fetch(`/api/hud-data?userId=${encodeURIComponent(userId)}&nodeId=${encodeURIComponent(nodeId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    rawData.set(data);
  } catch (err) {
    console.error('[HUD] fetch failed:', err);
    error.set(err.message);
  } finally {
    loading.set(false);
  }
}

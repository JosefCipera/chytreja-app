// POST /api/tools/ultrahuman-parse
// Body: { userId, csvText }
// Parses Ultrahuman Ring CSV export → upserts node_state_history + user_metrics
// Nodes updated: zdravi (HRV, RHR, Recovery), spanek (Sleep, Deep Sleep), telo (Steps)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// ── CSV parser ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      const v = values[i]?.trim();
      row[h] = (v === '' || v === undefined) ? null : v;
    });
    return row;
  }).filter(r => r['Date']);
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function clamp(v) {
  return Math.min(100, Math.max(0, Math.round(v)));
}

// ── Normalization: raw Ultrahuman value → CHJ index (0–100) ──
// HRV (RMSSD ms): 20 ms = 0, 80 ms = 100
function normalizeHRV(v)       { return clamp((v - 20) / 60 * 100); }
// RHR: lower = better. 85 bpm = 0, 40 bpm = 100
function normalizeRHR(v)       { return clamp((85 - v) / 45 * 100); }
// Recovery Score, Sleep Score: already 0–100
function normalizeDirect(v)    { return clamp(v); }
// Deep Sleep (minutes): 90 min = optimal = 100
function normalizeDeepSleep(v) { return clamp(v / 90 * 100); }
// Steps: 10 000 steps = 100
function normalizeSteps(v)     { return clamp(v / 10000 * 100); }

// ── Per-day index computation ─────────────────────────────────
function computeDayIndices(row) {
  const hrv      = toNum(row['Average HRV']);
  const rhr      = toNum(row['Average RHR']);
  const recovery = toNum(row['Recovery Score']);
  const sleep    = toNum(row['Sleep Score']);
  const deep     = toNum(row['Deep Sleep']);
  const steps    = toNum(row['Total Steps']);

  // zdravi: HRV 40% + RHR 30% + Recovery 30%
  const zdraviParts = [];
  if (hrv      !== null) zdraviParts.push({ v: normalizeHRV(hrv),       w: 0.4 });
  if (rhr      !== null) zdraviParts.push({ v: normalizeRHR(rhr),       w: 0.3 });
  if (recovery !== null) zdraviParts.push({ v: normalizeDirect(recovery), w: 0.3 });

  const zdraviIdx = zdraviParts.length
    ? Math.round(
        zdraviParts.reduce((s, p) => s + p.v * p.w, 0) /
        zdraviParts.reduce((s, p) => s + p.w, 0)
      )
    : null;

  // spanek: Sleep Score 60% + Deep Sleep 40%
  const spanekParts = [];
  if (sleep !== null) spanekParts.push({ v: normalizeDirect(sleep),   w: 0.6 });
  if (deep  !== null) spanekParts.push({ v: normalizeDeepSleep(deep), w: 0.4 });

  const spanekIdx = spanekParts.length
    ? Math.round(
        spanekParts.reduce((s, p) => s + p.v * p.w, 0) /
        spanekParts.reduce((s, p) => s + p.w, 0)
      )
    : null;

  // telo: Steps
  const teloIdx = steps !== null ? normalizeSteps(steps) : null;

  return { zdravi: zdraviIdx, spanek: spanekIdx, telo: teloIdx };
}

// ── HANDLER ───────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { userId, csvText } = req.body;
  if (!userId)  return res.status(400).json({ error: 'userId required' });
  if (!csvText) return res.status(400).json({ error: 'csvText required' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // ── Parse CSV ──────────────────────────────────────────────
  const rows = parseCSV(csvText);
  if (!rows.length) return res.status(400).json({ error: 'No rows found in CSV' });

  // ── Build history rows ─────────────────────────────────────
  const historyRows = [];
  for (const row of rows) {
    const date = row['Date'];
    if (!date) continue;
    const indices = computeDayIndices(row);
    for (const [nodeId, idx] of Object.entries(indices)) {
      if (idx === null) continue;
      historyRows.push({ user_id: userId, node_id: nodeId, current_index: idx, date });
    }
  }

  if (!historyRows.length) return res.status(400).json({ error: 'No parseable data in CSV' });

  // ── Upsert node_state_history ──────────────────────────────
  const { error: histErr } = await sb
    .from('node_state_history')
    .upsert(historyRows, { onConflict: 'user_id,node_id,date' });

  if (histErr) return res.status(500).json({ error: histErr.message });

  // ── Compute 7-day average → update user_metrics ───────────
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const nodeIds = ['zdravi', 'spanek', 'telo'];
  const metricsUpsert = [];

  for (const nodeId of nodeIds) {
    const recent = historyRows.filter(r => r.node_id === nodeId && r.date >= since7);
    if (!recent.length) continue;
    const avg = Math.round(recent.reduce((s, r) => s + r.current_index, 0) / recent.length);
    const state = avg <= 40 ? 'RED' : avg <= 70 ? 'YELLOW' : 'GREEN';
    metricsUpsert.push({ user_id: userId, node_id: nodeId, universe: 'longevity', current_index: avg, state });
  }

  if (metricsUpsert.length) {
    const { error: metErr } = await sb
      .from('user_metrics')
      .upsert(metricsUpsert, { onConflict: 'user_id,node_id,universe' });
    if (metErr) return res.status(500).json({ error: metErr.message });
  }

  const NODE_LABELS = { zdravi: 'Zdraví', spanek: 'Spánek', telo: 'Tělo' };

  return res.json({
    ok: true,
    days_imported: new Set(historyRows.map(r => r.date)).size,
    nodes_updated: metricsUpsert.map(m => ({
      node:  m.node_id,
      label: NODE_LABELS[m.node_id] || m.node_id,
      index: m.current_index,
      state: m.state,
    })),
  });
}

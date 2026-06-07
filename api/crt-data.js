// =====================================================
// API ENDPOINT: /api/crt-data.js
// GET /api/crt-data?userId=xxx&role=longevity
//
// Načte CRT šablonu + obarvý uzly dle user_metrics
// Vrátí obohacený strom pro vis.js renderer
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Stav → barva uzlu
const STATE_COLOR = {
  RED:    { bg: '#3d1a1a', border: '#e05252', text: '#f5a0a0' },
  YELLOW: { bg: '#3a2e0a', border: '#d4a017', text: '#f0d060' },
  GREEN:  { bg: '#0f2d1a', border: '#3a9e5f', text: '#6ddb99' },
  GRAY:   { bg: '#1a1f2e', border: '#4a5568', text: '#8ba8b8' },
};

// Typ uzlu → tvar/styl v vis.js
const TYPE_STYLE = {
  golden_box: { shape: 'box', font: { size: 14, bold: true }, borderWidth: 3 },
  cause:      { shape: 'box', font: { size: 12 }, borderWidth: 1 },
  junction:   { shape: 'box', font: { size: 12 }, borderWidth: 2 },
  ude:        { shape: 'box', font: { size: 13, bold: true }, borderWidth: 2, borderDashes: [6,3] },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity' } = req.query;

  // Načti šablonu
  let template;
  try {
    const path = join(__dirname, '..', 'data', 'universes', 'longevity', 'crt-template.json');
    template = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    return res.status(500).json({ error: 'Template not found', detail: e.message });
  }

  // Fetch user_metrics pokud máme userId
  let metricsMap = {}; // node_id → { state, current_index }
  if (userId) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabase
        .from('user_metrics')
        .select('node_id, state, current_index')
        .eq('user_id', userId)
        .eq('universe', 'longevity');
      if (data) {
      data.forEach(m => { metricsMap[m.node_id] = m; });
      console.log('[CRT] metrics found:', Object.keys(metricsMap), 'for userId:', userId);
    }
    } catch (e) {
      console.error('[CRT] metrics fetch error:', e.message);
      // Pokračuj bez dat — uzly budou GRAY
    }
  }

  // Obohať uzly o barvy a vis.js styl
  const visNodes = template.nodes.map(n => {
    const metric = n.node_id ? metricsMap[n.node_id] : null;
    const state  = metric?.state || 'GRAY';
    const color  = n.type === 'golden_box'
      ? { background: '#7a5a00', border: '#f0c040', highlight: { background: '#9a7a00', border: '#f8d870' } }
      : { background: STATE_COLOR[state].bg, border: STATE_COLOR[state].border,
          highlight: { background: STATE_COLOR[state].bg, border: STATE_COLOR[state].border } };

    const typeStyle = TYPE_STYLE[n.type] || TYPE_STYLE.cause;

    return {
      id:    n.id,
      label: n.label,
      level: n.level,
      color,
      font:  { color: n.type === 'golden_box' ? '#f8e080' : STATE_COLOR[state].text, ...typeStyle.font },
      shape: typeStyle.shape,
      borderWidth: typeStyle.borderWidth,
      borderDashes: typeStyle.borderDashes || false,
      margin: 10,
      // Metadata pro frontend
      // Ruční pozice ze šablony — vis.js je respektuje když hierarchical=false
      x: n.x ?? undefined,
      y: n.y ?? undefined,
      fixed: (n.x !== undefined) ? { x: true, y: true } : false,
      _type:    n.type,
      _branch:  n.branch || 'C',
      _node_id: n.node_id,
      _state:   state,
      _index:   metric?.current_index ?? null,
    };
  });

  // Edges: šablona má kořen→efekt, pro BT layout otočíme na efekt←kořen
  // (šipka ukazuje nahoru: příčina dole, důsledek nahoře)
  const visEdges = template.edges.map((e, i) => ({
    id:     `e${i}`,
    from:   e.from,   // nižší level (příčina)
    to:     e.to,     // vyšší level (důsledek)
    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
    color:  { color: '#3a4a5a', highlight: '#6a8aaa' },
    smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
  }));

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    title:     template.title,
    subtitle:  template.subtitle,
    branch_labels: template.branch_labels,
    nodes:     visNodes,
    edges:     visEdges,
    injections: template.injections,
    has_data:  Object.keys(metricsMap).length > 0,
  });
}

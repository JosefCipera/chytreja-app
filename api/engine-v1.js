// POST /api/engine-v1 { userId }
// Returns PERSON_NODE_STATE[] from CHJ Engine v1.
// Runs parallel to old CRT engine — does NOT affect crt-generate.js output.

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
dotenv.config({ path: '.env.local' });

import { runEngine } from './engine/engine.js';
import { requireAuth } from './lib/requireAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid;
  try {
    const result = await runEngine(userId);
    res.json(result);
  } catch (err) {
    console.error('[engine-v1]', err);
    res.status(500).json({ error: err.message });
  }
}

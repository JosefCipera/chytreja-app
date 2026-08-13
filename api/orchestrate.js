// api/orchestrate.js — AI Orchestrator v0.1 endpoint
//
// POST { userId, text, session? }
// → ORCHESTRATOR_RESPONSE { mode, text, buttons, expects_reply, session_updates, debug }
//
// Session state lives with the caller — this endpoint is stateless.
// The caller must merge session_updates into its session store after each call.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { processInput } from './engine/orchestrator.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, text, session = {} } = req.body ?? {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const response = await processInput(userId, text.trim(), session);
    return res.status(200).json(response);
  } catch (err) {
    console.error('[orchestrate] error:', err?.message ?? err);
    return res.status(500).json({ error: 'Internal error', detail: err?.message });
  }
}

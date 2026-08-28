// api/lib/requireAuth.js — Firebase auth middleware
//
// Usage in serverless handlers:
//   const auth = await requireAuth(req, res);
//   if (!auth) return;          // 401/403 already sent
//   const userId = auth.uid;   // authoritative identity
//
// Auth resolution order:
//   1. demo-user-123 without token → allowed (demo account, no real private data)
//   2. Firebase Bearer token: Authorization: Bearer <firebase-id-token>
//
// Consistency check: if client supplies userId that differs from token uid → 403.
// Server always uses decoded.uid — never the raw client userId — for DB queries.
//
// Tests: pass _hooks.verifyIdToken to mock token verification without HTTP.
// No deployed test bypass — impersonation headers are not supported.

import { getAdminAuth } from './firebaseAdmin.js';

const DEMO_UID = 'demo-user-123';

function getClientUserId(req) {
  return req.body?.userId ?? req.query?.userId ?? null;
}

/**
 * Verify Firebase Bearer token and return { uid }.
 * Returns null and sends 401/403 if verification fails.
 *
 * Demo user (demo-user-123) is allowed without a token; all DB queries
 * use auth.uid so demo calls can only touch demo-user-123 data.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @param {{ verifyIdToken?: Function }}   _hooks  – for unit tests only
 */
export async function requireAuth(req, res, _hooks = {}) {
  const clientUserId = getClientUserId(req);

  // ── Demo mode: allow demo-user-123 without token ───────────────────────────
  // Demo UID is a known constant; Firebase never issues it as a real UID.
  // All queries use auth.uid = DEMO_UID, so only demo data is accessible.
  if (clientUserId === DEMO_UID) {
    return { uid: DEMO_UID, demo: true };
  }

  // ── Firebase Bearer token verification ────────────────────────────────────
  const authHeader = req.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Authorization: Bearer <firebase-id-token> required' });
    return null;
  }

  let decoded;
  try {
    const verifyFn = _hooks.verifyIdToken ?? (t => getAdminAuth().verifyIdToken(t));
    decoded = await verifyFn(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    return null;
  }

  // Consistency check — if client supplied userId it must match token uid
  if (clientUserId && clientUserId !== decoded.uid) {
    res.status(403).json({ error: 'userId mismatch: token uid does not match request userId' });
    return null;
  }

  return { uid: decoded.uid };
}

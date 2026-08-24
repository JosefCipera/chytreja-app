// api/lib/firebaseAdmin.js — Firebase Admin SDK singleton
//
// Usage in serverless functions:
//   import { getAdminAuth } from './lib/firebaseAdmin.js';
//   const decoded = await getAdminAuth().verifyIdToken(idToken);
//   // decoded.uid === Firebase UID
//
// Credentials: NEVER committed to repo. Set via Vercel env:
//   Option A (recommended): FIREBASE_SERVICE_ACCOUNT_JSON — full service account JSON stringified
//   Option B: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
//
// Initialization is lazy: error is thrown only on first getAdminAuth() call,
// not on module import — safe for local syntax checks without credentials set.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function ensureInitialized() {
  if (getApps().length > 0) return;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(sa) });
    return;
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  throw new Error(
    'Firebase Admin: credentials not configured. ' +
    'Set FIREBASE_SERVICE_ACCOUNT_JSON or ' +
    'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
}

export function getAdminAuth() {
  ensureInitialized();
  return getAuth();
}

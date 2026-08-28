// app/js/universe/authFetch.js — auth-aware fetch wrapper
//
// Contract:
//   authenticated user  → adds Authorization: Bearer <firebase-id-token>
//   demo user           → sends without token; server demo-bypass allows demo-user-123
//   unauthenticated     → sends without token → server returns 401
//                         callers must handle 401 (redirect to login or show error)
//
// Usage:
//   import { authFetch } from './authFetch.js';
//   const res = await authFetch('/api/endpoint', { method: 'POST', ... });
//   if (res.status === 401) { /* redirect to login */ }
//
// Token is cached by Firebase SDK; getIdToken() auto-refreshes before expiry.
// window.firebaseAuth must be set before authFetch is called (index.html sets it
// via `window.firebaseAuth = getAuth(firebaseApp)` at auth init).

const DEMO_UID = 'demo-user-123';

export async function authFetch(url, options = {}) {
  const user = window.firebaseAuth?.currentUser;

  // Demo user: send without token — server demo-bypass allows demo-user-123.
  if (user?.uid === DEMO_UID) {
    return fetch(url, options);
  }

  // No Firebase session (not logged in): send without token → server returns 401.
  // The caller is responsible for handling the 401 (show login, redirect, etc.).
  if (!user) {
    return fetch(url, options);
  }

  // Authenticated user: attach Bearer token.
  const token = await user.getIdToken(/* forceRefresh= */ false);
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// Expose as global so non-module scripts (launcher.js) can call window.authFetch
// after this module executes. All user-triggered calls happen post-load, so
// window.authFetch is available by the time any fetch is attempted.
window.authFetch = authFetch;

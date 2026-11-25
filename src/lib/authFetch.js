// src/lib/authFetch.js — auth-aware fetch for the HUD iframe
//
// hud.html runs in a same-origin iframe (dev.iting.cz / app.iting.cz), so it can
// read the parent window's Firebase session directly — same pattern already used
// for window.parent._hudCache. No postMessage plumbing needed.
//
// Mirrors app/js/universe/authFetch.js's contract (demo bypass, 401 on missing
// session) for the vanilla-JS side of the app.

export async function authFetch(url, options = {}) {
  try {
    const user = window.parent?.firebaseAuth?.currentUser;
    if (user) {
      const token = await user.getIdToken(/* forceRefresh= */ false);
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Cross-origin guard or token fetch failure — fall through to unauthenticated fetch.
  }
  return fetch(url, options);
}

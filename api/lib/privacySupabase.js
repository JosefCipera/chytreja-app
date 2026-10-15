import { createClient as originalCreateClient } from '@supabase/supabase-js';
import { privacyContext } from './privacyContext.js';
// Read context when the request is made, not when a cached Supabase client is created.
export function createClient(url, key, options = {}) {
 const originalFetch = options.global?.fetch ?? globalThis.fetch;
 const expectedOrigin = new URL(url).origin;
 return originalCreateClient(url, key, {
  ...options, global: {...options.global, fetch: (input, init = {}) => {
   const address = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
   const actor = privacyContext.getStore();
   const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
   // A missing context never grants write permission. Never forward these headers elsewhere.
   headers.delete('x-chj-privacy-uid'); headers.delete('x-chj-privacy-epoch'); headers.delete('x-chj-privacy-scope');
   if(actor && address.origin === expectedOrigin && address.pathname.startsWith('/rest/v1/')) {
    headers.set('x-chj-privacy-uid', actor.uid);
    headers.set('x-chj-privacy-epoch', String(actor.epoch));
    headers.set('x-chj-privacy-scope', actor.scope);
   }
   return originalFetch(input, {...init, headers});
  }}
 });
}

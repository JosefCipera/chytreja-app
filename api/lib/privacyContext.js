import {AsyncLocalStorage} from 'node:async_hooks';
export const privacyContext=new AsyncLocalStorage();
export function makeScopedFetch(originalFetch,origin) {
 return (input,init={})=>{
  const address=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const actor=privacyContext.getStore(),headers=new Headers(init.headers??(input instanceof Request?input.headers:undefined));
  headers.delete('x-chj-privacy-uid');headers.delete('x-chj-privacy-epoch');headers.delete('x-chj-privacy-scope');
  if(actor&&address.origin===origin&&address.pathname.startsWith('/rest/v1/')){
   headers.set('x-chj-privacy-uid',actor.uid);headers.set('x-chj-privacy-epoch',String(actor.epoch));headers.set('x-chj-privacy-scope',actor.scope);
  }
  return originalFetch(input,{...init,headers});
 };
}
// Stable transport, not global actor state. Legacy engine clients opt into the
// same context-aware transport without changing their pure engine/test imports.
if(!globalThis[Symbol.for('chj.privacy.fetch')])Object.defineProperty(globalThis,Symbol.for('chj.privacy.fetch'),{value:(input,init)=>makeScopedFetch(globalThis.fetch,new URL(process.env.SUPABASE_URL).origin)(input,init)});

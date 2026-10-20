import {createClient as originalCreateClient} from '@supabase/supabase-js';
import {makeScopedFetch} from './privacyContext.js';
export function createClient(url,key,options={}) {
 return originalCreateClient(url,key,{...options,global:{...options.global,fetch:makeScopedFetch(options.global?.fetch??globalThis.fetch,new URL(url).origin)}});
}

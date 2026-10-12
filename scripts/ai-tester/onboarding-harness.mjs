// Actual wizard event handlers and request serialization; isolated DOM/API model.
// No Firebase registration, browser layout, live account or private DB access.
import fs from 'node:fs';
import vm from 'node:vm';

export async function runOnboardingFixture(physical, failAction = null) {
  const source = fs.readFileSync(new URL('../../app/js/universe/onboarding-wizard.js', import.meta.url), 'utf8')
    .replace("import { authFetch } from './authFetch.js';", '')
    .replace('export async function checkAndShowOnboarding', 'async function checkAndShowOnboarding');
  const ids = new Map(), pills = [], requests = [];
  let removed = false, reloaded = false;
  const element = () => ({ value: '', dataset: {}, style: {}, listeners: {},
    classList: { add() {}, remove() {}, replace() {} },
    addEventListener(event, handler) { this.listeners[event] = handler; } });
  const overlay = element();
  Object.defineProperty(overlay, 'innerHTML', { set(html) {
    for (const tag of html.matchAll(/<[^>]+>/g)) {
      const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      if (attrs.id) ids.set(attrs.id, element());
      if (attrs['data-phys'] || attrs['data-gender']) {
        const e = element();
        e.dataset = { phys: attrs['data-phys'], val: attrs['data-val'], gender: attrs['data-gender'] };
        pills.push(e);
      }
    }
  } });
  overlay.querySelector = selector => {
    const e = ids.get(selector.slice(1));
    if (!e) throw Error('Onboarding element missing: ' + selector);
    return e;
  };
  overlay.querySelectorAll = selector => {
    if (selector === '[data-gender]') return pills.filter(e => e.dataset.gender);
    if (selector === '[data-phys]') return pills.filter(e => e.dataset.phys);
    const key = selector.match(/^\[data-phys="([^"]+)"\]$/)?.[1];
    if (key) return pills.filter(e => e.dataset.phys === key);
    throw Error('Unknown onboarding selector: ' + selector);
  };
  overlay.remove = () => { removed = true; };
  const ctx = vm.createContext({ document: { createElement: () => overlay, body: { appendChild() {} } },
    window: { location: { reload() { reloaded = true; } } }, setTimeout() {},
    authFetch: async (url, options) => {
      if (url === '/api/user?action=full-profile') return { ok: true, json: async () => ({ profile: { onboarding_completed: false } }) };
      if (!['/api/user?action=wizard-step', '/api/user?action=wizard-complete'].includes(url)) throw Error('Unexpected wizard request: ' + url);
      const body = options?.body ? JSON.parse(options.body) : null;
      requests.push({ url, body });
      return { ok: !(failAction === 'physical' && body?.step === 3) && !(failAction === 'complete' && url.endsWith('wizard-complete')) };
    } });
  vm.runInContext(source, ctx);
  await vm.runInContext("checkAndShowOnboarding('isolated-onboarding')", ctx);
  for (const [key, value] of Object.entries({ 'onb-age': '67', 'onb-height': '178', 'onb-weight': '88', 'onb-waist': '99' })) ids.get(key).value = value;
  await ids.get('onb-next').listeners.click();
  await ids.get('onb-next').listeners.click();
  for (const [key, value] of Object.entries(physical)) {
    const pill = pills.find(e => e.dataset.phys === key && e.dataset.val === String(value));
    if (!pill) throw Error('No actual onboarding answer for ' + key + ': ' + value);
    pill.listeners.click();
  }
  await ids.get('onb-next').listeners.click();
  return { physical: requests.find(r => r.body?.step === 3)?.body.physical, requests, removed, reloaded };
}

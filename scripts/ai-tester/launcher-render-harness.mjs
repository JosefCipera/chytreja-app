// Execute production rendering/loading functions against an isolated DOM model.
// This detects disabled controls and chip wiring; it is not a browser/layout/auth test.
import fs from 'node:fs';
import vm from 'node:vm';

export function createLauncherHarness({ requestFlow = false, speech = false } = {}) {
  const html = fs.readFileSync(new URL('../../app/launcher.html', import.meta.url), 'utf8');
  const start = html.indexOf('  function renderInputEcho(');
  const end = html.indexOf('  // ── Orchestrate', start);
  if (start < 0 || end < 0) throw Error('Launcher render boundary missing');
  const loadingStart = html.indexOf('  function setLoading(on)');
  if (loadingStart < 0) throw Error('Launcher loading function missing');
  const source = html.slice(loadingStart);
  let depth = 0, loadingEnd = -1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) { loadingEnd = i + 1; break; }
  }
  if (loadingEnd < 0) throw Error('Launcher loading boundary missing');
  const element = () => {
    const classes = new Set();
    const e = { disabled: false, children: [], listeners: {}, style: {}, classList: {
      add(...values) { values.forEach(v => classes.add(v)); }, remove(...values) { values.forEach(v => classes.delete(v)); },
      contains(v) { return classes.has(v); }, toggle(v, force = !classes.has(v)) { force ? classes.add(v) : classes.delete(v); return force; },
    }, focus() {},
      appendChild(child) { this.children.push(child); },
      addEventListener(event, handler) { this.listeners[event] = handler; } };
    Object.defineProperty(e, 'innerHTML', { set() { this.children = []; } });
    return e;
  };
  const nodes = Object.fromEntries(['$orb', '$stageSub', '$stageLabel', '$stage', '$chips', '$input', '$sendBtn', '$micBtn', '$inputEcho', '$inputEchoLabel', '$inputEchoText'].map(k => [k, element()]));
  const submitted = [];
  let storedSession = {}, storedResponse = null, nextResponse = null;
  const requests = [], recognizers = [];
  class Recognition { constructor() { recognizers.push(this); } start() {} stop() {} abort() {} }
  const ctx = vm.createContext({ ...nodes, _terminalState: false, _debugMode: false,
    busy: false, requestEpoch: 1, _uid: 'fixture-ui', API_ORCHESTRATE: '/fixture-orchestrate', window: { __chj_userId: 'fixture-ui', SpeechRecognition: speech ? Recognition : undefined },
    loadSession() { return structuredClone(storedSession); },
    loadLastResponse() { return structuredClone(storedResponse); },
    saveSession(value) { storedSession = { ...storedSession, ...structuredClone(value) }; },
    saveLastResponse(value) { storedResponse = structuredClone(value); },
    async authFetch(_url, init) { requests.push(JSON.parse(init.body)); if (nextResponse?.error) throw nextResponse.error;
      return { ok: (nextResponse?.status ?? 200) === 200, status: nextResponse?.status ?? 200,
        json: async () => structuredClone(nextResponse?.body ?? {}) }; },
    setBadge() {}, document: { createElement: element }, orchestrate(text) { submitted.push(text); } });
  vm.runInContext(html.slice(start, end) + '\n' + source.slice(0, loadingEnd), ctx);
  if (requestFlow) vm.runInContext(html.slice(html.indexOf('  async function orchestrate('), loadingStart), ctx);
  if (speech) vm.runInContext(html.slice(html.indexOf('  // ── Mic (Web Speech API)'), html.indexOf('  // ── Init')), ctx);
  const state = () => ({ input_enabled: !nodes.$input.disabled, send_enabled: !nodes.$sendBtn.disabled,
    microphone_enabled: !nodes.$micBtn.disabled, label: nodes.$stageLabel.textContent,
    text: nodes.$stage.textContent, echo: nodes.$inputEchoText.textContent ?? '', echo_label: nodes.$inputEchoLabel.textContent ?? '', echo_visible: !nodes.$inputEcho.classList.contains('hidden'), draft: nodes.$input.value ?? '', chips: nodes.$chips.children.flatMap(g => g.children).map(b => b.textContent) });
  return {
    configure({ session = storedSession, response } = {}) { storedSession = structuredClone(session); nextResponse = response; },
    async submit(text, source = 'text') { if (!requestFlow) throw Error('Request flow not enabled'); ctx.submittedText = text; ctx.inputSource = source; await vm.runInContext('orchestrate(submittedText, undefined, inputSource)', ctx); return state(); },
    async clickRequest(label) { const button = nodes.$chips.children.flatMap(g => g.children).find(b => b.textContent === label); if (!button?.listeners.click) throw Error('Missing chip: ' + label); await button.listeners.click(); return state(); },
    startSpeech() { if (!speech) throw Error('Speech fixture disabled'); nodes.$micBtn.listeners.click(); return recognizers.at(-1); },
    state,
    invalidateSpeech() { vm.runInContext('requestEpoch++; stopRecognition(); renderInputEcho(null);', ctx); },
    idle() { vm.runInContext('renderIdle()', ctx); return state(); },
    storage() { return structuredClone({ session: storedSession, response: storedResponse, requests }); },
    render(response) { ctx.response = response; vm.runInContext('render(response); setLoading(false);', ctx); return state(); },
    loading(on) { ctx.busy = on; vm.runInContext('setLoading(busy);', ctx); return state(); },
    click(label) { const button = nodes.$chips.children.flatMap(g => g.children).find(b => b.textContent === label);
      if (!button?.listeners.click) throw Error('Missing clickable chip: ' + label);
      button.listeners.click(); return submitted.at(-1); },
  };
}

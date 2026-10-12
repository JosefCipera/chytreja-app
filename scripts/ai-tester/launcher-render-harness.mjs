// Execute production rendering/loading functions against an isolated DOM model.
// This detects disabled controls and chip wiring; it is not a browser/layout/auth test.
import fs from 'node:fs';
import vm from 'node:vm';

export function createLauncherHarness() {
  const html = fs.readFileSync(new URL('../../app/launcher.html', import.meta.url), 'utf8');
  const start = html.indexOf('  function render(response)');
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
    const e = { disabled: false, children: [], listeners: {}, classList: { add() {}, remove() {} }, focus() {},
      appendChild(child) { this.children.push(child); },
      addEventListener(event, handler) { this.listeners[event] = handler; } };
    Object.defineProperty(e, 'innerHTML', { set() { this.children = []; } });
    return e;
  };
  const nodes = Object.fromEntries(['$orb', '$stageSub', '$stageLabel', '$stage', '$chips', '$input', '$sendBtn', '$micBtn'].map(k => [k, element()]));
  const submitted = [];
  const ctx = vm.createContext({ ...nodes, _terminalState: false, _debugMode: false,
    setBadge() {}, document: { createElement: element }, orchestrate(text) { submitted.push(text); } });
  vm.runInContext(html.slice(start, end) + '\n' + source.slice(0, loadingEnd), ctx);
  const state = () => ({ input_enabled: !nodes.$input.disabled, send_enabled: !nodes.$sendBtn.disabled,
    microphone_enabled: !nodes.$micBtn.disabled, label: nodes.$stageLabel.textContent,
    text: nodes.$stage.textContent, chips: nodes.$chips.children.flatMap(g => g.children).map(b => b.textContent) });
  return {
    render(response) { ctx.response = response; vm.runInContext('render(response); setLoading(false);', ctx); return state(); },
    loading(on) { ctx.busy = on; vm.runInContext('setLoading(busy);', ctx); return state(); },
    click(label) { const button = nodes.$chips.children.flatMap(g => g.children).find(b => b.textContent === label);
      if (!button?.listeners.click) throw Error('Missing clickable chip: ' + label);
      button.listeners.click(); return submitted.at(-1); },
  };
}

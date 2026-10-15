// Read-only content in the original universe's sidePanel shell.
// Personal HUD, scores, missions and chat require an account and are not loaded here.
const panel = document.getElementById('sidePanel');
export function closePanel() {
  panel.classList.remove('open', 'visible');
  panel.style.display = 'none';
  document.body.classList.remove('panel-open');
}
export function showPanel(node) {
  document.getElementById('nodeTitle').textContent = node.label;
  const content = document.getElementById('ai-integrated-msgs');
  content.replaceChildren();
  const definition = document.createElement('p');
  definition.textContent = node.definition || '';
  content.append(definition);
  if (window.MAIN_UNIVERSE_DATA?.some(n => n.parent === node.id)) {
    const open = document.createElement('button');
    open.className = 'example-open-area';
    open.textContent = 'Otevřít oblast ' + node.label;
    open.onclick = () => window._openExampleArea?.(node.id);
    content.append(open);
  }
  const note = document.createElement('p');
  note.className = 'example-panel-note';
  note.textContent = 'Prohlížíš model Dlouhověkosti. Osobní výsledky ani doporučení zde nejsou vyhodnoceny.';
  content.append(note);
  panel.style.display = 'block';
  panel.classList.add('open', 'visible');
  document.body.classList.add('panel-open');
  panel.scrollTop = 0;
}
document.getElementById('closePanel').textContent = '×';
document.getElementById('closePanel').setAttribute('aria-label', 'Zavřít detail');
document.getElementById('closePanel').onclick = closePanel;

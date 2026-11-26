import { renderUniverse, openSubUniverse, getViewState } from '../universe/universe-core.js';
import { showPanel, closePanel } from './universe-example-panel.js';
import './example-return.js';

// Only this existing model can be opened publicly; no account or role is consulted.
document.getElementById('example-toolbar').hidden = false;
document.title = 'Vesmír Dlouhověkosti — Chytré já';
window.CURRENT_MODEL = 'longevity';
try {
  const response = await fetch('/data/universes/longevity/models/longevity.json');
  if (!response.ok) throw new Error('Mapu Dlouhověkosti se nepodařilo načíst.');
  const model = await response.json();
  window.MAIN_UNIVERSE_DATA = model;
  window.BASE_UNIVERSE_DATA = model;
  const root = model.find(n => n.id === 'dlouhovekost');
  if (!root) throw new Error('V modelu chybí Dlouhověkost.');
  const firstLevel = model.filter(n => n.id === root.id || n.parent === root.id);
  renderUniverse(model, firstLevel, root.id);
  window._openExampleArea = id => {
    const node = model.find(n => n.id === id);
    if (node) { closePanel(); openSubUniverse(model, node); }
  };
  // Existing view-state export is also useful for checking which area is open.
  window._exampleViewState = getViewState;
  showPanel(root);
} catch (error) {
  const message = document.createElement('p');
  message.className = 'example-load-error';
  message.textContent = error.message;
  document.body.append(message);
}

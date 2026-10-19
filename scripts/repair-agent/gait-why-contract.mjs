import assert from 'node:assert/strict';
export function assertGaitScope(text){
  assert.match(text,/nejistot|jistot|chůz/i,'Retain the actual walking concern');
  assert.match(text,/tuk|hmotnost/i,'Name the actual selected adiposity focus');
  // Semantic screen, not a prescribed sentence. Independent Czech content
  // review is required in addition to these program checks.
  assert.match(text,/(?:neřeš(?:í|ím)|nevysvětluj(?:e|i)|neobjasňuj(?:e|i)|nenahrazuj(?:e|i)|neposuzuj(?:e|i)|nezjišťuj(?:e|i)|neurčuj(?:e|i)|neznamená|není.{0,45}(?:vysvětlení|posouzení|vyšetření)|příčin.{0,50}(?:neznám|zatím ne|nemám))/i,'Explicitly distinguish this focus from explaining/assessing the walking problem');
  assert.ok(text.length<=400,'Keep the mobile explanation within 400 characters');
}

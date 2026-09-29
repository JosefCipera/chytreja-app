// test-modification-cs.mjs — C2: Czech translations of modifications_suggested (presentation only)
//
// Scope: buildActResponse must show "Úprava:" ONLY when safety.level === 'SAFE_WITH_MODIFICATION',
// and every English modifications_suggested string that nextBestAction.js can produce today must
// have a Czech translation in orchestrator.js's MODIFICATIONS_CS map. No engine/data change,
// no Founder intervention text, no safety_conditions.
//
// No DB, no network — pure unit tests against real source files.
//
// Sections:
//   M1  SAFE_WITH_MODIFICATION → "Úprava:" present, Czech text
//   M2  SAFE (empty modifications_suggested) → no "Úprava:"
//   M3  SAFE with a stray modifications_suggested entry (defensive) → still no "Úprava:" (gated on level)
//   M4  Every English modifications_suggested literal in nextBestAction.js has a translation
//   M5  No translation in MODIFICATIONS_CS contains a CLAUDE.md §8 forbidden word
//
// Run: node scripts/test-modification-cs.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { _buildActResponse_test as buildActResponse, _localizeMod_test as localizeMod } from '../api/engine/orchestrator.js';

const _dir = dirname(fileURLToPath(import.meta.url));

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

const action = (label, level, modifications_suggested) =>
  ({ label, safety: { level, reason: 'test', modifications_suggested } });

// ── M1 — SAFE_WITH_MODIFICATION shows Czech "Úprava:" ─────────────────────────
sep('M1 — SAFE_WITH_MODIFICATION → "Úprava:" present, translated to Czech');
{
  const dd = { primary_item: action('Tlak nad hlavu', 'SAFE_WITH_MODIFICATION', ['Monitor blood pressure before and after']) };
  const r = buildActResponse(dd, {}, {}, []);
  check(r.text.includes('Úprava:'), 'M1: "Úprava:" present', `text: ${r.text}`);
  check(r.text.includes('Sleduj krevní tlak'), 'M1: modification translated to Czech', `text: ${r.text}`);
  check(!r.text.includes('Monitor blood pressure'), 'M1: no English string in user-facing text', `text: ${r.text}`);
}

// ── M2 — SAFE never shows "Úprava:" ────────────────────────────────────────────
sep('M2 — SAFE (no modifications) → no "Úprava:"');
{
  const dd = { primary_item: action('Chůze 20 minut', 'SAFE', []) };
  const r = buildActResponse(dd, {}, {}, []);
  check(!r.text.includes('Úprava:'), 'M2: no "Úprava:" for SAFE', `text: ${r.text}`);
}

// ── M3 — level gate, not presence gate ────────────────────────────────────────
// Defensive: even if modifications_suggested were non-empty on a SAFE action (should not happen
// per nextBestAction.js contract), presentation must not surface it — the gate is safety.level.
sep('M3 — SAFE with a stray modification entry → still no "Úprava:" (gated on level, not on array length)');
{
  const dd = { primary_item: action('Chůze 20 minut', 'SAFE', ['Stop if discomfort increases']) };
  const r = buildActResponse(dd, {}, {}, []);
  check(!r.text.includes('Úprava:'), 'M3: SAFE suppresses modification text regardless of array content', `text: ${r.text}`);
}

// ── M4 — every English modifications_suggested literal has a translation ─────
// Extracts string literals from nextBestAction.js's `modifications_suggested: [...]` array
// literals and from the `mods = [...]` assignments in evaluateJointLoad. Strings already in
// Czech (contain a Czech diacritic) need no translation entry — only English ones do.
sep('M4 — every English modifications_suggested string in nextBestAction.js has a CS translation');
{
  const src = readFileSync(join(_dir, '../api/engine/nextBestAction.js'), 'utf8');
  const arrayBodies = [];
  const arrayRe = /(?:modifications_suggested|mods)\s*(?::|=)\s*\[([^\]]*)\]/gs;
  let m;
  while ((m = arrayRe.exec(src)) !== null) arrayBodies.push(m[1]);

  const strings = new Set();
  const strRe = /'((?:[^'\\]|\\.)*)'/g;
  for (const body of arrayBodies) {
    let sm;
    while ((sm = strRe.exec(body)) !== null) strings.add(sm[1]);
  }

  check(strings.size >= 24, 'M4: source scan found the expected literal population (>=24)', `found: ${strings.size}`);

  const CZECH_DIACRITICS = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
  const englishStrings = [...strings].filter(s => !CZECH_DIACRITICS.test(s));
  const czechStrings   = [...strings].filter(s => CZECH_DIACRITICS.test(s));

  check(englishStrings.length > 0, 'M4: at least one English string found (sanity check)', `count: ${englishStrings.length}`);

  let missing = [];
  for (const s of englishStrings) {
    const translated = localizeMod(s);
    if (translated === s) missing.push(s);
  }
  check(missing.length === 0, 'M4: every English modifications_suggested string has a CS translation',
    missing.length ? `missing: ${JSON.stringify(missing, null, 2)}` : '');

  // Already-Czech strings must round-trip unchanged (no accidental double-translation entry needed).
  let mistranslated = [];
  for (const s of czechStrings) {
    if (localizeMod(s) !== s) mistranslated.push(s);
  }
  check(mistranslated.length === 0, 'M4: already-Czech strings pass through localizeMod unchanged',
    mistranslated.length ? `changed: ${JSON.stringify(mistranslated, null, 2)}` : '');
}

// ── M5 — forbidden words (CLAUDE.md §8) absent from every translation ────────
sep('M5 — no MODIFICATIONS_CS translation contains a CLAUDE.md §8 forbidden word');
{
  const FORBIDDEN = ['musíš', 'okamžitě', 'je důležité', 'měl bys', 'hrozí', 'ohrožuje',
    'samostatnost', 'závislý', 'pomoc druhých', 'špatně', 'trpí'];

  const src = readFileSync(join(_dir, '../api/engine/orchestrator.js'), 'utf8');
  const mapMatch = src.match(/const MODIFICATIONS_CS = \{([\s\S]*?)\n\};/);
  check(mapMatch !== null, 'M5: MODIFICATIONS_CS map located in source');

  const mapBody = mapMatch ? mapMatch[1] : '';
  const valueRe = /:\s*\n?\s*'((?:[^'\\]|\\.)*)',/g;
  const translations = [];
  let vm;
  while ((vm = valueRe.exec(mapBody)) !== null) translations.push(vm[1]);

  check(translations.length >= 24, 'M5: extracted the expected number of CS translation values (>=24)', `found: ${translations.length}`);

  let offenders = [];
  for (const t of translations) {
    const lower = t.toLowerCase();
    for (const word of FORBIDDEN) {
      if (lower.includes(word.toLowerCase())) offenders.push(`"${t}" contains "${word}"`);
    }
  }
  check(offenders.length === 0, 'M5: no forbidden word found in any translation',
    offenders.length ? offenders.join('\n      ') : '');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-modification-cs: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);

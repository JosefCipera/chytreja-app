import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (report.suite !== 'crt_combinations_endpoint' || report.results.length !== 768) throw Error('Expected complete 768-journey combination report');
const byOutcome = new Map(), reviews = new Map();
for (const c of report.results) {
  if (c.status !== 'BLOCKED' && (!c.matrix || !Array.isArray(c.product_review))) throw Error('Missing review metadata: ' + c.id);
  const key = `${c.leverage?.node_id ?? 'Žádná páka'} / ${c.turns?.[0]?.mode ?? 'BLOCKED'}`;
  byOutcome.set(key, (byOutcome.get(key) ?? 0) + 1);
  for (const item of c.product_review ?? []) {
    const group = reviews.get(item.code) ?? { profiles: new Set(), example: c.id, item };
    group.profiles.add(`${c.matrix.mask}-${c.profile.weight}-${c.matrix.intent}`);
    reviews.set(item.code, group);
  }
}
const lines = [
  '# CRT: automatické průchody', '',
  `Výsledek: ${report.counts.PASS} PASS, ${report.counts.FAIL} FAIL, ${report.counts.BLOCKED} BLOCKED.`,
  '768 průchodů nad 64 profily a dvěma požadavky. Odpovědi Ano/Ne/Nevím a dokončení/přeskočení; některé větve se shodují, pokud otázka nebo akce nenastane.', '',
  `Katalog: ${report.catalog.rows} aktivních akcí; SHA-256 ${report.catalog.sha256}.`, '',
  '| Počáteční páka / odpověď | Průchodů |', '|---|---:|',
  ...[...byOutcome].map(([key, n]) => `| ${key} | ${n} |`), '',
  '| K posouzení produktu | Profilů × požadavků | Příklad |', '|---|---:|---|',
  ...[...reviews].map(([key, r]) => `| ${key} | ${r.profiles.size} | ${r.example} |`), '',
  'CHECKED_ALTERNATIVE: jiná akční větev prošla stejnými bezpečnostními a evidenčními pravidly; globální priorita a její blokace zůstaly zaznamenané. ASSESSMENT_STOP: žádná přípustná alternativa, blokace trvá. GAIT_REQUEST_ADIPOSITY_PRIORITY: globální priorita zůstává tuk; dostupnost dnešního kroku se hodnotí samostatně. EVIDENCE_PENDING / UNMODELED_EVIDENCE: požadavek zůstává k doplnění bez vymýšlení výsledků měření. Tyto položky nejsou klinickým schválením ani automaticky softwarovou chybou.', '',
  'PASS ověřuje zadané údaje, grafové vazby, propojení intervence, čtení vysvětlení, zápisy Hotovo/Přeskočit, návrat a dostupnost ovládání. Nepotvrzuje správnost klinické priority, dávky ani účinnost. Klasifikátor je v této kombinatorické sadě injektovaný; reálná AI se ověřuje v oddělených live sadách. Onboarding, API a DOM používají izolovaná data; registrace a skutečný prohlížeč nejsou testovány.',
];
console.log(lines.join('\n'));

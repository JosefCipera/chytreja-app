import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (r.suite !== 'conversation_changes_endpoint' || r.results.length !== 5) throw Error('Expected five conversation journeys');
const titles = { 'goal-change': 'Změna tématu: hubnutí → nejistota při chůzi', 'answer-correction': 'Oprava odpovědi o vstávání ze země', 'new-medical-fact': 'Nová informace o synkopě', 'return-after-done': 'Nová potíž po dokončení dnešní akce', 'change-after-skip': 'Změna tématu po přeskočení akce' };
console.log('# Pět průchodů Chytrým já k posouzení\n');
console.log(`Režim: ${r.mode}. Automatické průchody skutečným aplikačním kódem nad syntetickými profily; autentizace a databázové zápisy jsou simulované. Nejde o klinické schválení doporučení.\n`);
console.log('Počet výsledků: ' + JSON.stringify(r.counts) + '\n');
for (const x of r.results) {
  console.log('## ' + titles[x.id] + '\n');
  console.log('Výsledek softwarových kontrol: ' + x.status + '.\n');
  let lastDay = null;
  for (const t of x.turns ?? []) {
    if (t.simulated_day && lastDay && t.simulated_day !== lastDay) console.log('**Následující den v simulaci (' + t.simulated_day + ').**\n');
    lastDay = t.simulated_day ?? lastDay;
    console.log('**Uživatel:** ' + t.input + '\n');
    console.log('**Chytré já:** ' + t.text + '\n');
  }
  for (const flag of x.product_review ?? []) console.log('**K posouzení:** ' + flag.code + ' — ' + flag.text + '\n');
}
console.log('## Co posoudit\n');
console.log('- Po opravě odpovědi aplikace přestává používat původní slabost jako důvod. Je pokračování otázkou na nemoci a léky srozumitelné?\n- Při nejistotě chůze model může nabídnout rovnovážné cvičení. Pokyn zavírat oči je odstraněn; varianty se zavřenýma očima a na nestabilní podložce při nejisté chůzi vyžadují individuální posouzení. Vhodnost a délka základního cviku pro konkrétního člověka tím nejsou klinicky schválené.\n- Po hlášení synkopy doporučení zmizí a návrat k hubnutí je neobnoví v tomto rozhovoru. Trvání blokace přes odhlášení není tímto testem ověřeno.\n- Po „Pro dnešek stačí“ aplikace další cvik tentýž den nenabízí. Nové údaje přijímá, i po vymazání stavu klienta; následující den se doporučení vyhodnotí znovu.\n- Po přeskočení akce se původní akce znovu nenabízí a není označena za splněnou.\n');

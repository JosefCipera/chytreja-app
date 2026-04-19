---
description: "Napíše strukturovaný český longevity článek pro CHJ app (Medicine 3.0)"
argument-hint: "<téma> [pro uzel <node_id>]"
---

# CHJ Article Writer

Napiš longevity článek pro CHJ (Chytré Já) app. Téma: **$ARGUMENTS**

## Longevity Nodes

| ID | Témata |
|----|--------|
| `sila` | dead hang, grip, farmer's carry, RDL |
| `kardio` | Zone 2, VO2max, HRV |
| `mysl` | spánek, stres, neuroplasticita |
| `vyziva` | protein, půst, metabolická flexibilita |
| `zdravi` | markery, prevence |
| `metabolicke` | inzulín, tělesná kompozice |

## Killers

| HUD Label | Oblast |
|-----------|--------|
| SRDCE | kardiovaskulární zdraví |
| IMUNITA | imunitní odolnost |
| MOZEK | neurodegenerace |
| METABOLISMUS | metabolický syndrom |

## Struktura článku

Napiš článek přesně v tomto formátu:

# [Název — aktivní, motivující, max 10 slov]

**Perex:** [2–3 věty. Proč klíčové pro dlouhověkost. Fakta, ne sliby.]

## Co to je
[1–2 odstavce. Stručný popis srozumitelný pro začátečníka.]

## Proč to funguje
[2–3 odstavce. Mechanismus v těle. Medicine 3.0 — fyziologická adaptace, healthspan, ne jen fitness.]

## Jak na to
[Praktické kroky. Konkrétní: délka, frekvence, progrese. Od nuly.]

## CHJ Tip
> [Jedna věta, max 15 slov. Přímočará, motivující. Tykání.]

---

**Node:** `[node_id]`
**Killer:** `[SRDCE | IMUNITA | MOZEK | METABOLISMUS]`
**Med IDs:** `MED_ID:[XXX]`, `MED_ID:[XXX]`, `MED_ID:[XXX]`

---

## Pravidla stylu

**Zakázaná slova:** musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, trpí

**Žádné názvy nemocí:** infarkt → oslabení SRDCE, diabetes → problémy s METABOLISMEM, Alzheimer → ztráta funkce MOZKU

**Med IDs:** vygeneruj 2–3 realistické reference jako `MED_ID:NNN` (třímístné číslo).

**Medicine 3.0:** Ne o tom jak vypadat ve 40 — ale být schopný a soběstačný v 80.

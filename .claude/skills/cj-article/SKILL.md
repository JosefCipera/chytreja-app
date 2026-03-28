---
name: cj-article
description: Writes a structured Czech longevity/health article for the CHJ app. Use when the user invokes /cj-article or asks to write a CHJ longevity article about a topic.
user-invocable: true
argument-hint: <téma> [pro uzel <node_id>]
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

# [Název — aktivní, motivující, max 10 slov]

**Perex:** [2–3 věty. Proč klíčové pro dlouhověkost. Fakta, ne sliby.]

## Co to je
[1–2 odstavce. Stručný popis srozumitelný pro začátečníka.]

## Proč to funguje
[2–3 odstavce. Mechanismus v těle. Medicine 3.0 — fyziologická adaptace, healthspan.]

## Jak na to
[Praktické kroky. Konkrétní: délka, frekvence, progrese. Od nuly.]

## CHJ Tip
> [Jedna věta, max 15 slov. Přímočará, motivující. Tykání.]

---

**Node:** `[node_id]`
**Killer:** `[SRDCE | IMUNITA | MOZEK | METABOLISMUS]`
**Med IDs:** `MED_ID:[XXX]`, `MED_ID:[XXX]`, `MED_ID:[XXX]`

---

## Pravidla

**Zakázaná slova:** musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, trpí

**Žádné názvy nemocí:** infarkt → oslabení SRDCE, diabetes → problémy s METABOLISMEM

**Med IDs:** 2–3 reference jako `MED_ID:NNN`.

**Medicine 3.0:** Být schopný a soběstačný v 80, ne jen fit ve 40.

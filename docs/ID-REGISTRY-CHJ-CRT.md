# Registr identifikátorů: engine (CHJ) ↔ CRT

Stav: **návrh k potvrzení, bez změny kódu.** Sestaveno 20. 10. 2026 z `data/engine/master.json` (16 uzlů, 17 hran) a `data/crt/longevity-states.json` (36 stavů). Rozsah: jen CHJ a CRT; Vesmír později.
Účel: odpovědět, který uzel enginu je který stav v CRT, aby se z odpovědi CHJ dalo otevřít CRT na konkrétním problému (`crt.html?focus=<stav>`).

Stavy shody: **JISTÁ** (stejný identifikátor) · **PRAVDĚPODOBNÁ** (shoda podle názvu a role, čeká na potvrzení) · **ŽÁDNÁ** (protějšek v CRT není).

## 1 Uzly enginu → stav v CRT
| Uzel enginu | Stav v CRT | Shoda | Poznámka |
|---|---|---|---|
| `ATHEROSCLEROSIS` | `ATHEROSCLEROSIS` | JISTÁ | |
| `DYSLIPIDEMIA` | `DYSLIPIDEMIA` | JISTÁ | |
| `ENDOTHELIAL_DYSFUNCTION` | `ENDOTHELIAL_DYSFUNCTION` | JISTÁ | |
| `ERECTILE_DYSFUNCTION` | `ERECTILE_DYSFUNCTION` | JISTÁ | V enginu `RISK_MARKER_FOR` k CV nemoci, v CRT vrcholový UDE. |
| `HYPERTENSION` | `HYPERTENSION` | JISTÁ | |
| `INSULIN_RESISTANCE` | `INSULIN_RESISTANCE` | JISTÁ | |
| `PERIPHERAL_NEUROPATHY` | `PERIPHERAL_NEUROPATHY` | JISTÁ | |
| `PHYSICAL_DECONDITIONING` | `PHYSICAL_DECONDITIONING` | JISTÁ | |
| `GAIT_INSTABILITY` | `GAIT_INSTABILITY` | JISTÁ | V CRT typ `junction` (AND-join), v enginu funkční stav. |
| `FALL_RISK` | `FALL_RISK` | JISTÁ ID, **význam se liší** | CRT: „Riziko pádu se zlomeninou", engine: „Riziko pádu". |
| `EXCESS_ADIPOSITY` | `OBESITY` | PRAVDĚPODOBNÁ | Engine pojmenovává tuk jako stav, CRT jako obezitu. |
| `LOW_MUSCLE_STRENGTH` | `MUSCLE_WEAKNESS` | PRAVDĚPODOBNÁ | Role v řetězci se liší (viz oddíl 3). |
| `PHYSICAL_INACTIVITY` | `INACTIVITY_ROOT` a `SEDENTARY_LIFESTYLE_ROOT` | PRAVDĚPODOBNÁ, **dvojí** | Jeden uzel enginu odpovídá dvěma kořenům CRT. |
| `REDUCED_FUNCTIONAL_RESERVE` | — | ŽÁDNÁ | `FUNCTIONAL_DECLINE` je výsledek (křehkost), ne rezerva. |
| `LOSS_OF_FLOOR_RISE_ABILITY` | — | ŽÁDNÁ | Goal Gateway; blízko je `FUNCTIONAL_DECLINE` (viz oddíl 4). |
| `CARDIOVASCULAR_DISEASE` | — | ŽÁDNÁ | Souhrnný cíl; v CRT jsou jednotlivé UDE (`STROKE_RISK`, `CARDIAC_FAILURE_RISK`, `ATRIAL_FIBRILLATION`). |

Souhrn: 10 jistých, 3 pravděpodobné (jedna dvojí), 3 žádné.

## 2 Stavy v CRT bez protějšku v enginu (22)
Bez uzlu v enginu zatím; nic z nich se do enginu nepřidává bez důkazu, že chybí významná cesta.
- **Funkce a Decathlon:** `LOW_VO2MAX` (disciplína 5), `BONE_DENSITY_LOSS` (disciplína 10), `MOBILITY_DEFICIT`, `FUNCTIONAL_DECLINE`, `MUSCULOSKELETAL_DEG`, `FATIGUE_LOW_CAPACITY`
- **Srdce a cévy:** `STROKE_RISK`, `CARDIAC_FAILURE_RISK`, `ATRIAL_FIBRILLATION`, `PALPITATIONS`, `VASCULAR_STIFFNESS`, `CARDIAC_IRRITABILITY`
- **Metabolika a zánět:** `METABOLIC_HEALTH_ROOT`, `HYPERURICEMIA`, `INFLAMMAGING`
- **Ostatní:** `CHRONIC_STRESS`, `SYMPATHETIC_OVERACTIVATION`, `DEPRESSION_ANXIETY`, `SLEEP_DISORDER`, `HYPOTHYROIDISM`, `LOW_TESTOSTERONE`, `NEUROMOTOR_DYS`

## 3 Hrany: engine vs. CRT
Z 17 hran enginu je v CRT (jako `typical_children`) **9**. Zbylých 8:
| Hrana v enginu | Důvod |
|---|---|
| `PHYSICAL_INACTIVITY → INSULIN_RESISTANCE` | v CRT chybí |
| `PHYSICAL_DECONDITIONING → LOW_MUSCLE_STRENGTH` | v CRT chybí |
| `ENDOTHELIAL_DYSFUNCTION → ATHEROSCLEROSIS` | v CRT chybí (v CRT jde ateroskleróza do `VASCULAR_STIFFNESS`) |
| `LOW_MUSCLE_STRENGTH → GAIT_INSTABILITY` | v CRT chybí: nestabilitu tam živí degenerace pohybového aparátu a neuropatie, ne svalová slabost |
| `LOW_MUSCLE_STRENGTH → REDUCED_FUNCTIONAL_RESERVE` | uzel bez protějšku |
| `REDUCED_FUNCTIONAL_RESERVE → LOSS_OF_FLOOR_RISE_ABILITY` | uzel bez protějšku |
| `ATHEROSCLEROSIS → CARDIOVASCULAR_DISEASE` | uzel bez protějšku |
| `ERECTILE_DYSFUNCTION → CARDIOVASCULAR_DISEASE` | uzel bez protějšku |

Důležité pro stabilitu: **CRT zná z funkčních cest jen neuropatii.** Cesta přes svalovou sílu (`LOW_MUSCLE_STRENGTH → GAIT_INSTABILITY`) je jen v enginu. Pokud se z odpovědi CHJ otevře CRT na `GAIT_INSTABILITY`, člověk uvidí jen příčiny přes neuropatii a degeneraci, ne přes svaly.

## 4 Poznámky
- Goal Gateway `LOSS_OF_FLOOR_RISE_ABILITY` má v `goalGateways.js` `pathway_threat: FRAILTY_FUNCTIONAL_DECLINE`. To je blízko UDE `FUNCTIONAL_DECLINE` (křehkost) v CRT. Navrhuji ho mapovat jako cíl větve, ne jako uzel (potvrdit).
- Dva kořeny `INACTIVITY_ROOT` a `SEDENTARY_LIFESTYLE_ROOT` v CRT pokrývají jeden uzel enginu `PHYSICAL_INACTIVITY`. Je to duplicita v CRT, ne v enginu; sloučení by měnilo zlatá CRT, proto se nenavrhuje.
- Zlatá CRT Josefa a Kovářové se tímto dokumentem nemění.

## K potvrzení (Josef)
1. Tři pravděpodobné shody (`OBESITY`, `MUSCLE_WEAKNESS`, oba kořeny nečinnosti).
2. Zda `FUNCTIONAL_DECLINE` mapovat na cíl větve `FUNCTIONAL_INDEPENDENCE`.
3. Zda `REDUCED_FUNCTIONAL_RESERVE` a `LOSS_OF_FLOOR_RISE_ABILITY` zůstanou v CRT bez uzlu, nebo se přidají do State Dictionary (změna CRT, vyžaduje ověření na obou zlatých případech).
4. Co dělat s hranou `LOW_MUSCLE_STRENGTH → GAIT_INSTABILITY`, která je v enginu a ne v CRT (úprava CRT, ne enginu).

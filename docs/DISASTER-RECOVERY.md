# Chytré já — Disaster Recovery

> Praktický dokument pro obnovu aplikace po katastrofálním selhání.

---

## Recovery sources

### A) APPLICATION

Zdrojový kód aplikace je plně v Gitu:

- **GitHub** — `origin/main` je primární zdroj pravdy pro kód
- **Vercel deployments** — každý push na `main` deployuje na `dev.iting.cz`; rollback přes Vercel dashboard

### B) DATABASE SCHEMA

Schema lze rekonstruovat ze dvou zdrojů:

1. **`migrations/` v repozitáři** — SQL migrace v chronologickém pořadí
2. **Logický dump** — obsahuje kompletní schema včetně RLS, policies, funkcí, triggerů, ACL a sekvencí

> **Poznámka:** Historické P2 RLS migrace (Wave 3A–3F) byly aplikovány ručně přes Supabase SQL Editor. Odpovídající migration files existují v `migrations/` a jsou zdrojem pravdy pro tyto změny.

> **`migrations/20260429_enable_rls.sql` je SUPERSEDED / DO NOT RUN** — byl nahrazen wave-level migracemi.

### C) DATABASE DATA

**GOOD STATE logical PostgreSQL dump:**

| Atribut | Hodnota |
|---|---|
| Datum | 2026-09-01 |
| Nástroj | `pg_dump` 17.11, custom format (`-Fc`), gzip |
| Stav | ARCHIVE VERIFIED |
| RESTORE VERIFIED | NO — restore test zatím nebyl proveden |
| Obsah | schema + TABLE DATA + functions + views + triggers + policies + RLS + ACL + sequences + constraints + indexes (1000 TOC entries) |
| Lokace | external/local backup storage outside repository |
| Checksum | SHA-256 verified (MATCH) |

> **VAROVÁNÍ:** Dump obsahuje PRIVATE USER DATA.  
> Dump **NESMÍ** být commitnut do Git/GitHub ani jiného sdíleného repozitáře.

> **Supabase FREE plán nemá scheduled project backups** — zálohy jsou pouze manuální.

---

## Backup verification

Před jakýmkoliv restore ověř integritu dumpu:

```bash
# 1. Ověř čitelnost archive a seznam objektů
pg_restore --list backup.dump

# 2. Zkontroluj přítomnost klíčových tabulek v listu
#    (user_profiles, user_metrics, user_health_profile, longevity_nodes, ...)

# 3. Zkontroluj přítomnost typů objektů:
#    TABLE, TABLE DATA, FUNCTION, VIEW, TRIGGER, POLICY, ROW SECURITY,
#    ACL, SEQUENCE, CONSTRAINT, INDEX

# 4. Ověř SHA-256 checksum
#    Linux/Mac:
sha256sum backup.dump
#    Windows PowerShell:
(Get-FileHash backup.dump -Algorithm SHA256).Hash.ToLower()
# Porovnej s hodnotou v .sha256 souboru
```

> **ARCHIVE VERIFIED ≠ RESTORE VERIFIED.**  
> Čitelnost archive nezaručuje úspěšný restore. Restore test je nutné provést separátně na disposable DB.

---

## Recovery procedure

**Nikdy nezačínat restore přepsáním production DB.**

### Pořadí:

1. **Vytvořit NEW / disposable PostgreSQL databázi nebo Supabase projekt**
   - Nikdy restore přímo do produkce
   - Disposable instance pro ověření

2. **Provést restore dumpu**
   ```bash
   pg_restore --no-owner --no-privileges -d "postgres://..." backup.dump
   ```

3. **Ověřit po restore:**
   - Schema: tabulky, funkce, triggery, views
   - Data: row counts klíčových tabulek
   - RLS: ENABLE RLS stav na privátních tabulkách
   - Policies: RLS policies přítomny / chybějí dle očekávání
   - Functions: SECURITY INVOKER / DEFINER status

4. **Smoke test aplikace na disposable DB:**
   - Nastavit aplikaci na disposable connection
   - Otestovat kritické cesty (login, načtení dat, zápis)

5. **Přepnout prostředí aplikace — až po ověření:**
   - Aktualizovat `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` v Vercel
   - Otestovat na `dev.iting.cz` před přepnutím produkce

---

## Backup policy until Supabase Pro

Dokud není dostupný scheduled backup (Supabase Pro):

- **GOOD STATE snapshot** před každým významným DB/schema zásahem (migrací, RLS lockdownem, strukturální změnou)
- **Periodický snapshot** podle hodnoty aktuálních reálných dat — minimálně před každým produkčním deploymentem se změnou DB
- **Minimálně dvě bezpečné kopie** uloženy na různých fyzických místech (např. lokální disk + šifrované cloud storage)
- Backup obsahující user data je **citlivý dokument** — zacházet jako s osobními daty
- **Nikdy Git/GitHub** — dump nikdy nesmí být commitnut do repozitáře

---

> Canonical docs: `CLAUDE.md`, `CHJ-ENGINE-ARCHITECTURE.md`, `CHJ-PRODUCT-ARCHITECTURE.md`

-- =====================================================
-- CHJ: User Mode via primary_goal
-- Datum: 2026-04-27
--
-- Záměr: primary_goal určuje produkt tier.
--   'dekatlon'  = startovní podmnožina Longevity
--   'longevity' = plný přístup
--
-- Existující uživatelé mají primary_goal = 'longevity'
-- (nastaveno onboardingem) → žádná změna potřeba.
-- Noví uživatelé dostanou 'dekatlon' v onboardingu.
-- =====================================================

-- Dokumentační komentář (žádná strukturální změna nutná)
COMMENT ON COLUMN user_profiles.primary_goal IS
  'Produkt tier: dekatlon = startovni podmnozina Longevity, longevity = plny pristup';

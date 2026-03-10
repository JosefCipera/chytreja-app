-- =====================================================
-- Diagnostika + fix přístupu pro node_state_history
-- Spusť v Supabase SQL editoru
-- =====================================================

-- 1) DIAGNOSTIKA – co je v tabulce?
SELECT user_id, node_id, date, state
FROM public.node_state_history
LIMIT 10;

-- 2) DIAGNOSTIKA – jaká oprávnění má anon role?
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'node_state_history';

-- 3) FIX – přidej SELECT oprávnění pro anon a authenticated
-- (RLS disabled = politiky se ignorují, ale tabulkové granty platí!)
GRANT SELECT ON TABLE public.node_state_history TO anon;
GRANT SELECT ON TABLE public.node_state_history TO authenticated;

-- Ověření po grantu:
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'node_state_history'
  AND grantee IN ('anon', 'authenticated');

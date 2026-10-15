-- Read-only schema metadata only. Does not select profiles or health values.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,current_setting('transaction_read_only') AS read_only;
-- Only schema metadata; no dynamic SQL and no application RPC invocation.
SELECT table_schema,table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
 AND column_name IN ('user_id','owner_id','firebase_uid','firebase_user_id','uid')
ORDER BY table_schema,table_name,column_name;
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname='public' ORDER BY c.relname;
SELECT conrelid::regclass AS child,confrelid::regclass AS parent,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' ORDER BY conrelid::regclass::text,conname;
SELECT schemaname,tablename,policyname,roles,cmd,permissive
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
-- Mixed/indirect ownership candidates still require manual classification.
SELECT table_schema,table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema='public' AND (data_type IN ('json','jsonb') OR column_name IN ('email','profile_id','account_id','session_id','conversation_id','parent_id'))
ORDER BY table_schema,table_name,column_name;
-- Storage metadata exists? This does not read object names or customer files.
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') AS supabase_storage_schema_present;
-- Run storage bucket/ownership inventory using the Storage API separately.
-- If installed, additionally inspect chj_privacy_registry and call chj_privacy_schema_check().
ROLLBACK;

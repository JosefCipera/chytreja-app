-- Additive, explicit deployment migration. Never run against a live database as a test.
-- No historic consent is manufactured. No user/profile row is deleted by this migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.chj_privacy_accounts (
 uid text PRIMARY KEY CHECK(length(uid) BETWEEN 1 AND 128),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','withdrawn','deleting','deleted')),
 epoch bigint NOT NULL DEFAULT 0,
 adult boolean NOT NULL DEFAULT false,
 health_version text, terms_version text, policy_version text,
 granted_at timestamptz, withdrawn_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chj_privacy_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uid text NOT NULL,
 event text NOT NULL CHECK(event IN ('grant','withdraw','delete_request')),
 health_version text, terms_version text, policy_version text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chj_privacy_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uid text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('health','account')),
 stage text NOT NULL DEFAULT 'queued' CHECK(stage IN ('queued','storage','database','identity','external_review','complete')),
 receipt_hash text, lease_id uuid, locked_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 requested_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 last_error_code text, external_reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS chj_privacy_one_pending_job ON public.chj_privacy_jobs(uid,kind) WHERE stage<>'complete';
CREATE TABLE IF NOT EXISTS public.chj_privacy_registry (
 schema_name name NOT NULL, table_name name NOT NULL, owner_column name NOT NULL,
 scope text NOT NULL CHECK(scope IN ('health','account')),
 PRIMARY KEY(schema_name,table_name)
);
ALTER TABLE public.chj_privacy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chj_privacy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chj_privacy_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chj_privacy_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chj_privacy_accounts,public.chj_privacy_events,public.chj_privacy_jobs,public.chj_privacy_registry FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.chj_privacy_accounts,public.chj_privacy_events,public.chj_privacy_jobs,public.chj_privacy_registry TO service_role;

CREATE OR REPLACE FUNCTION public.chj_privacy_status(p_uid text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.chj_privacy_accounts;
BEGIN
 IF p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'INVALID_UID'; END IF;
 SELECT * INTO a FROM public.chj_privacy_accounts WHERE uid=p_uid;
 IF a.uid IS NULL THEN RETURN jsonb_build_object('status','pending','epoch',0,'adult',false,'cleanup_pending',false); END IF;
 RETURN to_jsonb(a)-'uid'||jsonb_build_object('cleanup_pending',EXISTS(SELECT 1 FROM public.chj_privacy_jobs WHERE uid=p_uid AND stage<>'complete'));
END $$;

CREATE OR REPLACE FUNCTION public.chj_privacy_change(p_uid text,p_action text,p_health text DEFAULT NULL,p_terms text DEFAULT NULL,p_policy text DEFAULT NULL,p_adult boolean DEFAULT false,p_receipt_hash text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.chj_privacy_accounts; job public.chj_privacy_jobs; job_kind text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_uid,8152026));
 IF p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'INVALID_UID'; END IF;
 INSERT INTO public.chj_privacy_accounts(uid) VALUES(p_uid) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.chj_privacy_accounts WHERE uid=p_uid FOR UPDATE;
 IF a.status IN ('deleting','deleted') AND p_action<>'delete' THEN RAISE EXCEPTION 'ACCOUNT_DELETING'; END IF;
 IF p_action='grant' THEN
  IF p_adult IS NOT TRUE OR p_health<>'health-2026-10-15-v1' OR p_terms<>'terms-2026-10-15-v1' OR p_policy<>'privacy-2026-10-15-v1' OR p_health IS NULL OR p_terms IS NULL OR p_policy IS NULL THEN RAISE EXCEPTION 'INVALID_CONSENT'; END IF;
  IF EXISTS(SELECT 1 FROM public.chj_privacy_jobs WHERE uid=p_uid AND stage<>'complete') THEN RAISE EXCEPTION 'CLEANUP_PENDING'; END IF;
  UPDATE public.chj_privacy_accounts SET status='active',epoch=epoch+1,adult=true,health_version=p_health,terms_version=p_terms,policy_version=p_policy,granted_at=now(),updated_at=now() WHERE uid=p_uid;
  INSERT INTO public.chj_privacy_events(uid,event,health_version,terms_version,policy_version) VALUES(p_uid,'grant',p_health,p_terms,p_policy);
  RETURN public.chj_privacy_status(p_uid);
 ELSIF p_action IN ('withdraw','delete') THEN
  job_kind:=CASE WHEN p_action='delete' THEN 'account' ELSE 'health' END;
  IF p_action='delete' AND (p_receipt_hash IS NULL OR length(p_receipt_hash)<>64) THEN RAISE EXCEPTION 'INVALID_RECEIPT'; END IF;
  UPDATE public.chj_privacy_accounts SET status=CASE WHEN p_action='delete' THEN 'deleting' ELSE 'withdrawn' END,epoch=epoch+1,withdrawn_at=now(),updated_at=now() WHERE uid=p_uid;
  INSERT INTO public.chj_privacy_events(uid,event) VALUES(p_uid,CASE WHEN p_action='delete' THEN 'delete_request' ELSE 'withdraw' END);
  INSERT INTO public.chj_privacy_jobs(uid,kind,receipt_hash) VALUES(p_uid,job_kind,p_receipt_hash)
   ON CONFLICT(uid,kind) WHERE stage<>'complete' DO UPDATE SET receipt_hash=COALESCE(EXCLUDED.receipt_hash,chj_privacy_jobs.receipt_hash),updated_at=now() RETURNING * INTO job;
  RETURN public.chj_privacy_status(p_uid)||jsonb_build_object('job_id',job.id);
 END IF;
 RAISE EXCEPTION 'INVALID_PRIVACY_ACTION';
END $$;

-- Defense against late writes, even when the request started before withdrawal.
-- Service-role bypasses RLS, so the trigger must check the per-request epoch too.
CREATE OR REPLACE FUNCTION public.chj_privacy_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE h jsonb; a public.chj_privacy_accounts; own text; required_scope text;
BEGIN
 IF current_setting('chj.privacy_internal',true)='1' THEN RETURN NEW; END IF;
 h:=COALESCE(NULLIF(current_setting('request.headers',true),''),'{}')::jsonb;
 own:=to_jsonb(NEW)->>TG_ARGV[0]; required_scope:=TG_ARGV[1];
 IF own IS NULL THEN RAISE EXCEPTION 'PRIVACY_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(own,8152026));
 SELECT * INTO a FROM public.chj_privacy_accounts WHERE uid=own;
 IF a.uid IS NULL OR a.status IN ('deleting','deleted') OR h->>'x-chj-privacy-uid' IS DISTINCT FROM own
   OR h->>'x-chj-privacy-epoch' IS DISTINCT FROM a.epoch::text THEN
  RAISE EXCEPTION 'PRIVACY_WRITE_BLOCKED' USING ERRCODE='42501';
 END IF;
 IF required_scope='health' AND (a.status<>'active' OR a.adult IS NOT TRUE OR a.health_version IS DISTINCT FROM 'health-2026-10-15-v1' OR h->>'x-chj-privacy-scope' IS DISTINCT FROM 'health') THEN
  RAISE EXCEPTION 'HEALTH_CONSENT_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Changing a row's owner is never an allowed side effect of an app request.
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)->>TG_ARGV[0]) IS DISTINCT FROM own THEN RAISE EXCEPTION 'PRIVACY_OWNER_CHANGE' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.chj_privacy_refresh_registry() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; n integer:=0; scope_name text;
BEGIN
 FOR r IN SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS owner_column
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT LIKE 'chj_privacy_%' AND a.attname='user_id'
 LOOP
  scope_name:=CASE WHEN r.table_name LIKE 'toc_%' THEN 'account' ELSE 'health' END;
  INSERT INTO public.chj_privacy_registry VALUES(r.schema_name,r.table_name,r.owner_column,scope_name)
   ON CONFLICT(schema_name,table_name) DO UPDATE SET owner_column=EXCLUDED.owner_column;
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.schema_name,r.table_name);
  EXECUTE format('DROP POLICY IF EXISTS chj_privacy_no_direct_access ON %I.%I',r.schema_name,r.table_name);
  EXECUTE format('CREATE POLICY chj_privacy_no_direct_access ON %I.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false)',r.schema_name,r.table_name);
  EXECUTE format('DROP TRIGGER IF EXISTS chj_privacy_write_guard ON %I.%I',r.schema_name,r.table_name);
  EXECUTE format('CREATE TRIGGER chj_privacy_write_guard BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.chj_privacy_write_guard(%L,%L)',r.schema_name,r.table_name,r.owner_column,scope_name);
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;

-- Refuse to certify a purge when a dependent table has no reviewed ownership rule.
CREATE OR REPLACE FUNCTION public.chj_privacy_schema_check() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uncovered jsonb; stale jsonb;
BEGIN
 SELECT COALESCE(jsonb_agg(DISTINCT c.conrelid::regclass::text),'[]') INTO uncovered
 FROM pg_constraint c JOIN public.chj_privacy_registry p ON c.confrelid=to_regclass(format('%I.%I',p.schema_name,p.table_name))
 WHERE c.contype='f' AND NOT EXISTS(SELECT 1 FROM public.chj_privacy_registry child WHERE to_regclass(format('%I.%I',child.schema_name,child.table_name))=c.conrelid);
 SELECT COALESCE(jsonb_agg(c.relname),'[]') INTO stale FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname IN ('user_id','owner_id','firebase_uid','firebase_user_id','uid') AND NOT a.attisdropped
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT LIKE 'chj_privacy_%'
 AND NOT EXISTS(SELECT 1 FROM public.chj_privacy_registry r WHERE r.schema_name=n.nspname AND r.table_name=c.relname);
 RETURN jsonb_build_object('unreviewed_dependents',uncovered,'unregistered_tables',stale,'ready',uncovered='[]'::jsonb AND stale='[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.chj_privacy_purge_rows(p_uid text,p_kind text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.chj_privacy_accounts; r record; fk record; child public.chj_privacy_registry; parent public.chj_privacy_registry;
 remaining integer; before_count bigint; affected bigint; pass integer; progress boolean; result jsonb:='{}'; join_sql text; conflict boolean;
BEGIN
 IF p_kind NOT IN ('health','account') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_uid,8152026));
 SELECT * INTO a FROM public.chj_privacy_accounts WHERE uid=p_uid FOR UPDATE;
 IF a.uid IS NULL OR (p_kind='account' AND a.status<>'deleting') OR (p_kind='health' AND a.status NOT IN ('withdrawn','deleting')) THEN RAISE EXCEPTION 'PURGE_NOT_REQUESTED'; END IF;
 IF (public.chj_privacy_schema_check()->>'ready')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'PRIVACY_SCHEMA_UNREVIEWED'; END IF;
 -- Check cross-user FK edges before deleting: never cascade into another owner.
 FOR fk IN SELECT * FROM pg_constraint WHERE contype='f' LOOP
  SELECT * INTO parent FROM public.chj_privacy_registry WHERE to_regclass(format('%I.%I',schema_name,table_name))=fk.confrelid;
  SELECT * INTO child FROM public.chj_privacy_registry WHERE to_regclass(format('%I.%I',schema_name,table_name))=fk.conrelid;
  IF parent.table_name IS NULL OR child.table_name IS NULL THEN CONTINUE; END IF;
  SELECT string_agg(format('c.%I=p.%I',ca.attname,pa.attname),' AND ') INTO join_sql
  FROM unnest(fk.conkey,fk.confkey) pair(ca_num,pa_num)
  JOIN pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=pair.ca_num
  JOIN pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=pair.pa_num;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I p JOIN %I.%I c ON %s WHERE p.%I::text=$1 AND c.%I::text IS DISTINCT FROM $1)',parent.schema_name,parent.table_name,child.schema_name,child.table_name,join_sql,parent.owner_column,child.owner_column) INTO conflict USING p_uid;
  IF conflict THEN RAISE EXCEPTION 'PRIVACY_CROSS_OWNER_REFERENCE'; END IF;
 END LOOP;
 PERFORM set_config('chj.privacy_internal','1',true);
 -- Retry non-cascading FK order, but never swallow a final failure.
 FOR pass IN 1..64 LOOP
  progress:=false; remaining:=0;
  FOR r IN SELECT * FROM public.chj_privacy_registry WHERE p_kind='account' OR scope='health' LOOP
   BEGIN
    EXECUTE format('DELETE FROM %I.%I WHERE %I::text=$1',r.schema_name,r.table_name,r.owner_column) USING p_uid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected>0 THEN progress:=true; result:=result||jsonb_build_object(r.table_name,COALESCE((result->>r.table_name)::bigint,0)+affected); END IF;
   EXCEPTION WHEN foreign_key_violation THEN remaining:=remaining+1;
   END;
  END LOOP;
  EXIT WHEN remaining=0;
  IF NOT progress THEN RAISE EXCEPTION 'PRIVACY_DEPENDENT_DELETE_BLOCKED'; END IF;
 END LOOP;
 IF remaining>0 THEN RAISE EXCEPTION 'PRIVACY_PURGE_INCOMPLETE'; END IF;
 FOR r IN SELECT * FROM public.chj_privacy_registry WHERE p_kind='account' OR scope='health' LOOP
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I::text=$1',r.schema_name,r.table_name,r.owner_column) INTO before_count USING p_uid;
  IF before_count<>0 THEN RAISE EXCEPTION 'PRIVACY_PURGE_INCOMPLETE'; END IF;
 END LOOP;
 PERFORM set_config('chj.privacy_internal','0',true);
 RETURN result;
END $$;

-- Only the server service role can invoke control-plane operations.
REVOKE ALL ON FUNCTION public.chj_privacy_status(text),public.chj_privacy_change(text,text,text,text,text,boolean,text),public.chj_privacy_refresh_registry(),public.chj_privacy_schema_check(),public.chj_privacy_purge_rows(text,text),public.chj_privacy_write_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chj_privacy_status(text),public.chj_privacy_change(text,text,text,text,text,boolean,text),public.chj_privacy_refresh_registry(),public.chj_privacy_schema_check(),public.chj_privacy_purge_rows(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.chj_privacy_claim_job(p_lease uuid,p_job uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.chj_privacy_jobs;
BEGIN
 DELETE FROM public.chj_privacy_jobs WHERE kind='account' AND stage='complete' AND uid='' AND updated_at<now()-interval '30 days';
 SELECT * INTO j FROM public.chj_privacy_jobs WHERE (p_job IS NULL OR id=p_job) AND stage NOT IN ('external_review','complete') AND (locked_until IS NULL OR locked_until<now())
 ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF j.id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.chj_privacy_jobs SET lease_id=p_lease,locked_until=now()+interval '3 minutes',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;
 RETURN to_jsonb(j)-'receipt_hash';
END $$;
CREATE OR REPLACE FUNCTION public.chj_privacy_job_step(p_job uuid,p_lease uuid,p_stage text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.chj_privacy_jobs;
BEGIN
 SELECT * INTO j FROM public.chj_privacy_jobs WHERE id=p_job AND lease_id=p_lease AND locked_until>now() FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'STALE_JOB_LEASE'; END IF;
 IF p_stage NOT IN ('identity','external_review') THEN RAISE EXCEPTION 'INVALID_JOB_STEP'; END IF;
 UPDATE public.chj_privacy_jobs SET stage=p_stage,updated_at=now(),locked_until=CASE WHEN p_stage IN ('external_review','complete') THEN NULL ELSE locked_until END,last_error_code=NULL WHERE id=p_job;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.chj_privacy_job_error(p_job uuid,p_lease uuid,p_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_code NOT IN ('STORAGE_REVIEW_REQUIRED','STORAGE_UNAVAILABLE','ERASURE_RETRY_REQUIRED') THEN RAISE EXCEPTION 'INVALID_ERROR_CODE'; END IF;
 UPDATE public.chj_privacy_jobs SET last_error_code=p_code,locked_until=now()+interval '5 minutes',updated_at=now() WHERE id=p_job AND lease_id=p_lease;
 RETURN FOUND;
END $$;
-- Only an operator who has actually checked external copies may finish a request.
-- Never call this automatically after the local database/Firebase work.
CREATE OR REPLACE FUNCTION public.chj_privacy_finish_external_review(p_job uuid,p_verified boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.chj_privacy_jobs;
BEGIN
 IF p_verified IS NOT TRUE THEN RAISE EXCEPTION 'EXTERNAL_REVIEW_REQUIRED'; END IF;
 SELECT * INTO j FROM public.chj_privacy_jobs WHERE id=p_job AND stage='external_review' FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'REVIEW_NOT_PENDING'; END IF;
 PERFORM public.chj_privacy_purge_rows(j.uid,j.kind);
 IF j.kind='health' THEN
  UPDATE public.chj_privacy_jobs SET stage='complete',external_reviewed_at=now(),updated_at=now(),lease_id=NULL,locked_until=NULL WHERE id=j.id;
  RETURN true;
 END IF;
 DELETE FROM public.chj_privacy_events WHERE uid=j.uid;
 DELETE FROM public.chj_privacy_accounts WHERE uid=j.uid;
 DELETE FROM public.chj_privacy_jobs WHERE uid=j.uid AND id<>j.id;
 -- Keep a status-only receipt, with no account identifier, for 30 days.
 UPDATE public.chj_privacy_jobs SET uid='',stage='complete',external_reviewed_at=now(),updated_at=now(),lease_id=NULL,locked_until=NULL WHERE id=j.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.chj_privacy_claim_job(uuid,uuid),public.chj_privacy_job_step(uuid,uuid,text),public.chj_privacy_job_error(uuid,uuid,text),public.chj_privacy_finish_external_review(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chj_privacy_claim_job(uuid,uuid),public.chj_privacy_job_step(uuid,uuid,text),public.chj_privacy_job_error(uuid,uuid,text),public.chj_privacy_finish_external_review(uuid,boolean) TO service_role;

SELECT public.chj_privacy_refresh_registry();
COMMIT;

# Isolated PostgreSQL only. Refuses any database other than the CI fixture.
import os,subprocess,pathlib,json,sys
if os.environ.get('CHJ_PRIVACY_TEST_DATABASE')!='1' or os.environ.get('PGDATABASE')!='privacy_fixture':
 raise SystemExit('Refusing to run: isolated privacy_fixture database required')
def sql(text,ok=True):
 p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
 if ok and p.returncode:raise AssertionError(p.stderr)
 if not ok and p.returncode==0:raise AssertionError('Expected SQL operation to be rejected')
 return p.stdout.strip()
assert sql('select current_database()')=='privacy_fixture'
sql("""CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.user_profiles(user_id text primary key,value text);
CREATE TABLE public.action_assignments(id serial primary key,user_id text not null references user_profiles(user_id),value text);
CREATE TABLE public.toc_fixture(id serial primary key,user_id text not null references user_profiles(user_id) ON DELETE CASCADE,value text);
INSERT INTO user_profiles VALUES('fixture-a','A'),('fixture-b','B');
INSERT INTO toc_fixture(user_id,value) VALUES('fixture-a','keep account workspace');
INSERT INTO action_assignments(user_id,value) VALUES('fixture-a','A action'),('fixture-b','B action');
GRANT SELECT,INSERT,UPDATE,DELETE ON user_profiles,action_assignments TO anon,authenticated,service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated,service_role;""")
sql(pathlib.Path('migrations/20261015_health_consent_and_erasure.sql').read_text())
sql(pathlib.Path('scripts/privacy-preflight.sql').read_text())
assert json.loads(sql("select chj_privacy_status('fixture-a')"))['status']=='pending'
assert sql("select count(*) from user_profiles")=='2'
sql("set role anon; select chj_privacy_status('fixture-a');",False)
assert sql("set role anon; select count(*) from user_profiles;")=='0'
grant="select chj_privacy_change('fixture-a','grant','health-2026-10-15-v1','terms-2026-10-15-v1','privacy-2026-10-15-v1',true)"
sql(grant.replace(',true)',',false)'),False)
assert json.loads(sql(grant))['epoch']==1
def headers(uid,epoch):
 return "SET request.headers="+ "'" + json.dumps({'x-chj-privacy-uid':uid,'x-chj-privacy-epoch':str(epoch),'x-chj-privacy-scope':'health'}) + "';"
sql("insert into user_profiles values('fixture-a','bad') on conflict(user_id) do update set value='bad'",False)
sql(headers('fixture-a',1)+"update user_profiles set value='A updated' where user_id='fixture-a'")
sql(headers('fixture-a',1)+"update user_profiles set value='bad' where user_id='fixture-b'",False)
sql("select chj_privacy_change('fixture-a','withdraw')")
sql(headers('fixture-a',1)+"update user_profiles set value='late' where user_id='fixture-a'",False)
sql(grant,False)
lease="'00000000-0000-0000-0000-000000000001'"
job=json.loads(sql("select chj_privacy_claim_job("+lease+")"))
# The real user_profiles table is mixed: never treat it as a deletable health row.
assert sql("select withdrawal_mode from chj_privacy_registry where table_name='user_profiles'")=='review'
sql("select chj_privacy_purge_rows('fixture-a','health')",False)
assert sql("select value from user_profiles where user_id='fixture-a'")=='A updated'
assert sql("select count(*) from action_assignments where user_id='fixture-a'")=='1'
assert json.loads(sql("select chj_privacy_status('fixture-a')"))['cleanup_pending'] is True
# Pure fixture has ONLY user_id/value, no live account/contact fields.
# Explicitly classify that synthetic table solely to exercise the generic purge.
# This is not a proposed live override for mixed user_profiles.
sql("update chj_privacy_registry set withdrawal_mode='delete' where table_name='user_profiles'")

# A health withdrawal must never silently cascade into retained account scope.
sql("select chj_privacy_purge_rows('fixture-a','health')",False)
assert sql("select value from toc_fixture where user_id='fixture-a'")=='keep account workspace'
assert sql("select count(*) from user_profiles where user_id='fixture-a'")=='1'
# Resolve this deliberately incompatible fixture relationship explicitly.
sql("delete from toc_fixture where user_id='fixture-a'")
sql("select chj_privacy_purge_rows('fixture-a','health')")
assert sql("select count(*) from user_profiles where user_id='fixture-a'")=='0'
assert sql("select value from user_profiles where user_id='fixture-b'")=='B'
sql("select chj_privacy_job_step('"+job['id']+"',"+lease+",'external_review')")
sql("select chj_privacy_finish_external_review('"+job['id']+"',false)",False)
sql("select chj_privacy_finish_external_review('"+job['id']+"',true)")
assert json.loads(sql(grant))['epoch']==3
sql(headers('fixture-a',1)+"insert into user_profiles values('fixture-a','stale epoch')",False)
sql(headers('fixture-a',3)+"insert into user_profiles values('fixture-a','A fresh')")
sql("select chj_privacy_change('fixture-a','delete',null,null,null,false,repeat('a',64))")
sql(headers('fixture-a',3)+"update user_profiles set value='late delete' where user_id='fixture-a'",False)
# Unknown indirect ownership must block deletion, never silently skip data.
sql("create table indirect_private(id serial primary key,parent text references user_profiles(user_id));insert into indirect_private(parent) values('fixture-a')")
assert json.loads(sql("select chj_privacy_schema_check()"))['ready'] is False
sql("select chj_privacy_purge_rows('fixture-a','account')",False)
assert sql("select count(*) from user_profiles where user_id='fixture-a'")=='1'
# Simulate an operator-reviewed ownership migration in this isolated fixture.
sql("alter table indirect_private add column user_id text; update indirect_private set user_id=parent; select chj_privacy_refresh_registry()")
assert json.loads(sql("select chj_privacy_schema_check()"))['ready'] is True
# Cross-owner cascades must be rejected before deleting anything.
sql("select chj_privacy_change('fixture-b','grant','health-2026-10-15-v1','terms-2026-10-15-v1','privacy-2026-10-15-v1',true)")
sql(headers('fixture-b',1)+"insert into indirect_private(parent,user_id) values('fixture-a','fixture-b')")
sql("select chj_privacy_purge_rows('fixture-a','account')",False)
assert sql("select count(*) from user_profiles where user_id='fixture-a'")=='1'
sql("delete from indirect_private where user_id='fixture-b'")
sql("select chj_privacy_purge_rows('fixture-a','account')")
assert sql("select count(*) from user_profiles where user_id='fixture-a'")=='0'
assert sql("select count(*) from indirect_private where user_id='fixture-a'")=='0'
assert sql("select value from user_profiles where user_id='fixture-b'")=='B'
sql("select chj_privacy_job_step('"+job['id']+"','00000000-0000-0000-0000-000000000099','complete')",False)
print('PASS isolated PostgreSQL: no historic consent, RLS, permissions, epochs, withdrawal/regrant, owner isolation, FK order, unknown dependents and stale leases.')

# Monitoring is aggregate-only and cannot be invoked by browser roles.
sql("set role anon; select chj_privacy_monitor()",False)
sql("set role authenticated; select chj_privacy_monitor()",False)
sql("""insert into chj_privacy_jobs(uid,kind,stage,requested_at) values
('fixture-monitor-account','account','external_review',now()-interval '31 days'),
('fixture-monitor-health','health','external_review',now()-interval '32 days'),
('fixture-monitor-recent','account','queued',now()-interval '29 days');
insert into chj_privacy_jobs(uid,kind,attempts,last_error_code) values('fixture-monitor-failure','health',3,'ERASURE_RETRY_REQUIRED');""")
summary=json.loads(sql("set role service_role;select chj_privacy_monitor()"))
assert summary['schema_version']=='privacy-queue-v1'
assert summary['overdue_accounts']==1
assert summary['external_review']==2
assert summary['repeated_failures']==1
assert summary['oldest_pending_hours']>=32*24
assert 'fixture' not in json.dumps(summary)
assert 'uid' not in summary and 'receipt_hash' not in summary and 'last_error_code' not in summary
print('PASS isolated aggregate queue monitor: private roles, pending/failures/external review, account deadline and no identities.')

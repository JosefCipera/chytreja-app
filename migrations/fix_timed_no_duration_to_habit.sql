-- Fix: timed actions without duration → habit
-- These were inserted from migration_v2.sql with wrong type
UPDATE longevity_actions
SET type = 'habit'
WHERE id IN (
  -- bilkoviny
  'f6e53c17-99b9-4e97-9e5a-c058b09bb0be',
  'dac30f2a-fa1f-4e05-8017-c0063185345c',
  -- hydratace
  '95eee52b-a468-44dd-9e47-895c6b543e9e',
  '60a3743a-b1bd-4773-aa7e-98c948b9aed3',
  -- butejko
  'badd1ec9-e912-40ec-b25b-f4f4cbe85917',
  -- casovani_jidel
  'd5ca62a8-4277-41cf-9dd3-a96c6c5226b4',
  -- emoce
  '79f3585f-9df9-41bf-b470-a1a52b46fd0b',
  -- floor_get_up
  '1c3dd79a-00d3-410b-94fb-78bc4698ae7c',
  -- hip_hinge (reps, ale bez reps hodnoty — habit jako fallback)
  '5db16b41-daf7-4606-bc67-e13b0303cfa5',
  -- imunitni
  'ee48748d-ac77-4a70-b772-5fc80e58817f',
  -- metabolicke
  '27fbab1d-56ae-4c94-96c3-639d86d79065',
  -- mikronutrienty
  'abe13acb-28e7-4bfe-aa2c-ac4d2fd25a2c',
  -- nosni_dychani
  'd43d7083-e219-4ff0-8804-3308c820a2d6',
  -- rovnovaha
  'dd180262-fd7a-416d-8a76-16203fe746b2',
  -- sila
  'fcf71db0-6a79-45d4-bd3a-85995a475a25',
  '03c68946-6f89-4442-8448-0e6433e38478',
  -- spanek
  'c40385cf-3dc1-4325-a48c-57358f1107dd',
  'e38ee1bf-f025-415c-9eb3-7f103c6bc5ee',
  -- vdecnost
  '2454160f-0e90-4ff9-acc0-84d32e4cb3a3'
);

-- hip_hinge: kettlebell swing a RDL jsou reps akce — dej správné hodnoty
UPDATE longevity_actions SET type = 'reps', reps = 20 WHERE id = '5beb54a2-d2cc-4d21-bfae-733161a26188'; -- kettlebell swing
UPDATE longevity_actions SET type = 'reps', reps = 5  WHERE id = '49fb7147-c6d7-468a-b044-648c369656f1'; -- rumunský mrtvý tah

-- Verify
SELECT id, label, type, reps, node_id FROM longevity_actions
WHERE id IN (
  'f6e53c17-99b9-4e97-9e5a-c058b09bb0be','dac30f2a-fa1f-4e05-8017-c0063185345c',
  '95eee52b-a468-44dd-9e47-895c6b543e9e','60a3743a-b1bd-4773-aa7e-98c948b9aed3',
  '5beb54a2-d2cc-4d21-bfae-733161a26188','49fb7147-c6d7-468a-b044-648c369656f1'
)
ORDER BY node_id;

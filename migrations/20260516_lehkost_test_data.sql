-- Test data: 14 dní check-inů pro Lehkost
-- User: I1mSm5kI1gPN9KlaCzIjyflH46d2
-- Bezpečné: INSERT s ON CONFLICT DO NOTHING — nepřepíše existující záznamy

INSERT INTO daily_checkin (user_id, date, universe, weight_kg, energy, sleep_hours, binge, movement_level, stress)
VALUES
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE - 13, 'lehkost', 76.2, 3, 6.5, false, 'low',    3),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE - 12, 'lehkost', 76.0, 2, 5.5, true,  'low',    4),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE - 11, 'lehkost', 76.1, 3, 7.0, false, 'medium', 3),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE - 10, 'lehkost', 75.8, 4, 7.5, false, 'medium', 2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  9, 'lehkost', 75.9, 3, 6.0, true,  'low',    4),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  8, 'lehkost', 75.6, 4, 7.0, false, 'high',   2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  7, 'lehkost', 75.4, 4, 8.0, false, 'high',   2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  6, 'lehkost', 75.3, 3, 7.5, false, 'medium', 3),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  5, 'lehkost', 75.1, 4, 8.0, false, 'medium', 2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  4, 'lehkost', 74.9, 5, 8.5, false, 'high',   1),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  3, 'lehkost', 74.8, 4, 7.0, false, 'medium', 2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  2, 'lehkost', 74.6, 4, 7.5, false, 'high',   2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  1, 'lehkost', 74.5, 4, 8.0, false, 'medium', 2),
  ('I1mSm5kI1gPN9KlaCzIjyflH46d2', CURRENT_DATE -  0, 'lehkost', 74.3, 5, 8.0, false, 'high',   1)
ON CONFLICT (user_id, date, universe) DO NOTHING;

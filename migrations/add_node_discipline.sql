-- Add discipline column to longevity_nodes
-- Single source of truth for node → Decathlon discipline mapping.
-- When adding any new node, fill discipline = one of the 10 Decathlon disciplines.
-- If left NULL, hud-data.js traverses parent chain automatically.

ALTER TABLE longevity_nodes ADD COLUMN IF NOT EXISTS discipline text;

-- Nodes that ARE disciplines (self-referential)
UPDATE longevity_nodes SET discipline = id
WHERE id IN ('sila','kardio','stabilita','spanek','kognitivni','emocni','smysl','prevence','metabolismus','vyziva');

-- Tělo 3rd level
UPDATE longevity_nodes SET discipline = 'kardio'    WHERE id IN ('vo2max','vytrvalost');
UPDATE longevity_nodes SET discipline = 'stabilita' WHERE id IN ('rovnovaha','mobilita','dychani');

-- Tělo 4th level
UPDATE longevity_nodes SET discipline = 'sila'      WHERE id IN ('dead_hang','farmer_carry','grip','hip_hinge');
UPDATE longevity_nodes SET discipline = 'stabilita' WHERE id IN ('floor_get_up');

-- Mysl 3rd level (node name ≠ discipline name — must be explicit)
UPDATE longevity_nodes SET discipline = 'emocni'    WHERE id IN ('emoce','klid','stres');
UPDATE longevity_nodes SET discipline = 'kognitivni' WHERE id IN ('soustredeni','meditace','nervovy_system');
UPDATE longevity_nodes SET discipline = 'smysl'     WHERE id IN ('vdecnost');

-- Zdraví 3rd level
UPDATE longevity_nodes SET discipline = 'prevence'     WHERE id IN ('imunitni','obnova');
UPDATE longevity_nodes SET discipline = 'metabolismus' WHERE id IN ('metabolicke');

-- Výživa 3rd level
UPDATE longevity_nodes SET discipline = 'vyziva'       WHERE id IN ('bilkoviny','casovani_jidel','hydratace','mikronutrienty');
UPDATE longevity_nodes SET discipline = 'metabolismus' WHERE id IN ('glukoza_vyziva','pust');

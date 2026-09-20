-- The approved public acquisition taxonomy has seven categories.
-- Remove only the importer-only sentinel, and only while it is unreferenced.
DELETE FROM "acquisition_categories"
WHERE "id" = 'unresolved'
  AND NOT EXISTS (
    SELECT 1
    FROM "skin_acquisition_state"
    WHERE "source_category_id" = 'unresolved'
       OR "override_category_id" = 'unresolved'
  );

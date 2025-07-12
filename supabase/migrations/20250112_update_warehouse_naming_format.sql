-- Update existing transfers to use new warehouse naming format
-- Changes "Supplier Name Warehouse" to "Supplier Name (Warehouse)"

-- Update to_location field
UPDATE transfers
SET to_location = REGEXP_REPLACE(to_location, '(\S+)\s+Warehouse$', '\1 (Warehouse)', 'i')
WHERE to_location ~* '\S+\s+Warehouse$'
  AND to_location NOT LIKE '%(Warehouse)';

-- Update from_location field
UPDATE transfers
SET from_location = REGEXP_REPLACE(from_location, '(\S+)\s+Warehouse$', '\1 (Warehouse)', 'i')
WHERE from_location ~* '\S+\s+Warehouse$'
  AND from_location NOT LIKE '%(Warehouse)';

-- Handle multi-word supplier names (e.g., "Three Color Stone Warehouse" -> "Three Color Stone (Warehouse)")
UPDATE transfers
SET to_location = REGEXP_REPLACE(to_location, '^(.+)\s+Warehouse$', '\1 (Warehouse)', 'i')
WHERE to_location ~* '^.+\s+Warehouse$'
  AND to_location NOT LIKE '%(Warehouse)'
  AND to_location != 'Supplier Warehouse'
  AND to_location != '3PL Warehouse';

UPDATE transfers
SET from_location = REGEXP_REPLACE(from_location, '^(.+)\s+Warehouse$', '\1 (Warehouse)', 'i')
WHERE from_location ~* '^.+\s+Warehouse$'
  AND from_location NOT LIKE '%(Warehouse)'
  AND from_location != 'Supplier Warehouse'
  AND from_location != '3PL Warehouse';
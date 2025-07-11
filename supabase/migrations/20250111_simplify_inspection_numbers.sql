-- Update inspection number generation to use simpler format (INS-1001, INS-1002, etc.)
CREATE OR REPLACE FUNCTION generate_inspection_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  sequence_number INTEGER;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(inspection_number FROM 'INS-(\d+)$') 
      AS INTEGER
    )
  ), 1000) + 1
  INTO sequence_number
  FROM inspections
  WHERE inspection_number LIKE 'INS-%';
  
  -- Generate the inspection number
  new_number := 'INS-' || sequence_number::TEXT;
  
  NEW.inspection_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Update existing inspection numbers to new format
-- This will renumber all existing inspections starting from INS-1001
DO $$ 
DECLARE
  r RECORD;
  counter INTEGER := 1001;
BEGIN
  FOR r IN 
    SELECT id 
    FROM inspections 
    ORDER BY created_at
  LOOP
    UPDATE inspections 
    SET inspection_number = 'INS-' || counter 
    WHERE id = r.id;
    
    counter := counter + 1;
  END LOOP;
END $$;
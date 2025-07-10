-- Add accepted_at column to vendors table if it doesn't exist
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Update the column for vendors that are already accepted
UPDATE vendors 
SET accepted_at = updated_at 
WHERE vendor_status = 'accepted' 
AND accepted_at IS NULL;
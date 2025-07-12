-- Add transfer_date column to transfers table
ALTER TABLE transfers 
ADD COLUMN IF NOT EXISTS transfer_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add comment for clarity
COMMENT ON COLUMN transfers.transfer_date IS 'The date when the transfer is initiated or scheduled';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transfers_transfer_date ON transfers(transfer_date);

-- Update existing transfers to use created_at date if needed
UPDATE transfers 
SET transfer_date = created_at::DATE 
WHERE transfer_date = CURRENT_DATE AND created_at < CURRENT_DATE;
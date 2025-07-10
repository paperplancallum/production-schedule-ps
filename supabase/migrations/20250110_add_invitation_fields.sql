-- Add invitation fields to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS invitation_token UUID,
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for invitation token lookups
CREATE INDEX IF NOT EXISTS idx_vendors_invitation_token ON vendors(invitation_token);

-- Add unique constraint to prevent duplicate tokens
ALTER TABLE vendors 
ADD CONSTRAINT vendors_invitation_token_unique UNIQUE (invitation_token);
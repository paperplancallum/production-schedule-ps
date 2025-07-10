-- Add accepted_at field to track when vendors accept invitations
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
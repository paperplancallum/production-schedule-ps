-- Add phone and wechat columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS wechat VARCHAR(100);

-- Add comments explaining the fields
COMMENT ON COLUMN vendors.phone IS 'Optional phone number for the vendor';
COMMENT ON COLUMN vendors.wechat IS 'Optional WeChat ID for the vendor';
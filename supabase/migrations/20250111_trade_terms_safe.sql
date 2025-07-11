-- Add trade_terms column to purchase_orders table if it doesn't exist
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS trade_terms TEXT DEFAULT 'FOB';

-- Drop the existing constraint if it exists and recreate it
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS valid_trade_terms;

-- Add the constraint
ALTER TABLE purchase_orders 
ADD CONSTRAINT valid_trade_terms CHECK (
  trade_terms IN ('FOB', 'CIF', 'EXW', 'DDP', 'FCA', 'CFR')
);
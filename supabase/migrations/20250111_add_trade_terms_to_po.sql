-- Add trade_terms column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS trade_terms TEXT DEFAULT 'FOB';

-- Add a check constraint for valid trade terms
ALTER TABLE purchase_orders 
ADD CONSTRAINT valid_trade_terms CHECK (
  trade_terms IN ('FOB', 'CIF', 'EXW', 'DDP', 'FCA', 'CFR')
);
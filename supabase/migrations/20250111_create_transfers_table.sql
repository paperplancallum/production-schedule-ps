-- Create transfers table
CREATE TABLE IF NOT EXISTS transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  transfer_type VARCHAR(20) NOT NULL CHECK (transfer_type IN ('in', 'transfer', 'out')),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  purchase_order_number VARCHAR(50),
  from_location VARCHAR(255) NOT NULL,
  from_location_type VARCHAR(50) NOT NULL CHECK (from_location_type IN ('production', 'supplier', 'supplier_warehouse', '3pl_warehouse', 'amazon_fba', 'other')),
  to_location VARCHAR(255) NOT NULL,
  to_location_type VARCHAR(50) NOT NULL CHECK (to_location_type IN ('production', 'supplier', 'supplier_warehouse', '3pl_warehouse', 'amazon_fba', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'arrived', 'delayed', 'cancelled')),
  estimated_arrival TIMESTAMP,
  actual_arrival TIMESTAMP,
  tracking_number VARCHAR(255),
  carrier VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transfer items table
CREATE TABLE IF NOT EXISTS transfer_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_transfers_seller_id ON transfers(seller_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_transfer_number ON transfers(transfer_number);
CREATE INDEX idx_transfer_items_transfer_id ON transfer_items(transfer_id);

-- Create RLS policies
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

-- Transfers policies
CREATE POLICY "Users can view their own transfers" ON transfers
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Users can create their own transfers" ON transfers
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update their own transfers" ON transfers
  FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Users can delete their own transfers" ON transfers
  FOR DELETE USING (seller_id = auth.uid());

-- Transfer items policies
CREATE POLICY "Users can view transfer items for their transfers" ON transfer_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transfers
      WHERE transfers.id = transfer_items.transfer_id
      AND transfers.seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transfer items for their transfers" ON transfer_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM transfers
      WHERE transfers.id = transfer_items.transfer_id
      AND transfers.seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transfer items for their transfers" ON transfer_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM transfers
      WHERE transfers.id = transfer_items.transfer_id
      AND transfers.seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete transfer items for their transfers" ON transfer_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM transfers
      WHERE transfers.id = transfer_items.transfer_id
      AND transfers.seller_id = auth.uid()
    )
  );
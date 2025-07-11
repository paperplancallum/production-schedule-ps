-- Create purchase order status enum
CREATE TYPE purchase_order_status AS ENUM (
  'draft',
  'submitted',
  'accepted',
  'in_progress',
  'shipped',
  'delivered',
  'cancelled'
);

-- Create purchase_orders table
CREATE TABLE purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  status purchase_order_status DEFAULT 'draft' NOT NULL,
  
  -- Order dates
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Financial fields
  subtotal DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  shipping_cost DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (subtotal + tax_amount + shipping_cost) STORED,
  
  -- Shipping information
  shipping_address TEXT,
  shipping_method TEXT,
  
  -- Additional information
  notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Create purchase_order_items table
CREATE TABLE purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  product_supplier_id UUID REFERENCES product_suppliers(id) ON DELETE RESTRICT NOT NULL,
  
  -- Quantity and pricing
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Reference to price tier used (if applicable)
  price_tier_id UUID REFERENCES supplier_price_tiers(id) ON DELETE SET NULL,
  
  -- Additional fields
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure no duplicate products in same PO
  UNIQUE(purchase_order_id, product_id)
);

-- Create purchase_order_status_history table for tracking status changes
CREATE TABLE purchase_order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  from_status purchase_order_status,
  to_status purchase_order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_purchase_orders_seller_id ON purchase_orders(seller_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_id ON purchase_order_items(product_id);
CREATE INDEX idx_po_status_history_po_id ON purchase_order_status_history(purchase_order_id);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
-- Sellers can view and manage their own purchase orders
CREATE POLICY "Sellers can view own purchase orders" ON purchase_orders
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can create purchase orders" ON purchase_orders
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own purchase orders" ON purchase_orders
  FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete own draft purchase orders" ON purchase_orders
  FOR DELETE USING (seller_id = auth.uid() AND status = 'draft');

-- Suppliers can view purchase orders sent to them
CREATE POLICY "Suppliers can view their purchase orders" ON purchase_orders
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Suppliers can update certain fields on their purchase orders
CREATE POLICY "Suppliers can update order status" ON purchase_orders
  FOR UPDATE USING (
    supplier_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
    AND status IN ('submitted', 'accepted', 'in_progress', 'shipped')
  );

-- RLS Policies for purchase_order_items
-- Sellers can manage items in their purchase orders
CREATE POLICY "Sellers can view own PO items" ON purchase_order_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can create PO items" ON purchase_order_items
  FOR INSERT WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE seller_id = auth.uid() AND status = 'draft'
    )
  );

CREATE POLICY "Sellers can update own PO items" ON purchase_order_items
  FOR UPDATE USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE seller_id = auth.uid() AND status = 'draft'
    )
  );

CREATE POLICY "Sellers can delete own PO items" ON purchase_order_items
  FOR DELETE USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE seller_id = auth.uid() AND status = 'draft'
    )
  );

-- Suppliers can view items in their purchase orders
CREATE POLICY "Suppliers can view their PO items" ON purchase_order_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po
      JOIN vendors v ON po.supplier_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

-- RLS Policies for purchase_order_status_history
-- Sellers can view status history of their purchase orders
CREATE POLICY "Sellers can view own PO status history" ON purchase_order_status_history
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE seller_id = auth.uid()
    )
  );

-- Suppliers can view status history of their purchase orders
CREATE POLICY "Suppliers can view their PO status history" ON purchase_order_status_history
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po
      JOIN vendors v ON po.supplier_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

-- Function to generate PO number
CREATE OR REPLACE FUNCTION generate_po_number(seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  seller_code TEXT;
  next_number INTEGER;
  new_po_number TEXT;
BEGIN
  -- Get seller company name initials (first 3 letters)
  SELECT UPPER(LEFT(REGEXP_REPLACE(company_name, '[^a-zA-Z]', '', 'g'), 3))
  INTO seller_code
  FROM profiles
  WHERE id = seller_id;
  
  -- If no company name, use 'PO'
  IF seller_code IS NULL OR seller_code = '' THEN
    seller_code := 'PO';
  END IF;
  
  -- Get the next number for this seller
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(po_number, '^[A-Z]+-', '') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE purchase_orders.seller_id = generate_po_number.seller_id
    AND po_number ~ ('^' || seller_code || '-[0-9]+$');
  
  -- Generate the PO number
  new_po_number := seller_code || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_po_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update purchase order totals when items change
CREATE OR REPLACE FUNCTION update_purchase_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the subtotal of the purchase order
  UPDATE purchase_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_items
    WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update purchase order totals
CREATE TRIGGER update_po_totals_on_item_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER update_po_totals_on_item_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER update_po_totals_on_item_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_totals();

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_purchase_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO purchase_order_status_history (
      purchase_order_id,
      from_status,
      to_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
    
    -- Update relevant timestamps
    CASE NEW.status
      WHEN 'submitted' THEN
        NEW.submitted_at := NOW();
      WHEN 'accepted' THEN
        NEW.accepted_at := NOW();
      WHEN 'cancelled' THEN
        NEW.cancelled_at := NOW();
      ELSE
        -- Do nothing for other statuses
    END CASE;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
CREATE TRIGGER log_po_status_change
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_purchase_order_status_change();

-- Function to validate supplier is actually a supplier type
CREATE OR REPLACE FUNCTION validate_supplier_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the supplier_id references a vendor with type 'supplier'
  IF NOT EXISTS (
    SELECT 1 FROM vendors 
    WHERE id = NEW.supplier_id 
    AND vendor_type = 'supplier'
  ) THEN
    RAISE EXCEPTION 'Supplier must be a vendor with type "supplier"';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate supplier type
CREATE TRIGGER validate_supplier_type_trigger
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_supplier_type();

-- Function to validate purchase order items
CREATE OR REPLACE FUNCTION validate_purchase_order_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the product_supplier relationship exists and matches
  IF NOT EXISTS (
    SELECT 1 FROM product_suppliers ps
    WHERE ps.id = NEW.product_supplier_id
      AND ps.product_id = NEW.product_id
      AND ps.vendor_id = (
        SELECT supplier_id FROM purchase_orders WHERE id = NEW.purchase_order_id
      )
  ) THEN
    RAISE EXCEPTION 'Invalid product-supplier relationship for this purchase order';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate purchase order items
CREATE TRIGGER validate_po_item
  BEFORE INSERT OR UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_purchase_order_item();
-- Simplify the generate_po_number function to avoid dependency issues
CREATE OR REPLACE FUNCTION generate_po_number(seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_po_number TEXT;
BEGIN
  -- Get the next number for this seller
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(po_number, '^PO-', '') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE purchase_orders.seller_id = generate_po_number.seller_id
    AND po_number ~ '^PO-[0-9]+$';
  
  -- Generate the PO number with a simple format
  new_po_number := 'PO-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_po_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
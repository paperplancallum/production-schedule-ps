-- Fix the generate_po_number function to not use profiles table
CREATE OR REPLACE FUNCTION generate_po_number(seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  seller_code TEXT;
  next_number INTEGER;
  new_po_number TEXT;
BEGIN
  -- Get seller company name initials from sellers table
  SELECT UPPER(LEFT(REGEXP_REPLACE(COALESCE(company_name, 'PO'), '[^a-zA-Z]', '', 'g'), 3))
  INTO seller_code
  FROM sellers
  WHERE id = seller_id;
  
  -- If no company name or seller not found, use 'PO'
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
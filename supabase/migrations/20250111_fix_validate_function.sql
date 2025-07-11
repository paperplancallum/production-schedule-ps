-- Fix the validate_purchase_order_item function that references ps.supplier_id
-- This function is causing the "column ps.supplier_id does not exist" error

-- Drop the existing function and recreate it with the correct column reference
CREATE OR REPLACE FUNCTION validate_purchase_order_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the product_supplier relationship exists and matches
  IF NOT EXISTS (
    SELECT 1 FROM product_suppliers ps
    WHERE ps.id = NEW.product_supplier_id
      AND ps.product_id = NEW.product_id
      AND ps.vendor_id = (  -- Changed from ps.supplier_id to ps.vendor_id
        SELECT supplier_id FROM purchase_orders WHERE id = NEW.purchase_order_id
      )
  ) THEN
    RAISE EXCEPTION 'Invalid product-supplier relationship for this purchase order';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also check if there's a trigger using this function
-- If the trigger exists, it should continue to work with the updated function
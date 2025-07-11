-- Add is_primary column to product_suppliers table
ALTER TABLE public.product_suppliers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create a function to ensure only one primary supplier per product
CREATE OR REPLACE FUNCTION ensure_single_primary_supplier()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this supplier as primary
  IF NEW.is_primary = true THEN
    -- Set all other suppliers for this product to non-primary
    UPDATE public.product_suppliers
    SET is_primary = false
    WHERE product_id = NEW.product_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single primary supplier
DROP TRIGGER IF EXISTS ensure_single_primary_supplier_trigger ON public.product_suppliers;
CREATE TRIGGER ensure_single_primary_supplier_trigger
  BEFORE INSERT OR UPDATE ON public.product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_supplier();

-- Create a function to update product price from primary supplier's default tier
CREATE OR REPLACE FUNCTION update_product_price_from_primary()
RETURNS TRIGGER AS $$
DECLARE
  default_price DECIMAL(10, 2);
BEGIN
  -- Only proceed if this is the primary supplier
  IF NEW.is_primary = true THEN
    -- Get the default tier price
    SELECT unit_price INTO default_price
    FROM public.supplier_price_tiers
    WHERE product_supplier_id = NEW.id
      AND is_default = true
    LIMIT 1;
    
    -- Update the product price if we found a default tier
    IF default_price IS NOT NULL THEN
      UPDATE public.products
      SET price = default_price
      WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update product price when primary supplier changes
DROP TRIGGER IF EXISTS update_product_price_trigger ON public.product_suppliers;
CREATE TRIGGER update_product_price_trigger
  AFTER INSERT OR UPDATE ON public.product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_product_price_from_primary();

-- Create a function to update product price when default tier changes
CREATE OR REPLACE FUNCTION update_product_price_on_tier_change()
RETURNS TRIGGER AS $$
DECLARE
  supplier_record RECORD;
  product_id_val UUID;
BEGIN
  -- Only proceed if this tier is being set as default
  IF NEW.is_default = true THEN
    -- Get the supplier and check if it's primary
    SELECT ps.*, p.id as prod_id INTO supplier_record
    FROM public.product_suppliers ps
    JOIN public.products p ON ps.product_id = p.id
    WHERE ps.id = NEW.product_supplier_id
      AND ps.is_primary = true;
    
    -- If this is a primary supplier's tier, update the product price
    IF FOUND THEN
      UPDATE public.products
      SET price = NEW.unit_price
      WHERE id = supplier_record.prod_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update product price when tier default changes
DROP TRIGGER IF EXISTS update_product_price_on_tier_change_trigger ON public.supplier_price_tiers;
CREATE TRIGGER update_product_price_on_tier_change_trigger
  AFTER INSERT OR UPDATE ON public.supplier_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_product_price_on_tier_change();
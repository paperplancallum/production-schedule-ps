-- Add policy to allow sellers to view vendors associated with their purchase orders
CREATE POLICY "Sellers can view vendors in their purchase orders" ON vendors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.supplier_id = vendors.id
      AND purchase_orders.seller_id = auth.uid()
    )
  );

-- Also allow vendors that are associated with purchase orders to view seller information
CREATE POLICY "Vendors can view sellers who have purchase orders with them" ON sellers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.seller_id = sellers.id
      AND purchase_orders.supplier_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );
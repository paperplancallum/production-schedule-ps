# Production Schedule Codebase Overview

## Project Structure
This is a Next.js application for managing production schedules, vendors, and products. It uses Supabase for the backend with Row Level Security (RLS) for data isolation.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL with RLS)
- **UI Components**: Custom component library based on shadcn/ui
- **Tables**: TanStack Table (React Table) for data grids
- **Authentication**: Supabase Auth

## Key Features

### 1. Seller Authentication & Profiles
- Sellers log in via Supabase Auth
- Each seller has a profile in the `sellers` table
- All data is isolated per seller using RLS policies

### 2. Vendor Management (`/seller/vendors`)
- **Vendor Types**: Warehouse, Supplier, Inspection Agent, Shipping Agent
- **Vendor Status**: Draft → Invited → Accepted → Archived
- **Features**:
  - Add/Edit/Delete vendors
  - Invite vendors via email
  - Vendor profile access for accepted vendors
  - Vendor type cannot be changed after creation

### 3. Products Management (`/seller/products`)
- **Simplified Product Fields**:
  - Product Name
  - Internal SKU (unique per seller)
  - Price (auto-calculated from primary supplier's default tier)
- **Features**:
  - CRUD operations for products
  - Duplicate SKU validation with inline form errors
  - Expandable suppliers sub-table per product

### 4. Product Suppliers
- Each product can have multiple suppliers (vendors of type "supplier")
- **Primary Supplier**:
  - One supplier marked as primary per product
  - Primary supplier's default tier sets product price
  - "Make Primary" button for non-primary suppliers
  - First supplier automatically becomes primary
- **Supplier Fields**:
  - Lead Time (days)
  - Tiered Pricing (multiple price breaks based on MOQ)
- **Tiered Pricing**:
  - Each supplier can have multiple price tiers
  - Each tier has: Minimum Order Quantity (MOQ) and Unit Price
  - Star one tier as default per supplier
  - Expandable view shows all price tiers for each supplier
  - Edit suppliers to update lead time and price tiers
- Junction table: `product_suppliers` links products to vendors
- Price tiers stored in `supplier_price_tiers` table
- Only shows accepted supplier-type vendors in dropdown

## Database Schema

### Core Tables
1. **sellers**: User profiles for authenticated sellers
2. **vendors**: All vendor relationships
   - Uses `vendor_status` (not `status`)
   - Linked to seller via `seller_id`
3. **products**: Product catalog per seller
   - Unique SKU constraint per seller
   - Linked to seller via `seller_id`
4. **product_suppliers**: Links products to vendor suppliers
   - Foreign keys to both products and vendors
   - Includes lead time info
   - Legacy pricing fields for backward compatibility
5. **supplier_price_tiers**: Tiered pricing for product suppliers
   - Links to product_suppliers
   - MOQ and unit price per tier
   - Sorted by MOQ for display

### RLS (Row Level Security)
All tables use RLS policies to ensure:
- Sellers can only see/modify their own data
- Vendors can only access data they're invited to
- Complete data isolation between accounts

## UI Components

### Data Tables
- Built with TanStack Table
- Features: Sorting, filtering, pagination
- Custom `DataTable` component supports:
  - Expandable rows (for sub-tables)
  - Action menus
  - Column headers with sorting

### Forms
- Sheet-based sidebars for Add/Edit operations
- Inline validation and error messages
- Disabled fields show computed/future values

## Recent Updates

### 2025-01-11
- Added Products table with simplified 3-field structure
- Implemented expandable suppliers sub-table
- Fixed vendor column name issue (`vendor_status` vs `status`)
- Added inline duplicate SKU validation
- Prevented duplicate suppliers per product (filters dropdown)
- Added tiered pricing for suppliers with MOQ-based price breaks
- Added edit functionality for suppliers (lead time & price tiers)
- Added default tier selection with star icon
- Added primary supplier feature (cascades default price to product)
- Changed Price Tiers column to show price range ($min - $max)

### 2025-01-10
- Initial products implementation
- Created products and product_suppliers tables
- Fixed RLS policies for proper data isolation

## Known Issues & Future Work
- Price field is disabled - awaiting calculation function
- Vendor type selector shows in edit mode but is disabled (by design)

## Common Debugging

### "No suppliers available"
- Check if vendors exist with `vendor_type = 'supplier'`
- Verify vendors have `vendor_status = 'accepted'`
- Ensure RLS policies allow access

### Import Errors
- Badge and Textarea components are custom implementations
- Toast notifications use `sonner` library
- Supabase client is in `/lib/supabase/client`

### "supplier_price_tiers" table doesn't exist
- Run the SQL in `RUN_THIS_IN_SUPABASE.sql` directly in Supabase dashboard
- The app gracefully handles missing price tiers table
- Falls back to legacy single-price display if table missing

## Development Commands
```bash
# Start development server
npm run dev

# Run database migrations
npx supabase migration up

# Check Supabase status
npx supabase status
```

## File Locations
- **Pages**: `/app/seller/[feature]/page.js`
- **Components**: `/app/seller/[feature]/[component].js`
- **UI Components**: `/components/ui/`
- **Database**: `/supabase/migrations/`
- **API Routes**: `/app/api/`
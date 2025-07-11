// Vendor-specific status configuration
export const vendorStatusConfig = {
  to_approve: { 
    label: 'To Approve', 
    color: 'yellow',
    sellerStatus: 'sent_to_supplier'
  },
  approved: { 
    label: 'Approved', 
    color: 'green',
    sellerStatus: 'approved'
  },
  in_production: { 
    label: 'In Production', 
    color: 'blue',
    sellerStatus: 'in_progress'
  },
  production_finished: { 
    label: 'Production Finished', 
    color: 'purple',
    sellerStatus: 'in_progress' // Still maps to in_progress for seller
  },
  scheduled_for_pickup: { 
    label: 'Scheduled For Pickup', 
    color: 'orange',
    sellerStatus: 'in_progress' // Still maps to in_progress for seller
  },
  picked_up: { 
    label: 'Picked Up', 
    color: 'green',
    sellerStatus: 'complete'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'destructive',
    sellerStatus: 'cancelled'
  }
}

// Map seller status to vendor status
export function getVendorStatus(sellerStatus) {
  switch (sellerStatus) {
    case 'sent_to_supplier':
      return 'to_approve'
    case 'approved':
      return 'approved'
    case 'in_progress':
      return 'in_production' // Default to in_production
    case 'complete':
      return 'picked_up'
    case 'cancelled':
      return 'cancelled'
    default:
      return sellerStatus
  }
}

// Map vendor status back to seller status
export function getSellerStatus(vendorStatus) {
  const config = vendorStatusConfig[vendorStatus]
  return config?.sellerStatus || vendorStatus
}

// Get available transitions for vendor
export function getVendorStatusTransitions(currentVendorStatus) {
  const transitions = {
    'to_approve': ['approved', 'cancelled'],
    'approved': ['in_production', 'cancelled'],
    'in_production': ['production_finished', 'cancelled'],
    'production_finished': ['scheduled_for_pickup', 'cancelled'],
    'scheduled_for_pickup': ['picked_up', 'cancelled'],
    'picked_up': [],
    'cancelled': []
  }
  return transitions[currentVendorStatus] || []
}
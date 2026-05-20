import type { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  ADMIN_MANAGE_PLATFORM: 'admin:manage_platform',
  ADMIN_APPROVE_BUSINESS: 'admin:approve_business',
  ADMIN_APPROVE_PRODUCT: 'admin:approve_product',
  ADMIN_VIEW_REPORTS: 'admin:view_reports',
  ADMIN_VIEW_USERS: 'admin:view_users',
  ADMIN_VIEW_AUDIT: 'admin:view_audit',
  ADMIN_MANAGE_PERMISSIONS: 'admin:manage_permissions',

  CUSTOMER_CREATE_ORDER: 'customer:create_order',
  CUSTOMER_VIEW_ORDERS: 'customer:view_orders',

  BUSINESS_MANAGE_PROFILE: 'business:manage_profile',
  BUSINESS_MANAGE_PRODUCTS: 'business:manage_products',
  BUSINESS_MANAGE_INVENTORY: 'business:manage_inventory',
  BUSINESS_MANAGE_ORDERS: 'business:manage_orders',
  BUSINESS_VIEW_ANALYTICS: 'business:view_analytics',

  DELIVERY_VIEW_ASSIGNED_ORDERS: 'delivery:view_assigned_orders',
  DELIVERY_UPDATE_DELIVERY_STATUS: 'delivery:update_delivery_status',
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  CUSTOMER: [PERMISSIONS.CUSTOMER_CREATE_ORDER, PERMISSIONS.CUSTOMER_VIEW_ORDERS],
  BUSINESS_OWNER: [
    PERMISSIONS.BUSINESS_MANAGE_PROFILE,
    PERMISSIONS.BUSINESS_MANAGE_PRODUCTS,
    PERMISSIONS.BUSINESS_MANAGE_INVENTORY,
    PERMISSIONS.BUSINESS_MANAGE_ORDERS,
    PERMISSIONS.BUSINESS_VIEW_ANALYTICS,
  ],
  DELIVERY: [
    PERMISSIONS.DELIVERY_VIEW_ASSIGNED_ORDERS,
    PERMISSIONS.DELIVERY_UPDATE_DELIVERY_STATUS,
  ],
};

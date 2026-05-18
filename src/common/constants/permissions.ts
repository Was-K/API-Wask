import type { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  ADMIN_APPROVE_COMPANY: 'admin:approve_company',
  ADMIN_VIEW_AUDIT: 'admin:view_audit',
  ADMIN_MANAGE_PERMISSIONS: 'admin:manage_permissions',
  BUSINESS_CREATE_ORDER: 'business:create_order',
  BUSINESS_MANAGE_INVENTORY: 'business:manage_inventory',
  SUPPLIER_MANAGE_CATALOG: 'supplier:manage_catalog',
  SUPPLIER_MANAGE_LOGISTICS: 'supplier:manage_logistics',
  ANALYTICS_READ: 'analytics:read',
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  BUSINESS: [
    PERMISSIONS.BUSINESS_CREATE_ORDER,
    PERMISSIONS.BUSINESS_MANAGE_INVENTORY,
    PERMISSIONS.ANALYTICS_READ,
  ],
  SUPPLIER: [
    PERMISSIONS.SUPPLIER_MANAGE_CATALOG,
    PERMISSIONS.SUPPLIER_MANAGE_LOGISTICS,
    PERMISSIONS.ANALYTICS_READ,
  ],
};

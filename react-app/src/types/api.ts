import type { UserRole } from "./index";

export interface ApiResponse<T = any> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Manage Staff Endpoint
export interface ManageStaffParams {
  action: 'invite' | 'remove' | 'update_role' | 'create';
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  userId?: string;
}

export interface ManageStaffResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Catalog/Stock Endpoint
export interface UpdateCatalogParams {
  action?: 'update_stock' | 'update_price' | 'toggle_visibility' | 'delete' | 'upsert';
  itemId?: string;
  value?: any;
  item?: any;
}

export interface UpdateCatalogResponse {
  success: boolean;
  message: string;
  updatedItem?: any;
}

// Settings Endpoint
export interface UpdateSettingsParams {
  settings: Record<string, any>;
}

export interface UpdateSettingsResponse {
  success: boolean;
  message: string;
}

// Subscriptions/Orders Endpoint
export interface ManageSubscriptionsParams {
  action: 'cancel' | 'pause' | 'resume' | 'manual_add' | 'add_days' | 'delete';
  subscriptionId?: string;
  data?: any;
}

export interface ManageSubscriptionsResponse {
  success: boolean;
  message: string;
  subscription?: any;
}

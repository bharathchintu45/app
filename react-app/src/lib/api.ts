import { supabase } from './supabase';
import type { 
  ApiResponse, 
  ManageStaffParams, 
  ManageStaffResponse,
  UpdateCatalogParams,
  UpdateCatalogResponse,
  UpdateSettingsParams,
  UpdateSettingsResponse,
  ManageSubscriptionsParams,
  ManageSubscriptionsResponse
} from '../types/api';

/**
 * Standardized API client for TFB project with versioning support.
 * Maps to the unified Supabase Edge Function 'api'.
 */
export const api = {
  v1: {
    /** Create a new Razorpay payment order */
    async createOrder(data: { amount: number; currency?: string; receipt?: string; notes?: any }): Promise<ApiResponse> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/orders' },
        body: data,
      });
    },

    /** Manage staff accounts (Admins only) */
    async manageStaff(data: ManageStaffParams): Promise<ApiResponse<ManageStaffResponse>> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/staff' },
        body: data,
      });
    },

    /** Send welcome email for a new subscription */
    async sendWelcomeEmail(subscriptionId: string): Promise<ApiResponse> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/welcome' },
        body: { subscriptionId },
      });
    },

    /** Trigger daily order generation (Internal/Admin) */
    async generateDailyOrders(targetDate?: string): Promise<ApiResponse> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/generate-daily-orders' },
        body: { targetDate },
      });
    },

    /** Update global application settings (Admins only) */
    async updateSettings(data: UpdateSettingsParams): Promise<ApiResponse<UpdateSettingsResponse>> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/settings' },
        body: data,
      });
    },

    /** Update catalog items or stock (Admins only) */
    async updateCatalog(data: UpdateCatalogParams): Promise<ApiResponse<UpdateCatalogResponse>> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/catalog' },
        body: data,
      });
    },

    /** Manage subscriptions (cancel, pause, etc.) */
    async manageSubscriptions(data: ManageSubscriptionsParams): Promise<ApiResponse<ManageSubscriptionsResponse>> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/subscriptions' },
        body: data,
      });
    },

    /** Update or manage orders (Admins only) */
    async updateOrder(data: { orderId: string; action: 'update_status' | 'update_payment' | 'solidify'; data?: any }): Promise<ApiResponse> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/orders/manage' },
        body: data,
      });
    },

    /** Manage dispatch and delivery fleet (Admins only) */
    async manageDispatch(data: { action: 'add_boy' | 'update_boy' | 'remove_boy' | 'assign_order'; boyId?: string; orderId?: string; data?: any }): Promise<ApiResponse> {
      return supabase.functions.invoke('api', {
        headers: { 'x-path': '/v1/dispatch' },
        body: data,
      });
    }
  }
};

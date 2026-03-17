export type Cat = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface MenuItem {
  id: string;
  category: Cat;
  name: string;
  description?: string;
  image?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  priceINR?: number;
  available?: boolean;
  tags?: string[];
}

export type Slot = "Slot1" | "Slot2" | "Slot3";
export type PlanType = "breakfast" | "lunch" | "dinner" | "lunch-dinner" | "complete";
export type Duration = 7 | 15 | 30;

export interface PlanConfig {
  type: PlanType;
  title: string;
  duration: Duration;
  allowedSlots: Slot[];
}

export interface DeliveryDetails {
  receiverName: string;
  receiverPhone: string;
  locationType: "House" | "Office" | "Other";
  building: string; // building/floor
  street: string;
  area: string;
  addressLabel: string; // Save as
  instructions?: string;
}

export type UserRole = "customer" | "admin" | "kitchen";

export interface AppUser {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  role?: UserRole;
  defaultDelivery?: DeliveryDetails;
  savedAddresses?: DeliveryDetails[];
  dietaryGoal?: PlanType;
  isPro?: boolean;
  proExpiry?: number;
  healthScore?: number;
}

export type Route = "home" | "login" | "checkout-regular" | "checkout-personal" | "checkout-group" | "order-confirmation" | "app" | "dashboard" | "admin" | "kitchen" | "profile" | "orders";

export type DashboardTab = "personal" | "group";
export type AuthIntent = "none" | "regular" | "personal" | "group" | "admin" | "kitchen";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DayHold {
  day: boolean;
  slots: Record<Slot, boolean>;
}

export type HoldsMap = Record<string, DayHold>;
export type PlanMap = Record<string, Partial<Record<Slot, MenuItem | null>>>;

export interface ThreadMsg {
  id: string;
  by: string;
  text: string;
  at: number;
}

export type GroupCart = Record<string, number>;
export interface GroupOrderDraft {
  people: number;
  deliveryAt: string;
  notes: string;
}

export type StartDateMap = Record<string, string>;
export type TargetMap = Record<string, Macros>;

export type OrderKind = "regular" | "personalized" | "group" | "subscription";
export type KitchenStatus = "New" | "Preparing" | "Ready" | "Out for delivery" | "Delivered" | "Cancelled";

export interface OrderReceipt {
  id: string;
  userId?: string;
  orderNumber?: string;
  kind: OrderKind;
  createdAt: number;
  status?: KitchenStatus;
  updatedAt?: number;
  headline: string;
  deliveryAtLabel: string;
  customer: DeliveryDetails;
  payment: string;
  meta?: any;
  lines: Array<{
    itemId: string;
    label: string;
    qty: number;
    unitPriceAtOrder?: number;
    calories?: number;
    protein?: number;
  }>;
  priceSummary?: {
    subtotal: number;
    discount?: number;
    discountedSubtotal?: number;
    gstRate: number;
    gst: number;
    deliveryFee: number;
    isFreeDelivery?: boolean;
    total: number;
  };
  estimatedArrival?: string;
  image?: string;
}

export interface SubscriptionSwap {
  id: string;
  subscription_id: string;
  date: string;
  slot: string;
  menu_item_id: string;
  created_at: string;
}

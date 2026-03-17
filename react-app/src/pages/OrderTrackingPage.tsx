import { useState, useEffect, useMemo } from "react";
import type { AppUser, Route } from "../types";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { SkeletonTrackingCard } from "../components/ui/Skeleton";
import { Package, Clock, ChefHat, Bike, CheckCircle2, RefreshCw, ArrowLeft, Phone, Info, MapPin, Navigation } from "lucide-react";
import { cn } from "../lib/utils";

interface DbOrder {
  id: string;
  order_number: string;
  created_at: string;
  delivery_date: string;
  status: string;
  kind: string;
  payment_status: string;
  total: number;
  customer_name: string;
  delivery_details: any;
  meta?: any;
  order_items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

const STATUS_STEPS = [
  { key: "pending",    label: "Order Placed",       icon: Package,     color: "text-sky-600",     bg: "bg-sky-50",    ring: "ring-sky-300"    },
  { key: "preparing", label: "Being Prepared",      icon: ChefHat,     color: "text-amber-600",   bg: "bg-amber-50",  ring: "ring-amber-300"  },
  { key: "ready",     label: "Ready for Pickup",    icon: CheckCircle2,color: "text-violet-600",  bg: "bg-violet-50", ring: "ring-violet-300" },
  { key: "out_for_delivery", label: "On the Way",   icon: Bike,        color: "text-sky-600",     bg: "bg-sky-50",    ring: "ring-sky-300"    },
  { key: "delivered", label: "Delivered",            icon: CheckCircle2,color: "text-blue-600",    bg: "bg-blue-50",   ring: "ring-blue-300"   },
];

const CANCELLED_STEP = { key: "cancelled", label: "Cancelled", icon: Clock, color: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-300" };

function getStepIndex(status: string) {
  return STATUS_STEPS.findIndex(s => s.key === status);
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 mt-4">
        <CANCELLED_STEP.icon size={16} className="text-rose-500" />
        <span className="text-sm font-bold text-rose-600">Order Cancelled</span>
      </div>
    );
  }

  const currentIdx = getStepIndex(status);
  return (
    <div className="relative flex items-center justify-between mt-6 px-1">
      {/* Track line behind steps */}
      <div className="absolute top-4 left-4 right-4 h-1 bg-slate-100 z-0 rounded-full" />
      <div
        className="absolute top-4 left-4 h-1 bg-gradient-to-r from-blue-400 to-blue-600 z-0 transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]"
        style={{ width: `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
      />
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center gap-2 flex-1">
            <motion.div
              animate={active ? { 
                scale: [1, 1.2, 1],
                boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 15px rgba(59,130,246,0.4)", "0 0 0px rgba(59,130,246,0)"]
              } : {}}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                done ? `${step.bg} border-blue-500 shadow-sm` : "bg-white border-slate-200 shadow-inner",
                active && `ring-4 ${step.ring.replace('300', '100')} ring-offset-0`
              )}
            >
              <Icon size={16} className={done ? step.color : "text-slate-300"} />
            </motion.div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-tighter text-center leading-tight transition-colors duration-500", 
              done ? "text-slate-900" : "text-slate-300",
              active && "text-blue-600"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubscriptionSummaryCard({ subscription }: { subscription: any }) {
  const durationDays = subscription.duration_days || 30;

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Live', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ready: { label: 'Live', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    preparing: { label: 'Preparing', color: 'text-amber-600', bg: 'bg-amber-50' },
    new: { label: 'Pending', color: 'text-blue-600', bg: 'bg-blue-50' },
    paused: { label: 'Paused', color: 'text-slate-500', bg: 'bg-slate-100' },
    cancelled: { label: 'Cancelled', color: 'text-rose-600', bg: 'bg-rose-50' },
  };

  const status = statusMap[subscription.status?.toLowerCase()] || { 
    label: subscription.status || 'Status unknown', 
    color: 'text-slate-600', 
    bg: 'bg-slate-50' 
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white overflow-hidden shadow-sm p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-slate-900 text-lg tracking-tight">#{subscription.order_number}</span>
            <span className="text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-violet-100 text-violet-700">
              Personalized Plan
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">Active Subscription Plan</p>
        </div>
        <div className="text-right">
          <div className="font-black text-slate-900 text-xl tracking-tighter">{formatINR(subscription.total)}</div>
          <div className="text-[10px] font-black uppercase mt-0.5 tracking-widest text-blue-600">PAID</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="p-3 rounded-2xl bg-white border border-blue-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Duration</p>
          <p className="text-sm font-black text-slate-900">{durationDays} Days</p>
        </div>
        <div className="p-3 rounded-2xl bg-white border border-blue-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Start Date</p>
          <p className="text-sm font-black text-slate-900">{formatDate(subscription.created_at).split(',')[0]}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Active Plan Status</span>
        <span className={`${status.color} ${status.bg} px-2 py-1 rounded-md font-black`}>
          {status.label}
        </span>
      </div>
    </motion.div>
  );
}

function MapPlaceholder({ status }: { status: string }) {
  const isOut = status === 'out_for_delivery';
  return (
    <div className="relative h-32 w-full rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden group">
      {/* Abstract Map Background */}
      <div className="absolute inset-0 opacity-20 grayscale transition-all group-hover:grayscale-0 group-hover:opacity-30 duration-700"
        style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '16px 16px' }} 
      />
      
      {/* Route Line */}
      <div className="absolute top-1/2 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-slate-300 transform -translate-y-1/2" />
      
      {/* Origin Pin */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm">
          <ChefHat size={12} className="text-slate-400" />
        </div>
        <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest">Kitchen</span>
      </div>

      {/* Destination Pin */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-500 flex items-center justify-center shadow-sm">
          <MapPin size={12} className="text-blue-600" />
        </div>
        <span className="text-[8px] font-black text-blue-600 mt-1 uppercase tracking-widest">Home</span>
      </div>

      {/* Moving Bike (Active during delivery) */}
      {isOut && (
        <motion.div 
          initial={{ left: '25%' }}
          animate={{ left: '75%' }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 -mt-3 -ml-3 flex flex-col items-center z-10"
        >
          <div className="bg-sky-600 text-white p-1.5 rounded-full shadow-lg shadow-sky-600/30 ring-2 ring-white">
            <Bike size={14} />
          </div>
          <div className="w-1.5 h-1.5 bg-sky-600 rounded-full mt-0.5 animate-ping opacity-75" />
        </motion.div>
      )}

      {!isOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Live tracking starts when out for delivery</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: DbOrder }) {
  const [expanded, setExpanded] = useState(false);
  const isAutoGen = (order as any).meta?.is_auto_generated === true;
  
  const kindLabel = isAutoGen 
    ? "Subscription Meal" 
    : order.kind === "regular" 
      ? "Regular" 
      : order.kind === "personalized" 
        ? "Personalized Plan" 
        : "Group Order";

  const kindColor = isAutoGen
    ? "bg-blue-100 text-blue-700"
    : order.kind === "regular" 
      ? "bg-sky-100 text-sky-700" 
      : order.kind === "personalized" 
        ? "bg-violet-100 text-violet-700" 
        : "bg-amber-100 text-amber-700";

  const isActive = !["delivered", "cancelled"].includes(order.status);
  const isOut = order.status === 'out_for_delivery';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl border bg-white overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group",
        isActive ? "border-blue-100 ring-4 ring-blue-50/50" : "border-slate-100 grayscale-[0.8] opacity-90"
      )}
    >
      {/* Main Track Section (Always Visible) */}
      <div className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-black text-slate-900 text-base tracking-tight">#{order.order_number}</span>
              <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest", kindColor)}>{kindLabel}</span>
              {isActive && (
                <div className="relative flex items-center gap-1.5 text-[10px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-black border border-blue-200 uppercase tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                  </span>
                  {(() => {
                    const nowHour = new Date().getHours();
                    const label = order.order_items?.[0]?.item_name || "";
                    const isToday = new Date(order.delivery_date).toDateString() === new Date().toDateString();
                    
                    if (isToday) {
                      if (nowHour >= 4 && nowHour < 8 && label.includes('[Breakfast]')) return "Live Tracking · Breakfast Slot";
                      if (nowHour >= 11 && nowHour < 13 && label.includes('[Lunch]')) return "Live Tracking · Lunch Slot";
                      if (nowHour >= 17 && nowHour < 20 && label.includes('[Dinner]')) return "Live Tracking · Dinner Slot";
                    }
                    return "Live tracking";
                  })()}
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-slate-400 capitalize">{formatDate(order.created_at)}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-slate-900 text-lg tracking-tighter">{formatINR(order.total)}</div>
            <div className={cn("text-[10px] font-black uppercase mt-0.5 tracking-widest", 
              order.payment_status === "paid" ? "text-blue-600" : 
              order.payment_status === "cod_pending" ? "text-amber-600" : "text-slate-400"
            )}>
              {order.payment_status === "cod_pending" ? "COD" : order.payment_status}
            </div>
          </div>
        </div>

        {/* Status timeline */}
        <StatusTimeline status={order.status} />

        {/* ETA & Map Section for Active Orders */}
        {isActive && (
          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <Navigation size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Arrival</p>
                  <p className="text-sm font-black text-slate-900">
                    {(() => {
                      if (isOut) return "15-25 mins";
                      
                      // Find the first slot in the items
                      const firstItem = order.order_items?.[0]?.item_name || "";
                      const slotMatch = firstItem.match(/\[(Slot\d|Breakfast|Lunch|Dinner)\]/i);
                      if (slotMatch) {
                        const slot = slotMatch[1].toLowerCase();
                        if (slot === 'slot1' || slot === 'breakfast') return "Today · 8:00 AM";
                        if (slot === 'slot2' || slot === 'lunch') return "Today · 1:00 PM";
                        if (slot === 'slot3' || slot === 'dinner') return "Today · 8:00 PM";
                      }
                      
                      return "Scheduled for Today";
                    })()}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-white border-slate-200">
                <Info size={14} /> Help
              </Button>
            </div>
            
            <MapPlaceholder status={order.status} />
          </div>
        )}

        {/* Expand Trigger */}
        <div 
          className="flex items-center justify-center py-2 border-t border-slate-50 -mx-5 -mb-5 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {expanded ? "Hide Details" : "View Order Details"}
          </span>
        </div>
      </div>

      {/* Expanded items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-100 bg-white"
          >
            <div className="p-5 space-y-4">
              {/* Items */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Contents</p>
                  {order.order_items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-800">
                        <span className="h-6 w-6 rounded bg-white flex items-center justify-center text-[10px] border border-slate-200">{item.quantity}x</span>
                        {item.item_name}
                      </div>
                      <span className="font-black text-slate-900 text-xs">{item.unit_price ? formatINR(item.unit_price * item.quantity) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Delivery address */}
              {order.delivery_details?.building && (
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Address</p>
                  </div>
                  <div className="pl-5">
                    <p className="text-sm font-bold text-slate-800">{order.delivery_details.receiverName} · {order.delivery_details.receiverPhone}</p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">{[order.delivery_details.building, order.delivery_details.street, order.delivery_details.area].filter(Boolean).join(", ")}</p>
                    {order.delivery_details.instructions && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100/50 flex items-start gap-2">
                        <span className="text-[10px]">📝</span>
                        <p className="text-[11px] font-bold text-amber-700 italic leading-relaxed">{order.delivery_details.instructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions for Active Orders in Footer */}
              {isActive && (
                <div className="pt-4 flex gap-3">
                  <Button className="flex-1 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black text-xs uppercase tracking-widest gap-2">
                    <Phone size={16} /> Contact Support
                  </Button>
                  <Button variant="outline" className="flex-1 h-11 rounded-2xl border-slate-200 font-black text-xs uppercase tracking-widest text-rose-600 hover:bg-rose-50 hover:border-rose-100">
                    Cancel Order
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function OrderTrackingPage({
  user,
  setRoute,
}: {
  user: AppUser | null;
  setRoute: (r: Route) => void;
}) {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all" | "subscriptions">("active");
  const [fetchError, setFetchError] = useState("");

  async function fetchOrders() {
    if (!user?.id) return;
    setLoading(true);
    setFetchError("");
    
    // 1. Fetch regular/group orders
    const { data: ordData, error: ordErr } = await supabase
      .from("orders")
      .select(`*, order_items(id, item_name, quantity, unit_price)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // 2. Fetch active/paused subscriptions
    const { data: subData, error: subErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ordErr || subErr) {
      setFetchError(ordErr?.message || subErr?.message || "Fetch failed");
    } else {
      // Parse meta field if it's a string
      const parsedOrders = (ordData || []).map(o => ({
        ...o,
        meta: typeof o.meta === 'string' ? JSON.parse(o.meta) : o.meta
      }));
      setOrders(parsedOrders as DbOrder[]);
      setSubscriptions(subData || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();

    // Realtime updates for this user's orders
    const ordChannel = supabase
      .channel("order-tracking-ord")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `user_id=eq.${user?.id}`,
      }, () => fetchOrders())
      .subscribe();

    // Realtime updates for subscriptions
    const subChannel = supabase
      .channel("order-tracking-sub")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${user?.id}`,
      }, () => fetchOrders())
      .subscribe();

    return () => { 
      supabase.removeChannel(ordChannel); 
      supabase.removeChannel(subChannel);
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (filter === "subscriptions") {
      // 1. Map modern subscriptions from the dedicated table
      const fromSubsTable = subscriptions
        .filter(s => !['cancelled', 'completed', 'expired'].includes(s.status?.toLowerCase()))
        .map(s => ({
        id: s.id,
        order_number: s.meta?.orderNumber || s.id.slice(0, 8),
        created_at: s.created_at,
        delivery_date: s.start_date,
        status: s.status,
        kind: 'personalized',
        payment_status: s.payment_status,
        total: s.total,
        customer_name: s.customer_name || s.delivery_details?.receiverName,
        delivery_details: s.delivery_details,
        duration_days: s.duration_days,
        order_items: (s.schedule || []).map((l: any) => ({
          id: l.itemId,
          item_name: l.label,
          quantity: l.qty,
          unit_price: l.unitPriceAtOrder
        }))
      }));

      // 2. Map legacy personalized orders that might not be in the subscriptions table
      // We filter for orders where kind is personalized/subscription and NOT auto-generated
      const fromOrdersTable = orders
        .filter(o => (o.kind === 'personalized' || o.kind === 'subscription') && !o.meta?.is_auto_generated)
        // Only show active/ready/new/preparing statuses for the subscriptions tab
        .filter(o => ['active', 'ready', 'new', 'preparing'].includes(o.status?.toLowerCase()))
        // Avoid duplicates if they are already in fromSubsTable (though IDs should differ)
        .filter(o => !fromSubsTable.some(s => s.id === o.id))
        .map(o => ({
          ...o,
          duration_days: o.meta?.durationDays || 30 // Fallback
        }));

      return [...fromSubsTable, ...fromOrdersTable];
    }

    // Active and History tabs: only show regular/group orders
    // We hide ALL personalized/subscription orders here because they have their own tab
    const list = filter === "active"
      ? orders.filter(o => !["delivered", "cancelled"].includes(o.status))
      : orders;
    return list.filter(o =>
      !o.meta?.is_auto_generated &&
      o.kind !== 'personalized' &&
      o.kind !== 'subscription'
    );
  }, [orders, filter, subscriptions]);

  // Grouped deliveries for the Subscriptions tab
  const getSubDeliveries = (subId: string) => {
    return orders
      .filter(o => {
        const meta = (o as any).meta;
        return meta?.subscription_id === subId || meta?.parentId === subId;
      })
      .sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime());
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setRoute("home")} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Orders</h1>
            <p className="text-sm text-slate-500">Track your deliveries in real time</p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 self-start w-fit">
        {(["active", "subscriptions", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-bold transition-all capitalize",
              filter === f ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f === "active" ? "Active" : f === "subscriptions" ? "Subscriptions" : "History"}
          </button>
        ))}
      </div>

      {/* Content */}
      {!user ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">Please sign in to view your orders.</p>
            <Button className="mt-4" onClick={() => setRoute("home")}>Go to Home</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <SkeletonTrackingCard />
          <SkeletonTrackingCard />
        </div>
      ) : fetchError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-rose-600 font-medium">{fetchError}</p>
            <Button variant="outline" className="mt-4" onClick={fetchOrders}>Try Again</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Package size={44} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500 font-medium text-base">
              {filter === "active" ? "No active orders right now." : "You haven't placed any orders yet."}
            </p>
            {filter === "active" && orders.length > 0 && (
              <button onClick={() => setFilter("all")} className="mt-2 text-blue-600 text-sm font-semibold underline">
                View all orders
              </button>
            )}
            <Button className="mt-4" onClick={() => setRoute("home")}>Order Now</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filtered.map((order: any) => (
            <div key={order.id} className="space-y-4">
              {filter === 'subscriptions' ? (
                <SubscriptionSummaryCard subscription={order} />
              ) : (
                <OrderCard order={order} />
              )}
              
              {/* If in Subscriptions tab, show children deliveries */}
              {filter === 'subscriptions' && (
                <div className="ml-6 pl-6 border-l-2 border-slate-100 space-y-4 pb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Deliveries</h4>
                  {getSubDeliveries(order.id).length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                      <p className="text-xs font-bold text-slate-400 italic">No deliveries generated yet for this subscription.</p>
                    </div>
                  ) : (
                    getSubDeliveries(order.id).map(child => (
                      <OrderCard key={child.id} order={child} />
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

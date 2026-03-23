import { useState, useEffect, useMemo, useRef } from "react";
import type { AppUser, Route } from "../types";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { SkeletonTrackingCard } from "../components/ui/Skeleton";
import { Package, Clock, ChefHat, Bike, CheckCircle2, RefreshCw, ArrowLeft, Phone, Info, MapPin, Navigation, ShieldCheck, Ban } from "lucide-react";
import { cn } from "../lib/utils";
import { useAppSetting, useAppSettingString } from "../hooks/useAppSettings";

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

// SUPPORT_PHONE and SUPPORT_WA are now dynamic via useAppSettingString

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

function getISTDate() {
  const dt = new Date();
  dt.setHours(dt.getHours() + 5);
  dt.setMinutes(dt.getMinutes() + 30);
  return dt.toISOString().slice(0, 10);
}

function getSlotName(itemName: string): string {
  const lower = itemName.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('slot1')) return 'Breakfast';
  if (lower.includes('lunch') || lower.includes('slot2')) return 'Lunch';
  if (lower.includes('dinner') || lower.includes('slot3')) return 'Dinner';
  return 'Meal';
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



function SecretPINCard({ otp, isPickup }: { otp: string, isPickup?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 shadow-xl shadow-indigo-500/20 border border-indigo-500/30"
    >
      {/* Decorative radial glow */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30 shrink-0"
          >
            <ShieldCheck size={22} className="text-white" />
          </motion.div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">🔒 {isPickup ? 'Secret Pickup PIN' : 'Secret Delivery PIN'}</p>
            <p className="text-xs font-bold text-white/80 leading-tight pr-2">
              {isPickup ? 'Show this PIN at the counter to collect your order' : 'Share with your delivery partner when they arrive'}
            </p>
          </div>
        </div>

        {/* PIN Digits */}
        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 px-1 sm:px-0 justify-between sm:justify-start">
          {otp.split('').map((digit, i) => (
            <div key={i} className="w-10 sm:w-10 h-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <span className="text-2xl font-black text-white tracking-tight">{digit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/70">
          {isPickup ? 'Store is preparing your order · Keep this PIN ready' : 'Delivery partner is on the way · Keep this PIN ready'}
        </p>
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

function SupportModal({ 
  isOpen, 
  onClose, 
  order,
  onInbox,
  supportPhone,
  supportWhatsApp,
  chatEnabled
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  order: DbOrder | null;
  onInbox: () => void;
  supportPhone: string;
  supportWhatsApp: string;
  chatEnabled: boolean;
}) {
  if (!isOpen || !order) return null;

  const orderNum = order.order_number;
  const slot = getSlotName(order.order_items?.[0]?.item_name || "");
  const waMessage = encodeURIComponent(`Hi THE FIT BOWLS, I need help with my order #${orderNum} (${slot} Slot).`);
  const waUrl = `https://wa.me/${supportWhatsApp}?text=${waMessage}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900">Contact Support</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Order #{orderNum}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <ArrowLeft className="rotate-90 text-slate-400" size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <a 
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Navigation size={24} className="rotate-45" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-emerald-900">WhatsApp Support</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Fastest Response</p>
              </div>
            </a>

            <a 
              href={`tel:${supportPhone}`}
              className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                <Phone size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-blue-900">Call Hotline</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Direct Assistance</p>
              </div>
            </a>

            {chatEnabled && (
              <button 
                onClick={() => { onInbox(); onClose(); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform">
                  <Info size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-slate-900">Chef Inbox</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Non-Urgent Queries</p>
                </div>
              </button>
            )}
          </div>

          <p className="text-[10px] text-center text-slate-400 font-bold mt-6 uppercase tracking-widest">
            Available daily 8:00 AM - 9:00 PM
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function OrderCard({ order, onCancel, onSupport, storeMapUrl }: { order: DbOrder, onCancel?: (id: string, status: string) => void, onSupport?: (o: DbOrder) => void, storeMapUrl?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const orderMeta = (order as any).meta || {};
  const isAutoGen = orderMeta?.is_auto_generated === true;
  
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

  const isForecast = orderMeta?.is_forecast === true;

  const isActive = !["delivered", "cancelled"].includes(order.status);
  const isOut = order.status === 'out_for_delivery';

  // Fetch delivery assignment for active orders
  useEffect(() => {
    if (!isActive) return;

    let ch: any;
    async function fetchAssignment() {
      const { data } = await supabase
        .from("delivery_assignments")
        .select(`
          id, status, delivery_boy_id,
          delivery_boys ( name, phone, vehicle )
        `)
        .eq("order_id", order.id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAssignment(data);
    }
    fetchAssignment();

    // Realtime: update when delivery boy changes status
    ch = supabase
      .channel(`order-tracking-assign-${order.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "delivery_assignments",
        filter: `order_id=eq.${order.id}`,
      }, fetchAssignment)
      .subscribe();

    return () => { if (ch) supabase.removeChannel(ch); };
  }, [order.id, isActive]);

  // Dynamic ETA text from assignment status
  const etaText = (() => {
    if (!assignment) {
      if (isOut) return "15–25 mins";
      const firstItem = order.order_items?.[0]?.item_name || "";
      const slotMatch = firstItem.match(/\[(Slot\d|Breakfast|Lunch|Dinner)\]/i);
      if (slotMatch) {
        const slot = slotMatch[1].toLowerCase();
        if (slot === 'slot1' || slot === 'breakfast') return "Today · 8:00 AM";
        if (slot === 'slot2' || slot === 'lunch') return "Today · 1:00 PM";
        if (slot === 'slot3' || slot === 'dinner') return "Today · 8:00 PM";
      }
      return "Scheduled for Today";
    }
    const ast = assignment.status;
    if (ast === 'assigned')         return "Delivery partner assigned";
    if (ast === 'picked_up')        return "Being picked up 🏍️";
    if (ast === 'out_for_delivery') return "On the way! 15–25 mins 🛵";
    if (ast === 'delivered')        return "Delivered! 🎉";
    return "15–25 mins";
  })();

  // Maps link for customer's pin
  const dd = order.delivery_details;
  const mapsLink = dd?.lat && dd?.lng
    ? `https://maps.google.com/?q=${dd.lat},${dd.lng}`
    : dd ? `https://maps.google.com/?q=${encodeURIComponent([dd.building, dd.street, dd.area].filter(Boolean).join(", "))}` : null;

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
            {isAutoGen ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const label = order.order_items?.[0]?.item_name || "";
                    const isBreakfast = label.includes('[Breakfast]') || label.includes('[Slot1]');
                    const isLunch = label.includes('[Lunch]') || label.includes('[Slot2]');
                    const isDinner = label.includes('[Dinner]') || label.includes('[Slot3]');
                    
                    const icon = isBreakfast ? '🍳' : isLunch ? '🍱' : isDinner ? '🥘' : '🍲';
                    const slotName = isBreakfast ? 'Breakfast' : isLunch ? 'Lunch' : isDinner ? 'Dinner' : 'Meal';
                    const slotBg = isBreakfast ? 'bg-orange-100 text-orange-700' : isLunch ? 'bg-green-100 text-green-700' : isDinner ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700';
                    
                    return (
                      <>
                        <span className="text-xl shrink-0">{icon}</span>
                        <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest", slotBg)}>
                          {slotName}
                        </span>
                      </>
                    );
                  })()}
                  <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100")}>
                    Plan Meal
                  </span>
                  {order.status === 'delivered' && (
                    <span className="text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Delivered
                    </span>
                  )}
                  {order.status === 'cancelled' && (
                    <span className="text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200">
                      Cancelled
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-tight tracking-tight">
                  {(order.order_items?.[0]?.item_name || "Daily Meal").replace(/\[.*?\]\s*/, '')}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-slate-400">#{order.order_number}</span>
                  <span className="text-slate-300">·</span>
                  <p className="text-[10px] font-bold text-slate-400 capitalize">{formatDate(order.created_at)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-black text-slate-900 text-base tracking-tight">#{order.order_number}</span>
                <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest", kindColor)}>{kindLabel}</span>
                {order.status === 'delivered' && (
                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Delivered
                  </span>
                )}
                {order.status === 'cancelled' && (
                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200">
                    Cancelled
                  </span>
                )}
              </div>
            )}
            
            {isActive && (
              <div className="relative inline-flex items-center gap-1.5 text-[10px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-black border border-blue-200 uppercase tracking-widest">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                {isForecast ? "EXPECTED TODAY" : (() => {
                  const nowHour = new Date().getHours();
                  const label = order.order_items?.[0]?.item_name || "";
                  const isToday = new Date(order.delivery_date).toDateString() === new Date().toDateString();
                  
                  if (isToday) {
                    if (nowHour >= 4 && nowHour < 10 && (label.includes('[Breakfast]') || label.includes('[Slot1]'))) return "Live Tracking · Breakfast Slot";
                    if (nowHour >= 11 && nowHour < 15 && (label.includes('[Lunch]') || label.includes('[Slot2]'))) return "Live Tracking · Lunch Slot";
                    if (nowHour >= 17 && nowHour < 21 && (label.includes('[Dinner]') || label.includes('[Slot3]'))) return "Live Tracking · Dinner Slot";
                  }
                  return "Live tracking";
                })()}
              </div>
            )}
            {!isAutoGen && <p className="text-xs font-bold text-slate-400 capitalize mt-1">{formatDate(order.created_at)}</p>}
          </div>
          <div className="text-right shrink-0">
            {isAutoGen && order.total === 0 ? (
              <div className="flex flex-col items-end">
                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest border border-emerald-200">
                  Pre-paid Plan
                </div>
                <div className="text-[10px] font-black uppercase mt-1 tracking-widest text-emerald-600">
                  Full Access
                </div>
              </div>
            ) : (
              <>
                <div className="font-black text-slate-900 text-lg tracking-tighter">{formatINR(order.total)}</div>
                <div className={cn("text-[10px] font-black uppercase mt-0.5 tracking-widest", 
                  order.payment_status === "paid" ? "text-blue-600" : 
                  order.payment_status === "cod_pending" ? "text-amber-600" : "text-slate-400"
                )}>
                  {order.payment_status === "cod_pending" ? "COD" : order.payment_status}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 🔒 Secret Delivery PIN Card — fetched live, appears as soon as OTP is generated */}
        {orderMeta?.delivery_otp && !['delivered', 'cancelled'].includes(order.status) && (
          <div className="mb-6">
            <SecretPINCard otp={orderMeta.delivery_otp} isPickup={order.delivery_details?.isPickup} />
          </div>
        )}

        {/* Status timeline */}
        <StatusTimeline status={order.status} />

        {/* 🛵 Delivery Partner Info — shown as soon as assigned */}
        {assignment?.delivery_boys && !['cancelled'].includes(order.status) && (
          <div className={cn(
            "mt-4 p-4 rounded-2xl border transition-all duration-500",
            isOut ? "bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100 shadow-sm" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between mb-2">
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-500">🛵 Delivery Partner</p>
                  <p className="font-black text-slate-900 text-sm">{assignment.delivery_boys.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{assignment.delivery_boys.vehicle}</p>
               </div>
               {assignment.delivery_boys.phone && (
                 <a
                   href={`tel:${assignment.delivery_boys.phone}`}
                   className="flex items-center gap-2 bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm"
                 >
                   <Phone size={12} /> Call Partner
                 </a>
               )}
            </div>
            
            <div className="flex items-center gap-2">
               <p className="text-[10px] font-bold text-sky-700 bg-sky-100/50 border border-sky-100 px-2 py-1 rounded-lg inline-block">
                 {assignment.status === 'assigned' ? "Preparing for pickup" : etaText}
               </p>
               {assignment.status === 'out_for_delivery' && (
                 <span className="flex h-2 w-2 relative">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                 </span>
               )}
            </div>
          </div>
        )}

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
                  <p className="text-sm font-black text-slate-900">{etaText}</p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onSupport?.(order)}
                className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-white border-slate-200"
              >
                <Info size={14} /> Contact
              </Button>
            </div>
            
            <MapPlaceholder status={order.status} />

            {/* Open in Maps button */}
            {order.delivery_details?.isPickup ? (
              <a
                href={storeMapUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-md shadow-emerald-200"
              >
                <Navigation size={14} className="rotate-45" /> Get Directions to Store
              </a>
            ) : mapsLink ? (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 font-bold text-xs uppercase tracking-widest py-2.5 rounded-xl transition-all"
              >
                <MapPin size={13} /> View Your Delivery Location on Maps
              </a>
            ) : null}
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
                <div className="pt-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 h-11 rounded-full bg-blue-600 hover:bg-blue-700 font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-blue-200"
                      onClick={() => onSupport?.(order)}
                    >
                      <Phone size={16} /> Contact Support
                    </Button>
                    {!isAutoGen && order.status !== 'out_for_delivery' && (
                      <Button 
                        variant="outline" 
                        className="flex-1 h-11 rounded-full border-slate-200 font-black text-xs uppercase tracking-widest text-rose-600 hover:bg-rose-50 hover:border-rose-100"
                        onClick={() => onCancel?.(order.id, order.status)}
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>
                  {/* Cancellation blocked banner when out for delivery */}
                  {order.status === 'out_for_delivery' && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-rose-50 border border-rose-200"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <Ban size={15} className="text-rose-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-rose-700 uppercase tracking-widest">Cancellation Locked</p>
                        <p className="text-[11px] font-bold text-rose-500 leading-tight">Your order is already on the way. Please contact support if there's an issue.</p>
                      </div>
                    </motion.div>
                  )}
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
  showToast,
}: {
  user: AppUser | null;
  setRoute: (r: Route) => void;
  showToast?: (msg: string) => void;
}) {
  const supportPhoneRes = useAppSettingString("support_phone", "08500929080");
  const supportWhatsAppRes = useAppSettingString("support_whatsapp", "918500929080");
  const storeMapUrlRes = useAppSettingString("store_map_url", "https://maps.google.com/?q=12.9715987,77.5945627");
  const chatEnabledRes = useAppSetting("chat_enabled", true);

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"regular" | "subscriptions" | "pickup" | "history">("regular");
  const [fetchError, setFetchError] = useState("");
  const [selectedSupportOrder, setSelectedSupportOrder] = useState<DbOrder | null>(null);
  const isFetchingRef = useRef(false);

  async function fetchOrders() {
    if (!user?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setFetchError("");
    console.log("[OrderTracking] Fetching orders for user:", user.id);
    
    try {
      // Fetch both orders (with items) and subscriptions in parallel
      const [ordRes, subRes] = await Promise.all([
        supabase.from("orders")
          .select(`*, order_items(*)`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (ordRes.error) throw ordRes.error;
      if (subRes.error) throw subRes.error;

      const ordData = ordRes.data;
      const subData = subRes.data;

      // Helper to safely parse JSON if it's a string
      const safeParse = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
      };

      // Robust parsing for orders
      const parsedOrders = (ordData || []).map(o => ({
        ...o,
        meta: safeParse(o.meta),
        delivery_details: safeParse(o.delivery_details)
      }));

      // Robust parsing for subscriptions
      const parsedSubs = (subData || []).map(s => ({
        ...s,
        meta: safeParse(s.meta),
        schedule: safeParse(s.schedule),
        delivery_details: safeParse(s.delivery_details),
        targets: safeParse(s.targets)
      }));

      setOrders(parsedOrders as DbOrder[]);
      setSubscriptions(parsedSubs);
    } catch (err: any) {
      console.error("[OrderTracking] CUSTOM ERROR DETAIL:", err);
      // VERY DISTINCT MESSAGE TO VERIFY CODE IS ACTIVE
      const msg = err.message || "Unknown error";
      if (msg === "Failed to fetch" || msg.includes("fetch")) {
        setFetchError("🚨 NETWORK ERROR 🚨: The browser blocked the connection to Supabase. Try refreshing the page or checking your internet.");
      } else {
        setFetchError(`⚠️ FETCH ERROR ⚠️: ${msg}`);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }

  async function handleCancelOrder(orderId: string, status: string) {
    // Hard block: cannot cancel once out for delivery
    if (status === 'out_for_delivery') {
      showToast?.("❌ Cannot cancel: your order is already on the way. Please call support.");
      return;
    }

    const isReady = status === 'ready';
    const warning = isReady 
      ? "\n\n⚠️ NO REFUND AVAILABLE: Since the order is already ready, no refund will be issued if you cancel now." 
      : "";
    
    if (!window.confirm(`Are you sure you want to cancel this order?${warning}`)) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;
      
      showToast?.("Order cancelled successfully.");
      fetchOrders();
    } catch (err: any) {
      console.error("[OrderTracking] Cancel error:", err);
      showToast?.("Failed to cancel order: " + err.message);
    }
  }

  useEffect(() => {
    fetchOrders();

    // Simplified realtime - just watch the table for now
    const ordChannel = supabase
      .channel("ot-ord-simple")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();

    return () => { 
      supabase.removeChannel(ordChannel); 
    };
  }, [user?.id]);

  const todayStr = useMemo(() => getISTDate(), []);

  const filtered = useMemo(() => {
    const isActive = (o: DbOrder) => !["delivered", "cancelled"].includes(o.status);

    if (filter === "regular") {
      return orders.filter(o => isActive(o) && (o.kind === 'regular' || o.kind === 'group') && !o.meta?.is_auto_generated && !o.delivery_details?.isPickup);
    }

    if (filter === "subscriptions") {
      const baseList = orders.filter(o => isActive(o) && o.meta?.is_auto_generated === true);
      
      const slotMap: Record<string, string> = { 'Slot1': 'Breakfast', 'Slot2': 'Lunch', 'Slot3': 'Dinner' };
      const getSlotName = (label: string) => {
        const match = label.match(/\[(Slot\d|Breakfast|Lunch|Dinner)\]/i);
        if (!match) return 'Meal';
        const val = match[1];
        return slotMap[val] || val;
      };

      const nonTodayActuals = baseList.filter(o => o.delivery_date !== todayStr);
      const todayActuals = baseList.filter(o => o.delivery_date === todayStr);

      const slotOrder = ['Breakfast', 'Lunch', 'Dinner'];
      const combinedToday = todayActuals.sort((a, b) => {
        const slotA = getSlotName(a.order_items?.[0]?.item_name || "");
        const slotB = getSlotName(b.order_items?.[0]?.item_name || "");
        return slotOrder.indexOf(slotA) - slotOrder.indexOf(slotB);
      });

      return [...combinedToday, ...nonTodayActuals].sort((a, b) => {
        if (a.delivery_date === todayStr && b.delivery_date !== todayStr) return -1;
        if (a.delivery_date !== todayStr && b.delivery_date === todayStr) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
    }

    if (filter === "pickup") {
      return orders.filter(o => isActive(o) && o.delivery_details?.isPickup === true);
    }

    // History Tab
    return orders.filter(o => !isActive(o)).sort((a,b) => b.created_at.localeCompare(a.created_at));
  }, [orders, filter, subscriptions, todayStr]);



  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Support Modal */}
      <AnimatePresence>
        {selectedSupportOrder && (
          <SupportModal 
            isOpen={!!selectedSupportOrder}
            order={selectedSupportOrder}
            onClose={() => setSelectedSupportOrder(null)}
            onInbox={() => setRoute("home")} 
            supportPhone={supportPhoneRes.value}
            supportWhatsApp={supportWhatsAppRes.value}
            chatEnabled={chatEnabledRes.value}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setRoute("home")} className="text-sm font-semibold text-black/60 hover:text-black transition-colors flex items-center gap-1.5">
            ← Back to Home
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
      <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 self-start w-fit overflow-x-auto hide-scrollbar max-w-full">
        {(["regular", "subscriptions", "pickup", "history"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-bold transition-all capitalize whitespace-nowrap",
              filter === f ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f === "regular" ? "Regular" : f === "subscriptions" ? "Subscriptions" : f === "pickup" ? "Pickups" : "History"}
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
              {filter === "regular" ? "No regular orders found." : 
               filter === "subscriptions" ? "No subscription meals found for today." : 
               filter === "pickup" ? "No pickup orders found." :
               "Your history is currently empty."}
            </p>
            {filter === "regular" && orders.length > 0 && (
              <button onClick={() => setFilter("history")} className="mt-2 text-blue-600 text-sm font-semibold underline">
                View order history
              </button>
            )}
            <Button className="mt-4" onClick={() => setRoute("home")}>Order Now</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filtered.map((order: any) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onCancel={handleCancelOrder} 
              onSupport={(o) => setSelectedSupportOrder(o)}
              storeMapUrl={storeMapUrlRes.value}
            />
          ))}
        </div>
      )}
    </div>
  );
}

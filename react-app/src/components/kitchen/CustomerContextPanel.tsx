import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { User, Package, Sparkles, Phone, Mail, MapPin, Clock, Pencil } from "lucide-react";
import { formatDateIndia, formatDateTimeIndia } from "../../lib/format";
import type { OrderReceipt } from "../../types";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  is_pro: boolean;
  default_delivery?: any;
}

/** Checks whether a personalized subscription order is still active */
export function isSubscriptionActive(order: OrderReceipt): boolean {
  const meta = order.meta as any;
  if (!meta?.durationDays) return false;
  const start = new Date(order.deliveryAtLabel || order.createdAt);
  const end = new Date(start);
  end.setDate(end.getDate() + (meta.durationDays || 30));
  return end.getTime() > Date.now();
}

/** Checks if a customer has an active subscription among given orders */
export function hasActiveSubscription(customerId: string, allOrders: OrderReceipt[]): boolean {
  return allOrders.some(
    o => o.userId === customerId && o.kind === "personalized" && isSubscriptionActive(o)
  );
}

export function CustomerContextPanel({
  customerId,
  allOrders,
  onOrderClick,
}: {
  customerId: string;
  allOrders: OrderReceipt[];
  onOrderClick?: (orderId: string) => void;
}) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setProfile(null);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", customerId)
        .single();
      if (!cancelled && !error && data) {
        setProfile(data as CustomerProfile);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [customerId]);

  const customerOrders = allOrders
    .filter(o => o.userId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  const activeSubscription = customerOrders.find(
    o => o.kind === "personalized" && isSubscriptionActive(o)
  );
  const hasExpiredSub = !activeSubscription && customerOrders.some(o => o.kind === "personalized");

  const statusColor: Record<string, string> = {
    New: "bg-blue-100 text-blue-700",
    Preparing: "bg-amber-100 text-amber-700",
    Ready: "bg-emerald-100 text-emerald-700",
    "Out for delivery": "bg-purple-100 text-purple-700",
    Delivered: "bg-slate-100 text-slate-600",
    Cancelled: "bg-rose-100 text-rose-600",
  };

  if (loading) {
    return (
      <div className="w-72 shrink-0 border-l border-slate-200 bg-slate-50/50 p-4 space-y-3 animate-pulse hidden lg:block">
        <div className="h-12 w-12 rounded-full bg-slate-200 mx-auto" />
        <div className="h-4 bg-slate-200 rounded w-2/3 mx-auto" />
        <div className="h-3 bg-slate-200 rounded w-1/2 mx-auto" />
        <div className="h-20 bg-slate-200 rounded mt-4" />
        <div className="h-16 bg-slate-200 rounded" />
        <div className="h-16 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l border-slate-200 bg-slate-50/50 flex flex-col max-h-[600px] overflow-y-auto hidden lg:flex">
      {/* Profile Header */}
      <div className="p-4 border-b border-slate-200 bg-white text-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-2 shadow-lg">
          <User className="w-7 h-7 text-white" />
        </div>
        <h4 className="font-black text-slate-900 text-base">
          {profile?.full_name || "Unknown"}
        </h4>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
          {profile?.role || "Customer"}
        </p>

        <div className="mt-2 flex justify-center gap-1.5 flex-wrap">
          {activeSubscription && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
              <Sparkles className="w-3 h-3" /> Active Subscription
            </span>
          )}
          {hasExpiredSub && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 line-through">
              Subscription Expired
            </span>
          )}
          {profile?.is_pro && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full border border-violet-200">
              ⭐ Pro Member
            </span>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="p-4 border-b border-slate-200 space-y-2">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact</div>
        {profile?.phone_number && (
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-bold">{profile.phone_number}</span>
          </div>
        )}
        {profile?.email && (
          <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>
        )}
        {profile?.default_delivery && (
          <div className="flex items-start gap-2 text-xs text-slate-600 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {profile.default_delivery.building && `${profile.default_delivery.building}, `}
              {profile.default_delivery.area || "No address saved"}
            </span>
          </div>
        )}
      </div>

      {/* Active Subscription Detail */}
      {activeSubscription && (
        <div className="p-4 border-b border-slate-200">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Plan</div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
            <div className="text-xs font-bold text-emerald-800">
              {(activeSubscription.meta as any)?.plan || "Personalized Subscription"}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">
              {(activeSubscription.meta as any)?.durationDays || 30} days
            </div>
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Started: {formatDateIndia(activeSubscription.deliveryAtLabel || activeSubscription.createdAt)}
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders — Clickable */}
      <div className="p-4 flex-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Recent Orders ({customerOrders.length})
        </div>
        {customerOrders.length === 0 ? (
          <div className="text-xs text-slate-400 italic py-4 text-center">No orders found</div>
        ) : (
          <div className="space-y-2">
            {customerOrders.map(o => (
              <button
                key={o.id}
                onClick={() => onOrderClick?.(o.id)}
                className="w-full text-left bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-slate-700">
                    #{o.orderNumber || o.id.slice(0, 6)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusColor[o.status || "New"] || "bg-slate-100 text-slate-600"}`}>
                      {o.status || "New"}
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {o.lines.length} items · {o.kind}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {formatDateTimeIndia(o.createdAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

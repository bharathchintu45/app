import React, { useState, useMemo } from "react";
import { Package, RefreshCw, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Skeleton, SkeletonOrderCard } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import { formatDateIndia } from "../../lib/format";
import { useAppSetting } from "../../hooks/useAppSettings";
import type { AppUser, OrderReceipt } from "../../types";

interface OrderHistoryProps {
  user: AppUser;
  orders: OrderReceipt[];
  setRoute: (r: any) => void;
  setRegularCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isLoading?: boolean;
  showToast: (msg: string) => void;
}

export function OrderHistory({ user, orders, setRoute, setRegularCart, showToast, isLoading = false }: OrderHistoryProps) {
  const healthPreferencesEnabled = useAppSetting("enable_health_preferences", true);
  const pickupEnabled = useAppSetting("enable_pickup", true);

  const [activeTab, setActiveTab] = useState<"all" | "delivery" | "pickup">("all");

  const filteredOrders = useMemo(() => {
     if (activeTab === "all") return orders;
     if (activeTab === "delivery") return orders.filter(o => !o.customer?.isPickup);
     if (activeTab === "pickup") return orders.filter(o => o.customer?.isPickup);
     return orders;
  }, [orders, activeTab]);

  if (isLoading) {
    return (
      <>
        {/* Order card skeletons */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      </>
    );
  }

  return (
    <>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Recent Orders</h3>
            <span className="text-xs font-bold text-slate-400">{filteredOrders.length} records</span>
          </div>

          {!pickupEnabled.loading && pickupEnabled.value && (
            <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl">
              {(["all", "delivery", "pickup"] as const).map(t => (
                 <button 
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all", 
                      activeTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
                    )}
                 >
                   {t}
                 </button>
              ))}
            </div>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border-2 border-dashed border-slate-100 bg-white">
            <Package size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">{orders.length > 0 ? `No ${activeTab} orders found.` : "No order history found."}</p>
            <Button variant="ghost" className="text-slate-900 mt-2" onClick={() => setRoute("home")}>Place your first order</Button>
          </div>
        ) : (
          filteredOrders.map((o) => {
            const isToday = o.deliveryAtLabel === new Date().toISOString().slice(0, 10);
            const isSubscription = o.kind === 'personalized';

            return (
              <Card key={o.id} className={cn(
                "overflow-hidden border-slate-100 hover:shadow-md transition-shadow group relative",
                isToday && "border-sky-200 ring-1 ring-sky-100 shadow-sky-50"
              )}>
                {isToday && (
                  <div className="absolute top-0 right-0 px-4 py-1.5 bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl z-10 animate-pulse">
                    Live Today
                  </div>
                )}
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-5 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                              o.status === "Delivered" ? "bg-slate-100 text-slate-700" :
                              o.status === "Cancelled" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"
                            )}>
                              {o.status || "Completed"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">#{o.id}</span>
                          </div>
                          <h4 className="text-lg font-black text-slate-800 capitalize">
                            {isSubscription ? "Subscription Delivery" : `${o.kind} Order`}
                          </h4>
                          <div className="text-xs text-slate-400 font-medium">
                            {isSubscription ? `Scheduled for ${o.deliveryAtLabel}` : `Ordered on ${formatDateIndia(o.createdAt)}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-slate-900">₹{o.priceSummary?.total?.toLocaleString()}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.payment}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {o.lines.map((l, idx) => {
                          // Extract slot from label e.g., "[Slot1] Meal Name"
                          const slotMatch = l.label.match(/^\[(Slot\d|Breakfast|Lunch|Dinner)\]\s*(.*)/i);
                          let displayLabel = l.label;
                          let slotTag = "";
                          let slotTime = "";
                          let slotColor = "bg-slate-100 text-slate-600";
                          
                          if (slotMatch) {
                            const rawSlot = slotMatch[1];
                            displayLabel = slotMatch[2];
                            
                            const slotMap: Record<string, string> = {
                              'Slot1': 'Breakfast',
                              'Slot2': 'Lunch',
                              'Slot3': 'Dinner'
                            };
                            const slotTimeMap: Record<string, string> = {
                              'Slot1': '8 AM',
                              'Slot2': '1 PM',
                              'Slot3': '8 PM',
                              'Breakfast': '8 AM',
                              'Lunch': '1 PM',
                              'Dinner': '8 PM'
                            };
                            slotTag = slotMap[rawSlot] || rawSlot;
                            slotTime = slotTimeMap[rawSlot] || "";
                            
                            if (slotTag === 'Breakfast') slotColor = "bg-amber-100 text-amber-700 border-amber-200";
                            if (slotTag === 'Lunch') slotColor = "bg-sky-100 text-sky-700 border-sky-200";
                            if (slotTag === 'Dinner') slotColor = "bg-rose-100 text-rose-700 border-rose-200";
                          }

                          return (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-slate-900 transition-colors">
                                  {l.qty}x
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    {slotTag && (
                                      <span className={cn("text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border flex items-center gap-1", slotColor)}>
                                        {slotTag} {slotTime && <span className="opacity-60">· {slotTime}</span>}
                                      </span>
                                    )}
                                    <div className="text-sm font-bold text-slate-800">{displayLabel}</div>
                                  </div>
                                  {user.isPro && l.calories && (!healthPreferencesEnabled.loading && healthPreferencesEnabled.value) && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] font-black text-slate-600/70 border border-slate-200 bg-slate-50 px-1.5 rounded-md uppercase">{l.calories} kcal</span>
                                      <span className="text-[9px] font-black text-sky-600/70 border border-sky-100 bg-sky-50 px-1.5 rounded-md uppercase">{l.protein}g protein</span>
                                    </div>
                                  ) }
                                </div>
                              </div>
                              <div className="text-xs font-bold text-slate-500">₹{(l.unitPriceAtOrder || 0) * l.qty}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="w-full md:w-32 bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100 p-4 flex md:flex-col items-center justify-center gap-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full h-10 border-slate-200 text-slate-600 bg-white shadow-sm hover:border-slate-300 hover:text-slate-900"
                        onClick={() => {
                          if (o.kind !== "regular") {
                            showToast("Reordering subscriptions is handled via the dashboard.");
                            return;
                          }
                          const newCart: Record<string, number> = {};
                          o.lines.forEach(l => {
                            newCart[l.itemId] = (newCart[l.itemId] || 0) + l.qty;
                          });
                          setRegularCart(prev => ({ ...prev, ...newCart }));
                          setRoute("checkout-regular");
                        }}
                      >
                        <RefreshCw size={14} className="mr-1.5" /> Reorder
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-full h-10 text-slate-400 hover:text-slate-600 hover:bg-white"
                        onClick={() => showToast("Receipt generation available for Pro accounts. Coming soon!")}
                      >
                        <Plus size={14} className="mr-1.5" /> Receipt
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

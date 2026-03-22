import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/Typography";
import { UtensilsCrossed, ArrowRight, Search, ShoppingBag, X, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSetting, useAppSettingNumber, useAppSettingString } from "../../hooks/useAppSettings";
import { clamp, digitsOnly, formatDateIndia, dayKey } from "../../lib/format";
import { SkeletonMenuCard } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { GroupOrderDraft, GroupCart, MenuItem } from "../../types";
import { CATS } from "../../data/menu";

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-normal sm:tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>;
}

function getItemImage(it: MenuItem) {
  return it.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80';
}

interface GroupOrderViewProps {
  menu: MenuItem[];
  isLoading?: boolean;
  groupDraft: GroupOrderDraft;
  setGroupDraft: React.Dispatch<React.SetStateAction<GroupOrderDraft>>;
  groupCart: GroupCart;
  setGroupCart: React.Dispatch<React.SetStateAction<GroupCart>>;
  setRoute: (r: any) => void;
  setModalItem: (item: MenuItem | null) => void;
  showToast: (msg: string) => void;
}

export function GroupOrderView({
  menu,
  isLoading,
  groupDraft,
  setGroupDraft,
  groupCart,
  setGroupCart,
  setRoute,
  setModalItem,
  showToast,
}: GroupOrderViewProps) {
  const groupDiscount = useAppSettingNumber("group_discount_pct", 0);
  const [groupCat, setGroupCat] = React.useState<import("../../types").Cat>("All-Day Kitchen");
  const [groupSearch, setGroupSearch] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Handle back button to close cart drawer
  React.useEffect(() => {
    if (isCartOpen) {
      window.history.pushState({ cartOpen: true }, "");
      const handlePop = () => setIsCartOpen(false);
      window.addEventListener("popstate", handlePop);
      return () => window.removeEventListener("popstate", handlePop);
    }
  }, [isCartOpen]);

  const enableStoreTimings = useAppSetting("enable_store_timings", true);

  const storeOpenWeekday = useAppSettingString("store_open_weekday", "06:00");
  const storeCloseWeekday = useAppSettingString("store_close_weekday", "21:00");
  const storeOpenWeekend = useAppSettingString("store_open_weekend", "09:00");
  const storeCloseWeekend = useAppSettingString("store_close_weekend", "21:00");

  const storeTimings = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;

    const openStr = isWeekend ? storeOpenWeekend.value : storeOpenWeekday.value;
    const closeStr = isWeekend ? storeCloseWeekend.value : storeCloseWeekday.value;

    const [openH, openM] = openStr.split(':').map(Number);
    const [closeH, closeM] = closeStr.split(':').map(Number);

    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;

    // Correctly handle midnight rollovers (e.g., 9 AM to 1 AM)
    let isOpenWithinHours = false;
    if (closeTime < openTime) {
      isOpenWithinHours = currentTime >= openTime || currentTime < closeTime;
    } else {
      isOpenWithinHours = currentTime >= openTime && currentTime < closeTime;
    }

    // Admin override
    const isOpen = !enableStoreTimings.value || isOpenWithinHours;

    // Cutoff logic (3 hours before closing)
    // If it's a rollover, and we are in the evening (before midnight), 
    // we compare currentTime against (closeTime + 1440 - 180).
    // If we are after midnight, we compare against (closeTime - 180).
    
    let isTooLateForToday = false;
    if (enableStoreTimings.value) {
      const adjustedCloseTime = closeTime < openTime && currentTime >= openTime ? closeTime + 1440 : closeTime;
      const adjustedCurrentTime = currentTime;
      // If we are currently "within hours" or it's just later than opening
      if (isOpenWithinHours) {
        isTooLateForToday = adjustedCurrentTime >= (adjustedCloseTime - 180);
      }
    }
    
    return {
      isOpen,
      closeTime: closeStr,
      isTooLateForToday
    };
  }, [storeOpenWeekday.value, storeCloseWeekday.value, storeOpenWeekend.value, storeCloseWeekend.value, enableStoreTimings.value]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    menu.filter((m) => m.category === groupCat).forEach(m => {
      m.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [menu, groupCat]);

  const groupFilteredMenu = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return menu
      .filter((m) => m.category === groupCat)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .filter((m) => !selectedTag || m.tags?.includes(selectedTag));
  }, [menu, groupCat, groupSearch, selectedTag]);

  // Reset tag when category changes
  React.useEffect(() => {
    setSelectedTag(null);
  }, [groupCat]);

  const groupCartItems = useMemo(() => {
    return Object.entries(groupCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: menu.find((m) => m.id === id), qty }))
      .filter((x) => !!x.item) as { item: MenuItem; qty: number }[];
  }, [groupCart, menu]);

  const totalUnits = useMemo(() => Object.values(groupCart).reduce((a, b) => a + b, 0), [groupCart]);
  const subtotal = useMemo(() => {
    return groupCartItems.reduce((acc, { item, qty }) => {
      const price = Math.round((item.priceINR || 0) * (1 - groupDiscount.value/100));
      return acc + (price * qty);
    }, 0);
  }, [groupCartItems, groupDiscount.value]);

  function addToGroup(item: MenuItem, delta: number) {
    const isAvailable = item.available !== false;
    if (!isAvailable && delta > 0) return;
    
    const deliveryHour = groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).getHours() : new Date().getHours();
    if (item.category === "Midday-Midnight Kitchen" && deliveryHour < 11 && delta > 0) {
      showToast("Midday-Midnight items available from 11 AM to Midnight.");
      return;
    }

    setGroupCart((prev) => {
      const next = { ...prev };
      const cur = next[item.id] || 0;
      const newQty = clamp(cur + delta, 0, 999);
      if (newQty <= 0) delete next[item.id];
      else next[item.id] = newQty;
      return next;
    });
  }

  const groupLeadOk = useMemo(() => {
    if (!groupDraft.deliveryAt) return false;
    const now = new Date();
    const delivery = new Date(groupDraft.deliveryAt);
    
    // Hard restriction: If it's too late for today, don't allow today's orders
    const todayStr = dayKey(now);
    const deliveryDayStr = dayKey(delivery);
    if (deliveryDayStr === todayStr && storeTimings.isTooLateForToday) return false;

    const hours = (delivery.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (groupDraft.people >= 61) return hours >= 24;
    if (groupDraft.people >= 31) return hours >= 6;
    return hours >= 1;
  }, [groupDraft.deliveryAt, groupDraft.people, storeTimings]);

  function goGroupCheckout() {
    if (groupDraft.people < 2 || groupDraft.people > 100) { showToast("Group meals: people must be between 2 and 100."); return; }
    if (!groupLeadOk) { showToast("Group meals: delivery time must follow strict notice (≤30 items: 1–3 hrs, 31–60 items: 6 hrs, 61+ items: 24 hrs)."); return; }
    if (!groupCartItems.length) { showToast("Please add at least one item for the group order."); return; }
    setRoute("checkout-group");
  }

  return (
    <>
    <Card className="mt-6">
      <CardHeader>
        <SectionTitle icon={UtensilsCrossed} title="Group Meals builder" subtitle="No macro totals; choose items + quantities." />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* ... Headcount & Delivery ... */}
          <div className="rounded-2xl border border-black/10 p-3">
            <div className="text-sm font-semibold">Headcount</div>
            <div className="mt-2 flex items-center gap-3">
              <Input
                value={String(groupDraft.people)}
                onChange={(e) => setGroupDraft((p) => ({ ...p, people: clamp(Number(digitsOnly(e.target.value) || "0"), 0, 100) }))}
                inputMode="numeric"
                className="max-w-[120px]"
              />
              <span className="text-sm text-black/55">guests (2–100)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-3">
            <div className="text-sm font-semibold">Delivery date & time</div>
            <div className="mt-2 space-y-2">
              <Input type="datetime-local" value={groupDraft.deliveryAt} onChange={(e) => setGroupDraft((p) => ({ ...p, deliveryAt: e.target.value }))} className="w-full" />
              <div className="text-xs text-black/55">
                Selected: {groupDraft.deliveryAt ? formatDateIndia(groupDraft.deliveryAt.split('T')[0]) + ' ' + (groupDraft.deliveryAt.split('T')[1] || '') : "Not set"}
              </div>
              <div className={cn("text-xs font-medium", groupLeadOk ? "text-slate-600" : "text-amber-700 font-bold")}>
                {storeTimings.isTooLateForToday && groupDraft.deliveryAt && dayKey(new Date(groupDraft.deliveryAt)) === dayKey(new Date())
                  ? `⚠️ Same-day orders disabled. Cutoff was 3hrs before store closing (${storeTimings.closeTime}).`
                  : `Notice required: ${groupDraft.people >= 61 ? "24 hrs (61+ items)" : groupDraft.people >= 31 ? "6 hrs (31-60 items)" : "1–3 hrs (≤30 items)"}`
                }
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-sm font-semibold">Notes (optional)</div>
          <div className="mt-2">
            <Textarea value={groupDraft.notes} onChange={(e) => setGroupDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g., mild spice, extra napkins" />
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-3">
            <div className="flex flex-wrap gap-2">
              {CATS.map((c: string) => (
                <Button key={c} size="sm" variant={groupCat === c ? "secondary" : "outline"} onClick={() => setGroupCat(c as any)}>
                  {c}
                </Button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                value={groupSearch} 
                onChange={(e: any) => setGroupSearch(e.target.value)} 
                placeholder="Search items…" 
                className="pl-10 bg-white border-slate-200 h-8 text-sm w-full" 
              />
            </div>
          </div>

          {/* Tag Filter Row */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
              <button
                onClick={() => setSelectedTag(null)}
                className={cn(
                  "whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                  !selectedTag 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-black/60 border-black/10 hover:border-black/20"
                )}
              >
                All
              </button>
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1.5",
                    selectedTag === tag
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : "bg-white text-black/60 border-black/10 hover:border-black/20"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="text-sm font-semibold mb-3">Add items</div>
          <div className="grid gap-2 md:grid-cols-2 max-h-[500px] overflow-y-auto pr-2 pb-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonMenuCard key={i} />
              ))
            ) : (
              groupFilteredMenu.map((it) => {
                const qty = groupCart[it.id] || 0;
                return (
                  <div key={it.id} className="rounded-2xl border border-black/10 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <img onClick={() => setModalItem(it)} src={getItemImage(it)} alt={it.name} className="w-20 h-20 rounded-xl object-cover shrink-0 cursor-pointer shadow-sm" loading="lazy" />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModalItem(it)}>
                          <div className="font-bold text-sm leading-tight text-slate-900 hover:text-emerald-600 transition-colors mb-0.5">{it.name}</div>
                          {it.description && <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{it.description}</div>}
                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                            <Pill>{it.calories} kcal</Pill>
                            <Pill>P {it.protein}g</Pill>
                            {typeof it.priceINR === "number" && (
                              <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-[10px] line-through text-slate-400">₹{it.priceINR}</span>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm">
                                  ₹{Math.round(it.priceINR * (1 - groupDiscount.value/100))}
                                </span>
                              </div>
                            )}
                            {it.available === false && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Unavailable</span>}
                            {it.available !== false && it.category === "Midday-Midnight Kitchen" && (groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).getHours() : new Date().getHours()) < 11 && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Available from 11 AM</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end sm:flex-col sm:items-end self-stretch sm:self-center shrink-0 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                        {qty === 0 ? (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-sm font-bold shadow-sm border-emerald-500 disabled:opacity-50 disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed"
                            onClick={(e) => { e.stopPropagation(); addToGroup(it, 1); }}
                            disabled={it.available === false || (it.category === "Midday-Midnight Kitchen" && (groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).getHours() : new Date().getHours()) < 11)}
                          >
                            Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg border border-emerald-200 p-1 shadow-sm h-8">
                            <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToGroup(it, -1); }}>−</Button>
                            <div className="w-5 text-center text-xs font-black text-emerald-800">{qty}</div>
                            <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" onClick={(e) => { e.stopPropagation(); addToGroup(it, +1); }} disabled={it.available === false || (it.category === "Midday-Midnight Kitchen" && (groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).getHours() : new Date().getHours()) < 11)}>+</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Sticky Floating Cart/Checkout Bar */}
    <AnimatePresence>
      {totalUnits > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="fixed bottom-6 left-0 right-0 z-50 px-4 sm:px-6 pointer-events-none"
        >
          <div className="mx-auto max-w-4xl w-full pointer-events-auto">
            <div 
              onClick={() => setIsCartOpen(true)}
              className="group cursor-pointer rounded-[2rem] border border-white/40 bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-2xl overflow-hidden ring-1 ring-black/5"
            >
              <div className="p-2 sm:p-4 flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <ShoppingBag size={14} className="text-emerald-600 sm:w-4 sm:h-4" />
                      </div>
                      <span className="font-black text-slate-900 text-[13px] sm:text-sm tracking-tight truncate">Group Order</span>
                      <span className="bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm shrink-0">
                        {totalUnits}
                      </span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-1.5 overflow-hidden">
                      {groupCartItems.slice(0, 3).map(({ item, qty }) => (
                        <div key={item.id} className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full shrink-0">
                          <span className="text-[10px] font-bold text-emerald-600">{qty}×</span>
                          <span className="text-[11px] font-bold text-slate-600 truncate max-w-[60px]">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="text-right shrink-0">
                     <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Amount</div>
                     <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">₹{subtotal}</div>
                  </div>
                  
                  <Button 
                    onClick={(e) => { e.stopPropagation(); setIsCartOpen(true); }} 
                    size="lg" 
                    className="h-11 sm:h-14 px-5 sm:px-10 rounded-full bg-slate-950 text-white hover:bg-black transition-all shadow-xl shadow-slate-950/20 text-xs sm:text-sm font-black flex items-center gap-2 group"
                  >
                    View Cart
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Side Drawer Cart */}
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          
          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-slate-50 shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-xl font-black text-slate-900">Your Group Cart</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{totalUnits} Units Selected</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"
              >
                <X size={24} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {groupCartItems.map(({ item, qty }) => (
                <motion.div 
                  layout
                  key={item.id} 
                  className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img src={getItemImage(item)} alt={item.name} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                    <div>
                      <div className="text-sm font-bold text-slate-800 leading-tight">{item.name}</div>
                      <div className="text-[10px] font-black text-emerald-600 mt-0.5">₹{Math.round((item.priceINR || 0) * (1 - groupDiscount.value/100))} / unit</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button 
                      onClick={() => addToGroup(item, -1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center text-xs font-black text-slate-900">{qty}</span>
                    <button 
                      onClick={() => addToGroup(item, 1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                      disabled={item.available === false}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              {groupCartItems.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <ShoppingBag size={48} className="text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-600">Your cart is empty</h4>
                  <p className="text-sm text-slate-400 mt-1">Start adding meals to your group order</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-white border-t border-slate-100 space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Estimated Total</span>
                <span className="text-2xl font-black text-slate-900">₹{subtotal}</span>
              </div>
              
              <Button 
                onClick={() => { setIsCartOpen(false); goGroupCheckout(); }} 
                className={cn(
                  "w-full h-14 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 group shadow-xl",
                  groupCartItems.length > 0 
                    ? "bg-slate-900 text-white hover:bg-black shadow-slate-900/10 hover:shadow-slate-900/20" 
                    : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none border-none"
                )}
                disabled={!groupCartItems.length}
              >
                Checkout Now
                <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
              </Button>
              
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight">
                Securely powered by Supabase
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

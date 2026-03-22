import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppUser, Route, AuthIntent, DashboardTab, Cat, MenuItem } from "../types";
import { CATS, DURATIONS, PLAN_TYPES, buildPlanFromSubscription, subscriptionId } from "../data/menu";
import { useMenu } from "../hooks/useMenu";
import { useAppSetting, useAppSettingNumber, useAppSettingString } from "../hooks/useAppSettings";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { clamp } from "../lib/format";
import { Sparkles, ArrowRight, UtensilsCrossed, Check, Search, ShoppingBag, Sprout, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MenuItemModal } from "../components/ui/MenuItemModal";
import { cn } from "../lib/utils";
import tfbLogoWebP from "../assets/tfb-logo.webp";
import tfbLogoPng from "../assets/tfb-logo-opt.png";
import { Footer } from "../components/layout/Footer";

// Make sure to add a helper for the Pill component used in the prototype
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>;
}

export function LandingPage({
  user,
  setRoute,
  subscription,
  setSubscription,
  setAuthOpen,
  setAuthIntent,
  regularCart,
  setRegularCart,
  setDashboardTab,
  showToast,
  activeSubscription,
}: {
  user: AppUser | null;
  setRoute: (r: Route) => void;
  subscription: string;
  setSubscription: (id: string) => void;
  setAuthOpen: (v: boolean) => void;
  setAuthIntent: (v: AuthIntent) => void;
  regularCart: Record<string, number>;
  setRegularCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setDashboardTab: (t: DashboardTab) => void;
  showToast: (msg: string) => void;
  activeSubscription?: any;
}) {

  const { menu: MENU, loading: menuLoading } = useMenu();

  const plan = useMemo(() => buildPlanFromSubscription(subscription), [subscription]);

  const [regularTab, setRegularTab] = useState<Cat>("All-Day Kitchen");
  const [regularSearch, setRegularSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  
  // Local state for active section (replicated from prototype's App)
  const [activeSection, setActiveSection] = useState<"regular" | "personalized" | "group">("personalized");
  const personalizedDiscount = useAppSettingNumber("personalized_discount_pct", 15);
  
  const enableRegularOrders = useAppSetting("enable_regular_orders", true);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);
  const enableGroupMeals = useAppSetting("enable_group_meals", true);

  const enableStoreTimings = useAppSetting("enable_store_timings", true);

  const storeOpenWeekday = useAppSettingString("store_open_weekday", "06:00");
  const storeCloseWeekday = useAppSettingString("store_close_weekday", "21:00");
  const storeOpenWeekend = useAppSettingString("store_open_weekend", "09:00");
  const storeCloseWeekend = useAppSettingString("store_close_weekend", "21:00");

  const storeStatus = useMemo(() => {
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
    
    // Determine next opening label
    let nextOpeningPrefix = "today";
    let nextOpeningTimeStr = openStr;

    // If currently CLOSED (within the restricted time window)
    if (!isOpenWithinHours) {
      // If we are AFTER closing time (or before opening if not a rollover)
      // For rollover: if closeTime < openTime, then "after closing" is between closeTime and openTime
      // For non-rollover: "after closing" is either before openTime or after closeTime
      
      const isAfterClosing = closeTime < openTime
        ? (currentTime >= closeTime && currentTime < openTime)
        : (currentTime >= closeTime || currentTime < openTime);

      if (isAfterClosing) {
        nextOpeningPrefix = "tomorrow";
        const nextDayIsWeekend = (day + 1) % 7 === 0 || (day + 1) % 7 === 6;
        nextOpeningTimeStr = nextDayIsWeekend ? storeOpenWeekend.value : storeOpenWeekday.value;
      }
    }

    return {
      isOpen,
      todayHours: `${openStr} - ${closeStr}`,
      nextOpeningTime: nextOpeningTimeStr,
      nextOpeningPrefix,
      isWeekend
    };
  }, [storeOpenWeekday.value, storeCloseWeekday.value, storeOpenWeekend.value, storeCloseWeekend.value, enableStoreTimings.value]);

  // Fallback if current active section is disabled
  useEffect(() => {
    if (activeSection === "personalized" && enablePersonalizedSubscriptions.value === false) {
      if (enableRegularOrders.value) setActiveSection("regular");
      else if (enableGroupMeals.value) setActiveSection("group");
    } else if (activeSection === "regular" && enableRegularOrders.value === false) {
      if (enablePersonalizedSubscriptions.value) setActiveSection("personalized");
      else if (enableGroupMeals.value) setActiveSection("group");
    } else if (activeSection === "group" && enableGroupMeals.value === false) {
      if (enablePersonalizedSubscriptions.value) setActiveSection("personalized");
      else if (enableRegularOrders.value) setActiveSection("regular");
    }
  }, [activeSection, enablePersonalizedSubscriptions.value, enableRegularOrders.value, enableGroupMeals.value]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    MENU.filter((m: MenuItem) => m.category === regularTab).forEach(m => {
      m.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [MENU, regularTab]);

  const regularFilteredMenu = useMemo(() => {
    const q = regularSearch.trim().toLowerCase();
    return MENU
      .filter((m: MenuItem) => m.category === regularTab)
      .filter((m: MenuItem) => !q || m.name.toLowerCase().includes(q))
      .filter((m: MenuItem) => !selectedTag || m.tags?.includes(selectedTag));
  }, [MENU, regularTab, regularSearch, selectedTag]);

  // Reset tag when category changes
  useEffect(() => {
    setSelectedTag(null);
  }, [regularTab]);

  const regularCartItems = useMemo(() => {
    return Object.entries(regularCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: MENU.find((m: MenuItem) => m.id === id), qty }))
      .filter((x) => !!x.item) as { item: MenuItem; qty: number }[];
  }, [MENU, regularCart]);

  function addToCart(item: MenuItem, delta: number) {
    const isAvailable = item.available !== false;
    if (!isAvailable && delta > 0) return;
    
    // Time constraint for Midday-Midnight items
    if (item.category === "Midday-Midnight Kitchen" && new Date().getHours() < 11 && delta > 0) {
      showToast("Midday-Midnight items available from 11 AM to Midnight.");
      return;
    }

    setRegularCart((prev) => {
      const next = { ...prev };
      const cur = next[item.id] || 0;
      const newQty = clamp(cur + delta, 0, 999);
      if (newQty <= 0) delete next[item.id];
      else next[item.id] = newQty;
      return next;
    });
  }

  // Handle back button to close drawer
  useEffect(() => {
    if (isCartDrawerOpen) {
      window.history.pushState({ cartOpen: true }, "");
      const handlePop = () => setIsCartDrawerOpen(false);
      window.addEventListener("popstate", handlePop);
      return () => window.removeEventListener("popstate", handlePop);
    }
  }, [isCartDrawerOpen]);

  const subtotal = regularCartItems.reduce((acc, {item, qty}) => acc + (item.priceINR || 0) * qty, 0);
  const totalUnits = regularCartItems.reduce((a, c) => a + c.qty, 0);

  // Auto-clear cart if store closes while user has items
  useEffect(() => {
    if (activeSection === "regular" && !storeStatus.isOpen && regularCartItems.length > 0) {
      setRegularCart({});
      showToast("Store timings ended. Regular order checkout is currently unavailable.");
    }
  }, [activeSection, storeStatus.isOpen, regularCartItems.length, setRegularCart, showToast]);

  function goPersonalized() {
    if (!subscription) {
      showToast("Please select a duration and meal type before opening the meal planner.");
      return;
    }
    if (user) {
      setDashboardTab("personal");
      setRoute("app");
      return;
    }
    setAuthIntent("regular");
    setAuthOpen(true);
  }

  const hasActiveSub = !!(user && activeSubscription && !['cancelled', 'removed_by_admin'].includes(activeSubscription.status));

  function goGroupMeals() {
    if (user) {
      setDashboardTab("group");
      setRoute("app");
      return;
    }
    setDashboardTab("group");
    setAuthIntent("group");
    setAuthOpen(true);
  }

  function goCheckout() {
    if (!regularCartItems.length) return showToast("Please add at least one item to your cart.");
    if (user) return setRoute("checkout-regular");
    setAuthIntent("regular");
    setAuthOpen(true);
  }

  function getItemImage(it: MenuItem) {
    return it.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80';
  }

  return (
    <div className={cn("mx-auto max-w-5xl px-4 animate-fade-in-up", regularCartItems.length > 0 && "pb-24 sm:pb-32")}>
      {/* Hero */}
      <div className="pt-2 pb-12 md:pt-4 md:pb-16 text-center">
        <div className="flex justify-center mb-6">
          {/* Use <picture> for WebP with PNG fallback. fetchpriority=high → LCP boost. */}
          <picture>
            <source srcSet={tfbLogoWebP} type="image/webp" />
            <img
              src={tfbLogoPng}
              alt="The Fit Bowls"
              width={160}
              height={160}
              fetchPriority="high"
              decoding="async"
              className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-lg -mt-4 md:-mt-6 scale-[1.2] origin-top"
            />
          </picture>
        </div>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/5 text-xs font-medium text-black/60 shadow-sm border border-black/5">
            ✨ Macro-first healthy meals, delivered
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          THE FIT BOWL<br />
          <span className="text-black/50">Eat smart. Track macros. Stay on plan.</span>
        </h1>
    <p className="mt-4 text-black/55 max-w-xl mx-auto">
          Subscription meal plans with full macro tracking, one-time orders, and group catering — all from one place.
        </p>
      </div>

      {/* Section Menu Cards */}
      <div id="section-tabs" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto px-2">
        {([
          { 
            key: "regular" as const, 
            label: "Regular Orders", 
            desc: "One-time meals, pay as you go",
            icon: ShoppingBag,
            color: "text-blue-600",
            bg: "bg-blue-500/10",
            border: "border-blue-500/30"
          },
          { 
            key: "personalized" as const, 
            label: "Personalized", 
            desc: "Subscription plans with daily flexibility",
            badge: `${personalizedDiscount.value}% OFF`,
            icon: Sprout,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/30",
            glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
          },
          { 
            key: "group" as const, 
            label: "Group Meals", 
            desc: "Bulk orders for teams and events",
            icon: Users,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30"
          },
        ]).map((tab) => {
          const isDisabled = 
            (tab.key === "regular" && !enableRegularOrders.value) ||
            (tab.key === "personalized" && !enablePersonalizedSubscriptions.value) ||
            (tab.key === "group" && !enableGroupMeals.value);

          const Icon = tab.icon;
          const isActive = activeSection === tab.key;
          
          return (
            <button
              key={tab.key}
              type="button"
              id={tab.key === "group" ? "group-meals" : tab.key === "regular" ? "regular-orders" : tab.key === "personalized" ? "personalized" : undefined}
              onClick={() => {
                if (isDisabled) return;
                setActiveSection(tab.key);
              }}
              className={cn(
                "group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left border transition-all duration-300 flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-4",
                isDisabled ? "opacity-50 cursor-not-allowed grayscale bg-slate-50 border-slate-200" :
                isActive
                  ? `bg-white shadow-xl scale-[1.02] sm:scale-[1.03] z-10 ${tab.border} ${tab.glow || ""}`
                  : "bg-white/60 hover:bg-white hover:shadow-md border-black/5 hover:border-black/15 opacity-90 hover:opacity-100"
              )}
            >
              {isActive && !isDisabled && (
                <div className={cn("absolute inset-0 opacity-[0.03] pointer-events-none rounded-2xl transition-opacity", tab.bg.replace('/10', ''))} />
              )}
              <div className="flex sm:w-full items-center sm:items-start justify-between relative z-10 shrink-0">
                <div className={cn("p-2 sm:p-3 rounded-xl transition-colors duration-300", 
                  isDisabled ? "bg-slate-200" :
                  isActive ? tab.bg : "bg-black/5 group-hover:bg-black/10")}>
                  <Icon size={20} className={cn("sm:hidden transition-colors duration-300", 
                    isDisabled ? "text-slate-500" :
                    isActive ? tab.color : "text-black/60 group-hover:text-black/80")} strokeWidth={isActive && !isDisabled ? 2.5 : 2} />
                  <Icon size={24} className={cn("hidden sm:block transition-colors duration-300", 
                    isDisabled ? "text-slate-500" :
                    isActive ? tab.color : "text-black/60 group-hover:text-black/80")} strokeWidth={isActive && !isDisabled ? 2.5 : 2} />
                </div>
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className={cn("font-bold transition-colors leading-tight truncate", 
                    isDisabled ? "text-slate-500 text-base" :
                    isActive ? "text-slate-900 text-base sm:text-[17px]" : "text-slate-700 text-sm sm:text-base")}>
                    {tab.label}
                  </div>
                  {!isDisabled && tab.badge && (
                    <span className={cn(
                      "text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border transition-colors shadow-sm shrink-0",
                      isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-black/5 text-black/60 border-black/10"
                    )}>
                      {tab.badge}
                    </span>
                  )}
                  {isDisabled && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm bg-slate-100 text-slate-500 border-slate-200 shrink-0">
                      Maint.
                    </span>
                  )}
                </div>
                <div className={cn("text-[11px] sm:text-sm transition-colors leading-tight sm:leading-relaxed line-clamp-2", 
                  isDisabled ? "text-slate-400" :
                  isActive ? "text-slate-600 font-medium" : "text-slate-500")}>
                  {tab.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── PERSONALIZED MEALS SECTION ─── */}
      {activeSection === "personalized" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-black/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                <Sparkles size={20} className="text-black/70" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Personalized Meal Plans</h3>
                <p className="text-sm text-black/50">Choose your plan, set macro targets, and customize every meal.</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* How it works */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { step: "1", title: "Pick a plan", desc: "7, 15, or 30 days — choose your meal cycles." },
                  { step: "2", title: "Set targets", desc: "Set personal macro/calorie goals for the plan." },
                  { step: "3", title: "Customize", desc: "Pick your meals daily or repeat favorites." },
                ].map((s) => (
                  <div key={s.step} className="rounded-xl border border-black/8 p-3 sm:p-4 bg-slate-50/50 flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-2">
                    <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold shrink-0 sm:mb-1">{s.step}</div>
                    <div>
                      <div className="text-xs sm:text-sm font-semibold">{s.title}</div>
                      <div className="text-[10px] sm:text-xs text-black/50 mt-0.5 leading-tight sm:leading-normal">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Plan selector — only shown when no active sub */}
              {hasActiveSub ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Check size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-emerald-900">Active Plan: {activeSubscription.meta?.plan || 'Personalized Plan'}</div>
                      <div className="text-xs text-emerald-700">Your subscription is currently active</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => { setDashboardTab("personal"); setRoute("dashboard"); }}
                    size="lg"
                    className="shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Manage Your Plan <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
              {/* Plan selector */}
              <div className="rounded-xl border border-black/8 p-5 bg-white">
                <div className="text-sm font-bold mb-4 uppercase tracking-wider text-black/50">Configure Plan</div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
                  <span className="text-sm font-medium text-black/60 w-20">Duration:</span>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d: number) => (
                      <Button key={d} size="sm" variant={subscription && plan.duration === d ? "secondary" : "outline"} onClick={() => setSubscription(subscriptionId(plan.type || "complete", d))}>
                        {d} days
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                  <span className="text-sm font-medium text-black/60 w-20 pt-2">Meals:</span>
                  <div className="flex flex-wrap gap-2">
                    {PLAN_TYPES.map((p: any) => (
                      <Button key={p.key} size="sm" variant={subscription && plan.type === p.key ? "secondary" : "outline"} onClick={() => setSubscription(subscriptionId(p.key, plan.duration || 7))}>
                        {p.title}
                      </Button>
                    ))}
                  </div>
                </div>
                {subscription ? (
                  <div className="mt-5 rounded-xl bg-black/5 px-4 py-3 text-sm flex items-center justify-between">
                    <div>
                      Selected: <span className="font-bold">{plan.title}</span> <span className="text-black/50 mx-2">•</span> {plan.allowedSlots.length} meal{plan.allowedSlots.length > 1 ? "s" : ""}/day
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
                    Please select a duration and meal type to proceed
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={goPersonalized} size="lg" className="shadow-lg">
                  Open Plan Builder <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!user && <span className="text-xs font-semibold uppercase tracking-widest text-black/30">Sign in required</span>}
              </div>
              </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ─── GROUP MEALS SECTION ─── */}
      {activeSection === "group" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-black/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                <UtensilsCrossed size={20} className="text-black/70" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Group Meals</h3>
                <p className="text-sm text-black/50">Office parties, family gatherings, events — bulk orders made easy.</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-black/8 p-5 bg-slate-50/50">
                  <div className="text-sm font-bold uppercase tracking-wider text-black/50 mb-3">How it works</div>
                  <ul className="space-y-2.5 text-sm text-black/70 font-medium">
                    <li className="flex items-start gap-2.5"><div className="mt-0.5 rounded-full bg-black/5 text-black/60 p-0.5"><Check size={12} /></div> Pick delivery date & time</li>
                    <li className="flex items-start gap-2.5"><div className="mt-0.5 rounded-full bg-black/5 text-black/60 p-0.5"><Check size={12} /></div> Add items with quantities</li>
                    <li className="flex items-start gap-2.5"><div className="mt-0.5 rounded-full bg-black/5 text-black/60 p-0.5"><Check size={12} /></div> Checkout and we deliver</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-sm font-bold uppercase tracking-wider text-amber-800/60 mb-3">Notice Requirements</div>
                  <div className="text-sm text-amber-800 font-medium flex items-start gap-2">
                    <span className="text-xl shrink-0 mt-0.5 text-amber-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </span>
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span>≤30 items: 1–3 hrs</span>
                      <span>31–60 items: 6 hrs</span>
                      <span>61+ items: 24 hrs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={goGroupMeals} size="lg" className="shadow-lg">
                  Build Group Order <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!user && <span className="text-xs font-semibold uppercase tracking-widest text-black/30">Sign in required</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── REGULAR ORDERS SECTION ─── */}
      {activeSection === "regular" && (
        <div className="space-y-6 animate-fade-in">
          {!storeStatus.isOpen && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <X size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-900">Store Timings Ended</h3>
                <p className="text-rose-700 font-medium">
                  We are currently closed for the day. Please check back at <span className="font-black underline">{storeStatus.nextOpeningTime} {storeStatus.nextOpeningPrefix}</span>.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-500 uppercase tracking-widest">
                  <span>Operating Hours: {storeStatus.todayHours}</span>
                </div>
              </div>
            </div>
          )}
          {/* Menu browser */}
          <div className={cn("rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden transition-all", !storeStatus.isOpen && "opacity-60 grayscale-[0.5] pointer-events-none")}>
             <div className="p-6 border-b border-black/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                <UtensilsCrossed size={20} className="text-black/70" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Browse Menu</h3>
                <p className="text-sm text-black/50">No subscription needed — pick items and order.</p>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Search + category filter */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex flex-wrap gap-2">
                  {CATS.map((c: string) => {
                    const isActive = regularTab === c;
                    return (
                      <Button 
                        key={c} 
                        size="sm" 
                        variant={isActive ? "primary" : "outline"}
                        onClick={() => setRegularTab(c as Cat)}
                        className={cn(
                          "transition-all duration-300",
                          !isActive && "border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {c}
                      </Button>
                    );
                  })}
                </div>
                <div className="relative sm:max-w-[200px] w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    value={regularSearch} 
                    onChange={(e: any) => setRegularSearch(e.target.value)} 
                    placeholder="Search items…" 
                    className="pl-10 h-10 bg-white border-slate-200" 
                  />
                </div>
              </div>

              {/* Items grid */}
              <div className="space-y-6">
                {/* Tag Filter Row */}
                {availableTags.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                      onClick={() => setSelectedTag(null)}
                      className={cn(
                        "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                        !selectedTag 
                          ? "bg-black text-white border-black" 
                          : "bg-white text-black/60 border-black/10 hover:border-black/20"
                      )}
                    >
                      All Items
                    </button>
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                        className={cn(
                          "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5",
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

                <div className="grid gap-3 md:grid-cols-2">
                  {menuLoading ? (
                    <div className="col-span-2 text-center py-10 text-sm text-slate-500">Loading menu...</div>
                  ) : regularFilteredMenu.map((it: MenuItem) => {
                  const qty = regularCart[it.id] || 0;
                  return (
                    <div key={it.id} className={cn("group rounded-xl border border-black/8 p-3 transition-colors", qty > 0 && "border-black/20 bg-black/2")}>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <img onClick={() => setModalItem(it)} src={getItemImage(it)} alt={it.name} className="w-20 h-20 rounded-xl object-cover shrink-0 cursor-pointer shadow-sm hover:opacity-80 transition-opacity" loading="lazy" />
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModalItem(it)}>
                            <div className="font-bold text-sm leading-tight text-slate-900 group-hover:text-emerald-600 transition-colors mb-0.5">{it.name}</div>
                            {it.description && <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{it.description}</div>}
                            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                              <Pill>{it.calories} kcal</Pill>
                              <Pill>P {it.protein}g</Pill>
                              <Pill>C {it.carbs}g</Pill>
                              <Pill>F {it.fat}g</Pill>
                              {it.available === false && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Unavailable</span>}
                              {it.available !== false && it.category === "Midday-Midnight Kitchen" && new Date().getHours() < 11 && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Available from 11 AM</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:flex-col sm:items-end self-stretch sm:self-center shrink-0 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                          {typeof it.priceINR === "number" && (
                            <span className="text-sm font-black text-slate-900 bg-slate-50 px-2.5 py-1 rounded shadow-sm border border-slate-100 sm:mb-2">₹{it.priceINR}</span>
                          )}
                          <div>
                            {qty === 0 ? (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 px-5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-sm font-bold shadow-sm border-emerald-500 disabled:opacity-50 disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed"
                                onClick={(e) => { e.stopPropagation(); addToCart(it, 1); }}
                                disabled={it.available === false || (it.category === "Midday-Midnight Kitchen" && new Date().getHours() < 11)}
                              >
                                Add
                              </Button>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg border border-emerald-200 p-1 shadow-sm h-8">
                                <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToCart(it, -1); }}>−</Button>
                                <div className="w-5 text-center text-xs font-black text-emerald-800">{qty}</div>
                                <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" onClick={(e) => { e.stopPropagation(); addToCart(it, +1); }} disabled={it.available === false || (it.category === "Midday-Midnight Kitchen" && new Date().getHours() < 11)}>+</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      {/* Sticky Floating Cart/Checkout Bar */}
      <AnimatePresence>
        {totalUnits > 0 && (activeSection !== "regular" || storeStatus.isOpen) && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-6 left-0 right-0 z-50 px-4 sm:px-6 pointer-events-none"
          >
            <div className="mx-auto max-w-4xl w-full pointer-events-auto">
              <div 
                onClick={() => setIsCartDrawerOpen(true)}
                className="group cursor-pointer rounded-[2rem] border border-white/40 bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-2xl overflow-hidden ring-1 ring-black/5"
              >
                <div className="p-2 sm:p-4 flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <ShoppingBag size={14} className="text-emerald-600 sm:w-4 sm:h-4" />
                        </div>
                        <span className="font-black text-slate-900 text-[13px] sm:text-sm tracking-tight truncate">Your Order</span>
                        <span className="bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm shrink-0">
                          {totalUnits}
                        </span>
                      </div>
                      
                      <div className="hidden md:flex items-center gap-1.5 overflow-hidden">
                        {regularCartItems.slice(0, 3).map(({ item, qty }) => (
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
                      onClick={(e) => { e.stopPropagation(); setIsCartDrawerOpen(true); }} 
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

      {/* Cart Drawer Overlay */}
      <AnimatePresence>
        {isCartDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[450px] bg-white z-[70] shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Your Cart</h2>
                  <p className="text-sm text-slate-500 font-medium">Review items and checkout</p>
                </div>
                <button 
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {regularCartItems.map(({ item, qty }) => (
                  <div key={item.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                    <img src={getItemImage(item)} alt={item.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{item.name}</h4>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">₹{item.priceINR} / unit</div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1">
                          <button onClick={() => addToCart(item, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-50 rounded text-slate-500">
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-xs font-black min-w-[12px] text-center">{qty}</span>
                          <button onClick={() => addToCart(item, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-50 rounded text-slate-500">
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => addToCart(item, -qty)}
                          className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="text-right font-black text-slate-900">
                      ₹{(item.priceINR || 0) * qty}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-500 font-bold">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span>₹{subtotal}</span>
                  </div>
                </div>
                <Button 
                  onClick={goCheckout}
                  size="lg" 
                  className="w-full h-16 rounded-2xl bg-slate-950 text-white hover:bg-black shadow-xl shadow-slate-950/20 text-lg font-black flex items-center justify-center gap-3 group"
                >
                  Confirm Checkout
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      <Footer />
      
      <MenuItemModal item={modalItem} onClose={() => setModalItem(null)} />
    </div>
  );
}

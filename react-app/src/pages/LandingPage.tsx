import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppUser, Route, AuthIntent, DashboardTab, Cat, MenuItem } from "../types";
import { CATS, DURATIONS, PLAN_TYPES, buildPlanFromSubscription, subscriptionId } from "../data/menu";
import { useMenu } from "../hooks/useMenu";
import { useAppSetting, useAppSettingNumber } from "../hooks/useAppSettings";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { clamp } from "../lib/format";
import { Sparkles, ArrowRight, UtensilsCrossed, Check, Search, ShoppingBag, Sprout, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MenuItemModal } from "../components/ui/MenuItemModal";
import { cn } from "../lib/utils";
import tfbLogo from "../assets/tfb-logo.png";

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

  const [regularTab, setRegularTab] = useState<Cat>("Breakfast");
  const [regularSearch, setRegularSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  
  // Local state for active section (replicated from prototype's App)
  const [activeSection, setActiveSection] = useState<"regular" | "personalized" | "group">("personalized");
  const personalizedDiscount = useAppSettingNumber("personalized_discount_pct", 15);
  
  const enableRegularOrders = useAppSetting("enable_regular_orders", true);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);
  const enableGroupMeals = useAppSetting("enable_group_meals", true);

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
    setRegularCart((prev) => {
      const next = { ...prev };
      const cur = next[item.id] || 0;
      const newQty = clamp(cur + delta, 0, 999);
      if (newQty <= 0) delete next[item.id];
      else next[item.id] = newQty;
      return next;
    });
  }

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
          <img src={tfbLogo} alt="The Fit Bowls" className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-lg -mt-4 md:-mt-6 scale-[1.2] origin-top" />
        </div>
        <div className="inline-flex items-center rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium text-black/60 mb-4">
          ✨ Macro-first healthy meals, delivered
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          The Fit Bowls<br />
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
          {/* Menu browser */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
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
                                className="h-8 px-5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-sm font-bold shadow-sm border-emerald-500"
                                onClick={(e) => { e.stopPropagation(); addToCart(it, 1); }}
                                disabled={it.available === false}
                              >
                                Add
                              </Button>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg border border-emerald-200 p-1 shadow-sm h-8">
                                <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToCart(it, -1); }}>−</Button>
                                <div className="w-5 text-center text-xs font-black text-emerald-800">{qty}</div>
                                <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToCart(it, +1); }} disabled={it.available === false}>+</Button>
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
        {regularCartItems.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-6 left-0 right-0 z-50 px-4 sm:px-6 pointer-events-none"
          >
            <div className="mx-auto max-w-4xl w-full pointer-events-auto">
              <div className="rounded-3xl border border-white/20 bg-white/80 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.3)] backdrop-blur-xl overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1 w-full flex items-center justify-between sm:justify-start gap-6">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <ShoppingBag size={18} className="text-emerald-600" />
                        Your Order
                        <span className="bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/20">
                          {regularCartItems.reduce((a, c) => a + c.qty, 0)} Items
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1 mt-1.5 group/scrollnav">
                        <button 
                          onClick={() => {
                            const el = document.getElementById('cart-items-list');
                            if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
                          }}
                          className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        
                        <div 
                          id="cart-items-list"
                          className="flex gap-2 overflow-x-auto no-scrollbar max-w-md py-1 scroll-smooth"
                        >
                          {regularCartItems.map(({ item, qty }) => (
                            <div 
                              key={item.id} 
                              className="group flex items-center gap-1.5 whitespace-nowrap bg-slate-100/50 hover:bg-slate-100 px-2 py-1.5 rounded-xl border border-slate-200/50 transition-all cursor-default scale-100 hover:scale-[1.02]"
                            >
                              <span className="text-[10px] font-bold text-slate-500">{qty}×</span>
                              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[80px]">{item.name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); addToCart(item, -qty); }}
                                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                                title="Remove item"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => {
                            const el = document.getElementById('cart-items-list');
                            if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
                          }}
                          className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="sm:hidden text-right">
                       <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Total</div>
                       <div className="text-2xl font-black text-slate-900 leading-none">
                         ₹{regularCartItems.reduce((acc, {item, qty}) => acc + (item.priceINR || 0) * qty, 0)}
                       </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0 flex flex-col items-end gap-3">
                    <div className="hidden sm:block text-right">
                       <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Total Amount</div>
                       <div className="text-2xl font-black text-slate-900 leading-none">
                         ₹{regularCartItems.reduce((acc, {item, qty}) => acc + (item.priceINR || 0) * qty, 0)}
                       </div>
                    </div>
                    <Button 
                      onClick={goCheckout} 
                      size="lg" 
                      className="w-full sm:px-10 h-14 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-900/20 text-base font-bold flex items-center justify-center gap-2 group"
                    >
                      Checkout Now 
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 mb-8 border-t border-black/8 pt-8 text-sm text-black/40 font-medium pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-black/10 flex items-center justify-center text-[10px] text-black">TF</span>
            © {new Date().getFullYear()} The Fit Bowls • Macro-first healthy meals
          </div>
          <div className="flex gap-4 items-center">
            <button className="hover:text-black transition-colors">Privacy</button>
            <span className="w-1 h-1 rounded-full bg-black/20"></span>
            <button className="hover:text-black transition-colors">Terms</button>
          </div>
        </div>
      </div>
      
      <MenuItemModal item={modalItem} onClose={() => setModalItem(null)} />
    </div>
  );
}

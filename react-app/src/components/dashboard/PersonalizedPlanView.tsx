import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/Typography";
import { Sparkles, ArrowRight, Search, Flame, Beef, Wheat, Droplets, Leaf, CalendarDays, Clock, Coffee, Sun, Utensils, Copy, Repeat } from "lucide-react";
import { formatDateIndia, slotLabel, clamp, digitsOnly, parseDateKeyToDate, dayKey, addDays } from "../../lib/format";
import { DURATIONS, PLAN_TYPES, subscriptionId } from "../../data/menu";
import { useAppSettingNumber } from "../../hooks/useAppSettings";
import { cn } from "../../lib/utils";
import { MealPopup } from "./MealPopup";
import { AddonPopup } from "./AddonPopup";
import type { SlotAddons } from "./AddonPopup";
import type { PlanConfig, Macros, MenuItem, StartDateMap, TargetMap, HoldsMap, PlanMap, Slot, DayHold } from "../../types";

const MENU_SECTIONS = [
  { id: "all", name: "All-Day Kitchen", note: "Available All Day", kind: "meal" as const },
  { id: "mid", name: "Midday\u2013Midnight Kitchen", note: "\uD83D\uDD52 11 AM \u2013 Midnight", kind: "meal" as const },
  { id: "extra", name: "Add-Ons", note: "Coffee, smoothies & sides", kind: "addon" as const },
] as const;

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-normal sm:tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>;
}

function getItemImage(it: MenuItem) {
  return it.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80';
}

function MacroLine({ label, value, target, unit, icon: Icon, color, bg }: { label: string; value: number; target: number; unit: string; icon: any; color: string; bg: string }) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const w = Math.min(100, pct);
  const extreme = pct >= 125;
  const barColor = extreme ? "bg-red-500" : pct >= 100 ? "bg-emerald-500" : color.replace('text-', 'bg-');
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded-md", bg)}>
            <Icon size={12} className={color} />
          </div>
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{label}</span>
        </div>
        <div className="text-[11px] font-black text-slate-900">
          {Math.round(value)}<span className="text-slate-400 font-bold ml-0.5">{unit}</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="text-slate-400">{target}{unit}</span>
        </div>
      </div>
      <div className="relative">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div 
            className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-sm", barColor)} 
            style={{ width: `${w}%` }} 
          />
        </div>
        {pct > 100 && (
          <div 
            className="absolute top-0 right-0 h-1.5 rounded-full bg-red-400/20" 
            style={{ width: `${Math.min(100, pct - 100)}%` }} 
          />
        )}
      </div>
      <div className="flex justify-end">
        <span className={cn(
          "text-[9px] font-black px-1.5 py-0.5 rounded-full",
          extreme ? "bg-red-100 text-red-600" : pct >= 100 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
        )}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

interface PersonalizedPlanViewProps {
  plan: PlanConfig;
  subscription: string;
  setSubscription: (s: string) => void;
  startKey: string;
  todayKey: string;
  setStartDates: React.Dispatch<React.SetStateAction<StartDateMap>>;
  selectedMacros: Macros;
  targets: Macros;
  setTargetMap: React.Dispatch<React.SetStateAction<TargetMap>>;
  dates: string[];
  planMap: PlanMap;
  holds: HoldsMap;
  selectedDate: string;
  setSelectedDate: (s: string) => void;
  todaysHold: DayHold;
  toggleHold: (date: string, scope: "day" | Slot) => void;
  setRoute: (r: any) => void;
  copyToNextDay: () => void;
  repeatForProjected: () => void;
  selectedDayPlan: Partial<Record<Slot, MenuItem | null>>;
  toggleSlotItem: (date: string, slot: Slot, item: MenuItem) => void;
  setModalItem: (item: MenuItem | null) => void;
  isLoading?: boolean;
  defaultTargets: Macros;
  hasActiveSubscription?: boolean;
  // New popup-based meal selection props
  menu: MenuItem[];
  slotAddons: SlotAddons;
  popup: MenuItem | null;
  setPopup: (item: MenuItem | null) => void;
  addonPopup: MenuItem | null;
  setAddonPopup: (item: MenuItem | null) => void;
  upsertMeal: (slot: Slot, item: MenuItem) => void;
  removeMeal: (slot: Slot) => void;
  attachAddon: (slot: Slot, item: MenuItem) => void;
  removeAddon: (slot: Slot, item: MenuItem) => void;
}

export function PersonalizedPlanView({
  plan,
  subscription,
  setSubscription,
  startKey,
  todayKey,
  setStartDates,
  selectedMacros,
  targets,
  setTargetMap,
  dates,
  planMap,
  holds,
  selectedDate,
  setSelectedDate,
  todaysHold,
  toggleHold,
  setRoute,
  copyToNextDay: _copyToNextDay,
  repeatForProjected: _repeatForProjected,
  selectedDayPlan,
  toggleSlotItem: _toggleSlotItem,
  setModalItem,
  isLoading: _isLoading,
  defaultTargets,
  hasActiveSubscription,
  menu,
  slotAddons,
  popup,
  setPopup,
  addonPopup,
  setAddonPopup,
  upsertMeal,
  removeMeal,
  attachAddon,
  removeAddon,
}: PersonalizedPlanViewProps) {
  const personalizedDiscount = useAppSettingNumber("personalized_discount_pct", 15);

  // Internal state for popup-based menu sections
  const [section, setSection] = useState("all");
  const [menuSearch, setMenuSearch] = useState("");

  const sectionItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menu
      .filter(m => {
        if (section === "all") return m.category === "All-Day Kitchen";
        if (section === "mid") return m.category === "Midday-Midnight Kitchen";
        if (section === "extra") return m.category === "Add-Ons";
        return true;
      })
      .filter(m => !q || (m.name + (m.description || "")).toLowerCase().includes(q));
  }, [menu, section, menuSearch]);

  const isAddonSection = MENU_SECTIONS.find(s => s.id === section)?.kind === "addon";

  const { chargeableCount } = useMemo(() => {
    let count = 0;
    let totalNeeded = 0;
    for (const dk of dates) {
      if (holds[dk]?.day) continue;
      const dp = planMap[dk] || {};
      const heldSlots = holds[dk]?.slots || {};
      for (const s of plan.allowedSlots) {
        totalNeeded++;
        if (!heldSlots[s] && dp[s]) count++;
      }
    }
    return { chargeableCount: count };
  }, [dates, holds, plan.allowedSlots, planMap]);

  function goPersonalizedCheckout() {
    setRoute("checkout-personal");
  }

  return (
    <>
      <Card className="mt-6">
      <CardHeader>
        <SectionTitle icon={Sparkles} title="Your Personalized Meal Plan" subtitle="Follow the steps below to set up your plan." />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* STEP 1: Choose Plan */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">1</div>
            <div className="text-sm font-semibold">Choose Your Plan</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-black/50 mb-2">Duration</div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {DURATIONS.map((d) => (
                  <Button key={d} size="sm" variant={plan.duration === d ? "primary" : "outline"} onClick={() => setSubscription(subscriptionId(plan.type, d))}>
                    {d} days
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-black/50 mb-2">Meals per day</div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {PLAN_TYPES.map((p) => (
                  <Button key={p.key} size="sm" variant={plan.type === p.key ? "primary" : "outline"} onClick={() => setSubscription(subscriptionId(p.key, plan.duration))}>
                    {p.title}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-black/3 px-3 py-2 text-sm">
            ✅ <span className="font-semibold">{plan.duration} days</span> • {plan.title}
          </div>
        </div>

        {/* STEP 2: Start Date & Targets */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">2</div>
            <div className="text-sm font-semibold">Set Start Date & Macro Targets</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Start Date Card */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/30 p-4 min-w-0">
              <div className="mb-3">
                <div className="text-sm font-bold text-slate-900">Start Date</div>
                <div className="text-[10px] text-slate-500 font-medium">When should your plan begin?</div>
              </div>
              <div className="mt-auto space-y-3">
                <div 
                  className="relative cursor-pointer" 
                  onClick={() => {
                    const el = document.getElementById("start-date-picker");
                    if (el && 'showPicker' in el) (el as any).showPicker();
                    else el?.click();
                  }}
                >
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <div className="flex h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 ring-offset-white transition-colors focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2">
                    {formatDateIndia(startKey)}
                  </div>
                  <input
                    id="start-date-picker"
                    type="date"
                    value={startKey}
                    min={dayKey(addDays(parseDateKeyToDate(todayKey), 1))}
                    onChange={(e) => {
                      const tomorrowMin = dayKey(addDays(parseDateKeyToDate(todayKey), 1));
                      const v = e.target.value || tomorrowMin;
                      const safe = v < tomorrowMin ? tomorrowMin : v;
                      setStartDates((prev) => ({ ...prev, [subscription]: safe, last_selected: safe }));
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-100 text-xs font-medium text-slate-600">
                  <Clock size={14} className="text-slate-400" />
                  Ends on: {formatDateIndia(dayKey(addDays(parseDateKeyToDate(startKey), Math.max(0, plan.duration - 1))))}
                </div>
              </div>
            </div>

            {/* Macro Targets Card */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/30 p-4 min-w-0">
              <div className="mb-3">
                <div className="text-sm font-bold text-slate-900">Custom Targets</div>
                <div className="text-[10px] text-slate-500 font-medium">Enter your daily goals manually</div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 mt-auto">
                {[
                  { key: "calories", label: "Calories", unit: "kcal", icon: Flame, color: "text-orange-500", bg: "bg-orange-50" },
                  { key: "protein", label: "Protein", unit: "g", icon: Beef, color: "text-rose-500", bg: "bg-rose-50" },
                  { key: "carbs", label: "Carbs", unit: "g", icon: Wheat, color: "text-amber-600", bg: "bg-amber-50" },
                  { key: "fat", label: "Fat", unit: "g", icon: Droplets, color: "text-blue-500", bg: "bg-blue-50" },
                  { key: "fiber", label: "Fiber", unit: "g", icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-50" },
                ].map((m) => (
                  <div key={m.key} className="relative flex flex-col items-center p-2 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all">
                    <div className={cn("mb-1 p-1 rounded-lg", m.bg)}>
                      <m.icon size={10} className={m.color} />
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-tight mb-1">{m.label}</div>
                    <div className="flex flex-col items-center gap-0.5 w-full">
                      <Input
                        inputMode="numeric"
                        value={String(Math.round((targets as any)[m.key] ?? 0))}
                        onChange={(e) => {
                          const v = clamp(Number(digitsOnly(e.target.value) || "0"), 0, 9999);
                          setTargetMap((prev) => {
                            const cur = prev[subscription] || defaultTargets;
                            return { ...prev, [subscription]: { ...cur, [m.key]: v } as any };
                          });
                        }}
                        className="h-6 w-full text-[10px] font-black text-center bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-slate-200 p-0 rounded-md"
                      />
                      <span className="text-[8px] font-bold text-slate-400">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3: Pick a day */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">3</div>
            <div className="text-sm font-semibold">Select a Day & Pick Meals</div>
          </div>

          {/* Day selector - horizontal scroll */}
          <div className="flex gap-1.5 sm:gap-2 w-full overflow-x-auto pb-4 mb-2 no-scrollbar scroll-smooth -mx-1 px-1">
            {dates.map((dk) => {
              const dp = planMap[dk] || {};
              const cnt = plan.allowedSlots.filter((s) => !!dp[s]).length;
              const held = holds[dk]?.day;
              const isSelected = selectedDate === dk;
              const dayDate = parseDateKeyToDate(dk);
              const dayName = dayDate.toLocaleDateString("en-IN", { weekday: "short" });
              const dayNum = dayDate.getDate();
              return (
                (() => {
                  const holdData = holds[dk] || { day: false, slots: {} as Record<Slot, boolean> };
                  const hasPartialHold = !holdData.day && plan.allowedSlots.some((s) => holdData.slots[s]);
                  const hasSelections = !holdData.day && plan.allowedSlots.some((s) => !holdData.slots[s] && dp[s]);
                  const partialWithSelections = hasPartialHold && hasSelections;
                  return (
                    <button
                      key={dk}
                      onClick={() => setSelectedDate(dk)}
                      className={cn(
                        "flex-shrink-0 rounded-xl border-2 p-1.5 sm:p-2 text-center min-w-[50px] sm:min-w-[60px] transition-all",
                        isSelected
                          ? "border-black/30 bg-black text-white shadow-sm"
                          : held
                            ? "border-rose-400 bg-rose-50 text-rose-700"
                            : partialWithSelections
                              ? "border-slate-400 bg-slate-50 text-slate-700"
                              : cnt === plan.allowedSlots.length
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-black/10 hover:border-black/20"
                      )}
                      type="button"
                    >
                      <div className="text-[9px] sm:text-[10px] font-medium uppercase">{dayName}</div>
                      <div className="text-base sm:text-lg font-bold">{dayNum}</div>
                      <div className="text-[9px] sm:text-[10px]">
                        {held ? "Held" : partialWithSelections ? "Partial" : `${cnt}/${plan.allowedSlots.length}`}
                      </div>
                    </button>
                  );
                })()
              );
            })}
          </div>


          {/* Repeat Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
             <div className="flex-1">
               <div className="font-bold text-emerald-900 text-sm">Love today's meals?</div>
               <div className="text-[10px] sm:text-xs text-emerald-700/80 mt-0.5">Save time by copying your selections forward.</div>
             </div>
             <div className="flex flex-wrap gap-2 items-center">
               <Button onClick={_copyToNextDay} className="bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm h-8 sm:h-9 px-3 sm:px-4 text-[10px] sm:text-xs font-bold transition-all">
                 <Copy className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Repeat Next
               </Button>
               <Button onClick={_repeatForProjected} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-8 sm:h-9 px-3 sm:px-4 text-[10px] sm:text-xs font-bold transition-all">
                 <Repeat className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> All Week
               </Button>
             </div>
          </div>

          {/* Selected day controls */}
          <div className="space-y-4">
            {/* Hold card (Full width) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">{formatDateIndia(selectedDate)}</div>
                  <Button 
                    size="sm" 
                    variant={todaysHold.day ? "primary" : "outline"} 
                    className={cn(
                      todaysHold.day ? "bg-rose-600 text-white hover:bg-rose-700 border-rose-600" : "text-rose-600 border-rose-200 hover:bg-rose-50"
                    )}
                    onClick={() => toggleHold(selectedDate, "day")}
                  >
                    {todaysHold.day ? "🔒 Day Held" : "Hold Day"}
                  </Button>
                </div>
                {!todaysHold.day && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {plan.allowedSlots.map((s) => (
                      <Button 
                        key={s} 
                        size="sm" 
                        variant={todaysHold.slots[s] ? "primary" : "outline"} 
                        className={cn(
                          "w-full px-1 text-[10px] sm:text-xs", // Ensure it fits in small screens
                          todaysHold.slots[s] ? "bg-rose-600 text-white hover:bg-rose-700 border-rose-600 font-bold" : "text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
                        )}
                        onClick={() => toggleHold(selectedDate, s)}
                      >
                        {todaysHold.slots[s] ? `Hold ${slotLabel(s)} ✓` : `Hold ${slotLabel(s)}`}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Left: Macro Progress */}
                <div className="space-y-4 min-w-0 h-full">
                  {/* Macro tracker */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-slate-900 uppercase tracking-tight">Macro Progress</div>
                  <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">Today</div>
                </div>
                <div className="space-y-4">
                  <MacroLine label="Calories" value={selectedMacros.calories} target={targets.calories} unit="kcal" icon={Flame} color="text-orange-500" bg="bg-orange-50" />
                  <MacroLine label="Protein" value={selectedMacros.protein} target={targets.protein} unit="g" icon={Beef} color="text-rose-500" bg="bg-rose-50" />
                  <MacroLine label="Carbs" value={selectedMacros.carbs} target={targets.carbs} unit="g" icon={Wheat} color="text-amber-600" bg="bg-amber-50" />
                  <MacroLine label="Fat" value={selectedMacros.fat} target={targets.fat} unit="g" icon={Droplets} color="text-blue-500" bg="bg-blue-50" />
                  <MacroLine label="Fiber" value={selectedMacros.fiber} target={targets.fiber} unit="g" icon={Leaf} color="text-emerald-500" bg="bg-emerald-50" />
                </div>
              </div>
                </div>

                {/* Right: meal picker */}
                <div className="space-y-3 min-w-0 h-full">
                  {/* Today's Selections - Daily Tray Layout */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-slate-900 uppercase tracking-tight">Daily Tray</div>
                  <div className="text-[10px] uppercase font-black text-slate-400">Selected Items</div>
                </div>
                <div className="flex-1 flex flex-col justify-evenly gap-2">
                  {plan.allowedSlots.map((s) => {
                    const item = selectedDayPlan[s];
                    const isHeld = todaysHold.slots[s];
                    const addons = slotAddons[s] || [];
                    const SlotIcon = s === "Slot1" ? Coffee : s === "Slot2" ? Sun : Utensils;
                    const slotColor = s === "Slot1"
                      ? { border: "border-l-amber-400", icon: "bg-amber-100 text-amber-600", label: "text-amber-600" }
                      : s === "Slot2"
                      ? { border: "border-l-sky-400", icon: "bg-sky-100 text-sky-600", label: "text-sky-600" }
                      : { border: "border-l-violet-400", icon: "bg-violet-100 text-violet-600", label: "text-violet-600" };
                    
                    return (
                      <div 
                        key={s} 
                        className={cn(
                          "relative group py-5 px-4 rounded-2xl border border-l-4 transition-all shadow-sm",
                          slotColor.border,
                          item ? "bg-white border-slate-200 shadow-md" : "bg-white/80 border-slate-100 hover:border-slate-200 hover:shadow-md",
                          isHeld && "opacity-60 bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-3 rounded-xl", slotColor.icon)}>
                            <SlotIcon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={cn("text-[11px] font-black uppercase tracking-wider", slotColor.label)}>{slotLabel(s)}</span>
                              {isHeld && <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md font-bold uppercase">Locked</span>}
                            </div>
                            <div className={cn(
                              "text-base font-bold truncate",
                              item ? "text-slate-900" : "text-slate-300 italic"
                            )}>
                              {isHeld ? "🔒 On Hold" : item?.name || "No item selected"}
                            </div>
                          </div>
                          {item && !isHeld && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-black text-emerald-600 uppercase">Ready</span>
                            </div>
                          )}
                        </div>
                        {/* Add-ons for this slot */}
                        {addons.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5 pl-14">
                            {addons.map((a) => (
                              <span key={`${s}-addon-${a.item.id}`} className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                                + {a.item.name} × {a.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                  </div>
                </div>
              </div>

              {/* Menu sections & items */}
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  {/* Section tabs */}
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Menu Sections</div>
                    <div className="flex flex-wrap gap-2">
                      {MENU_SECTIONS.map((sec) => (
                        <button
                          key={sec.id}
                          onClick={() => { setSection(sec.id); setMenuSearch(""); }}
                          className={cn(
                            "rounded-2xl border px-4 py-2.5 text-left transition-all",
                            section === sec.id
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                          )}
                        >
                          <div className="text-xs font-bold">{sec.name}</div>
                          <div className={cn("text-[10px]", section === sec.id ? "text-slate-300" : "text-slate-500")}>{sec.note}</div>
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        value={menuSearch} 
                        onChange={(e) => setMenuSearch(e.target.value)} 
                        placeholder="Search items…" 
                        className="pl-9 h-9 w-full bg-slate-50 border-slate-100 text-sm focus:bg-white transition-all" 
                      />
                    </div>
                  </div>

                  {/* Section note */}
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 font-medium">
                    {isAddonSection
                      ? "Add-ons are linked to a meal. Tap any add-on and choose which meal to attach it to."
                      : "Tap any item below, then choose which meal slot to assign it to in the popup."}
                  </div>

                  {/* Menu items list */}
                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {sectionItems.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="text-slate-300 mb-2">
                          <Search size={32} className="mx-auto opacity-20" />
                        </div>
                        <div className="text-sm font-bold text-slate-400">No items found</div>
                        <div className="text-[10px] text-slate-300 mt-1">Try a different section or search term</div>
                      </div>
                    ) : (
                      sectionItems.map((it) => (
                        <div
                          key={it.id}
                          className="w-full rounded-xl border border-slate-100 bg-white p-2.5 text-left transition-all hover:border-slate-200 hover:shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto cursor-pointer" onClick={() => setModalItem(it)}>
                              <div className="relative shrink-0">
                                <img src={getItemImage(it)} alt={it.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" loading="lazy" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm text-slate-900 leading-tight mb-0.5">{it.name}</div>
                                {it.description && <div className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium mb-2">{it.description}</div>}
                                <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                                  <Pill>{it.calories} kcal</Pill>
                                  <Pill>P{it.protein}g</Pill>
                                  {typeof it.priceINR === "number" && (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                                      ₹{Math.round(it.priceINR * (1 - personalizedDiscount.value/100))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end sm:w-auto shrink-0 pt-2 border-t border-slate-50 sm:border-0 sm:pt-0">
                              {/* Mobile Nutritional Pills */}
                              <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
                                <Pill>{it.calories} kcal</Pill>
                                <Pill>P{it.protein}g</Pill>
                                {typeof it.priceINR === "number" && (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                                    ₹{Math.round(it.priceINR * (1 - personalizedDiscount.value/100))}
                                  </span>
                                )}
                              </div>
                              {isAddonSection ? (
                                <Button 
                                  size="sm" 
                                  className="h-8 px-4 text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white hover:bg-amber-600 border-amber-600 shadow-sm"
                                  onClick={() => setAddonPopup(it)}
                                  disabled={it.available === false}
                                >
                                  Attach Add-On
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  className="h-8 px-4 text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                  onClick={() => setPopup(it)}
                                  disabled={it.available === false}
                                >
                                  Choose Meal
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        {/* STEP 4: Checkout */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">4</div>
            <div className="text-sm font-semibold">{hasActiveSubscription ? "Active Plan Found" : "Ready to Order?"}</div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-black/55">
              {chargeableCount} meal{chargeableCount !== 1 ? 's' : ''} scheduled
            </div>
            {hasActiveSubscription ? (
              <Button onClick={() => setRoute("dashboard")} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white border-transparent shadow-sm px-6 py-4 text-sm font-black uppercase tracking-wider">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={goPersonalizedCheckout} className="w-full sm:w-auto">
                Checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Popups */}
    <MealPopup
      popup={popup}
      allowedSlots={plan.allowedSlots}
      selectedDayPlan={selectedDayPlan}
      maxMeals={plan.maxMeals}
      upsertMeal={upsertMeal}
      removeMeal={removeMeal}
      close={() => setPopup(null)}
    />
    <AddonPopup
      popup={addonPopup}
      allowedSlots={plan.allowedSlots}
      slotAddons={slotAddons}
      attachAddon={attachAddon}
      removeAddon={removeAddon}
      close={() => setAddonPopup(null)}
    />
  </>
  );
}


export default PersonalizedPlanView;

import { Card, CardHeader, CardContent } from "../ui/Card";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/Typography";
import { Sparkles, Bike, CalendarDays, Lock, Unlock, ArrowRight, Sun, Coffee, Moon, ChefHat, Clock, ShieldCheck } from "lucide-react";
import { formatDateIndia, dayKey, addDays, parseDateKeyToDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import { MacroBalanceCard } from "./MacroBalanceCard";


import { DashboardMealCard } from "./DashboardMealCard";
import type { OrderReceipt, Slot, PlanMap, HoldsMap, MenuItem } from "../../types";

export function ActiveSubscriptionDashboard({ 
  subscription,
  plan,
  todayOrder,
  onSwapMeal,
  planMap,
  holds,
  toggleHold,
  cutoffHour = 22,
  dates = [],
  selectedDate,
  setSelectedDate,
  todayKey,
  chefNote,
  slotAddons
}: {
  subscription: any;
  plan: any;
  todayKey: string;
  todayOrder?: OrderReceipt | null;
  onSwapMeal?: (slot: Slot, date: string) => void;
  planMap: PlanMap;
  holds: HoldsMap;
  toggleHold: (date: string, scope: "day" | Slot) => void;
  cutoffHour?: number;
  dates?: string[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  chefNote?: string;
  slotAddons?: any;
}) {
  const now = new Date();
  
  // Strongly type the current hour to IST (Asia/Kolkata) so device timezone settings don't bypass the cutoff
  const currentHour = parseInt(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  }).format(now), 10);
  const [dateOrders, setDateOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!subscription?.user_id || !selectedDate) return;

    let isMounted = true;
    async function fetchDateOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", subscription.user_id)
        .eq("delivery_date", selectedDate)
        .neq("status", "cancelled");

      if (!error && data && isMounted) {
        setDateOrders(data);
      }
    }

    fetchDateOrders();

    return () => { isMounted = false; };
  }, [subscription?.user_id, selectedDate]);

  const getSlotStatus = (slotSymbol: Slot) => {
    // Map slot to order item label convention (e.g. "[Breakfast]", "[Lunch]", "[Dinner]")
    const labelMatch = 
      slotSymbol === "Slot1" ? "[Breakfast]" : 
      slotSymbol === "Slot2" ? "[Lunch]" : 
      "[Dinner]";

    // Find if we have an order in dateOrders that has this slot
    for (const order of dateOrders) {
      if (order.kind === 'personalized' || order.kind === 'subscription') {
        const hasSlot = order.order_items?.some((item: any) => 
          item.item_name && item.item_name.includes(labelMatch)
        );
        if (hasSlot) return order.status; // 'pending', 'preparing', 'ready', 'out_for_delivery', 'delivered'
      }
    }
    return null;
  };

  const isLocked = (dateKey: string) => {
    if (dateKey < todayKey) return true;
    if (dateKey === todayKey) return true; 
    
    // Tomorrow logic
    const tomorrow = dayKey(addDays(parseDateKeyToDate(todayKey), 1));
    if (dateKey === tomorrow && currentHour >= cutoffHour) return true;
    
    return false;
  };

  const selectedDayPlan = planMap[selectedDate] || {};
  const selectedDayHold = holds[selectedDate] || { day: false, slots: {} as Record<Slot, boolean> };

  // Calculate Days Remaining (Neutralized for time)
  const neutralizedTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Centralized Subscription Logic
  // Fallback to the first date in the planner (dates[0]) if no subscription order is found in DB
  const fallbackDate = (dates && dates.length > 0) ? dates[0] : new Date().toISOString();

  // 1. Prioritize strict DB dates if they exist
  const dbStartDate = subscription.start_date || subscription.meta?.startDate || subscription.delivery_date;
  const startDate = dbStartDate || subscription.created_at || fallbackDate;
  const startDateStr = startDate.split('T')[0];
  const startDateMs = parseDateKeyToDate(startDateStr).getTime();
  
  const durationDays = subscription.total_days || subscription.meta?.durationDays || plan.duration || 30;
  const mealsPerDay = plan.allowedSlots.length;
  
  // Calculate Progress and Days Left
  const daysPassedRaw = Math.floor((neutralizedTodayMs - startDateMs) / (1000 * 60 * 60 * 24));
  const hasStarted = daysPassedRaw >= 0;
  
  const daysPassed = Math.max(0, daysPassedRaw);
  const currentDayNum = hasStarted ? Math.min(daysPassed + 1, durationDays) : 0; // Day 0 if not started, else Day 1..N
  const daysLeft = hasStarted ? Math.max(0, durationDays - currentDayNum) : durationDays;
  const progress = hasStarted ? Math.min(100, (currentDayNum / durationDays) * 100) : 0;
  
  // Legacy daysRemaining for the warning banner — only show if started
  const daysRemaining = hasStarted ? daysLeft : null;

  // 2. Strict End Date Calculation
  const dbEndDate = subscription.end_date || subscription.meta?.endDate;
  const computedEndMs = startDateMs + (Math.max(0, durationDays - 1) * 24 * 60 * 60 * 1000);
  
  const endDateStr = dbEndDate 
    ? formatDateIndia(parseDateKeyToDate(dbEndDate.split('T')[0]).getTime())
    : formatDateIndia(computedEndMs);
    
  const startDateStrFormatted = formatDateIndia(startDateMs);
    
  const mealLabel = plan.title || (mealsPerDay === 1 ? "1 Meal / Day" : mealsPerDay === 2 ? "2 Meals / Day" : "3 Meals / Day");
  const isFallback = !subscription.id; 

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6 animate-fade-in-up mt-2 sm:mt-4 overflow-x-hidden min-w-0">

      {/* Expiration Warning Banner */}
      {daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start sm:items-center gap-2.5 sm:gap-3 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <CalendarDays size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-rose-900 text-xs sm:text-sm">Subscription Expiring Soon!</h4>
              <p className="text-[10px] sm:text-xs text-rose-600 font-medium">
                {daysRemaining === 0 ? "Your active plan ends today." : `Your active plan ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`} 
                Contact support to renew.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-950 text-white p-3 sm:p-4 md:p-8 shadow-2xl shadow-slate-900/40">
        <div className="absolute top-0 right-0 p-4 sm:p-6 md:p-12 opacity-10 pointer-events-none">
          <Sparkles size={80} className="sm:hidden" />
          <Sparkles size={120} className="hidden sm:block md:hidden" />
          <Sparkles size={200} className="hidden md:block" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16 text-center lg:text-left">
          <div className="space-y-4 sm:space-y-5 w-full lg:max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", hasStarted ? "bg-emerald-500" : "bg-sky-400")} />
              <span className={cn("text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-widest font-black", hasStarted ? "text-emerald-500" : "text-sky-400")}>
                {hasStarted ? "Subscription Active" : "Starting Soon"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Fueling your <br />
              <span className={hasStarted ? "text-emerald-400" : "text-sky-400"}>lifestyle goals.</span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm md:text-lg font-medium">
              You're on the <span className="text-white font-bold">{plan.title}</span> plan. <br className="hidden lg:block" />
              {isFallback ? "Set up your first plan to get started." : hasStarted ? `${durationDays}-day plan.` : `Starting on ${startDateStrFormatted}.`}
            </p>

            {/* Explicit Dates as requested */}
            {!isFallback && (
              <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 justify-center lg:justify-start">
                 <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                   <CalendarDays size={14} className="text-emerald-400" />
                   <div className="flex flex-col text-left">
                     <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Starts</span>
                     <span className="text-xs font-bold text-white">{startDateStrFormatted}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                   <CalendarDays size={14} className="text-emerald-400" />
                   <div className="flex flex-col text-left">
                     <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Ends</span>
                     <span className="text-xs font-bold text-white">{endDateStr}</span>
                   </div>
                 </div>
              </div>
            )}
          </div>
          
          <MacroBalanceCard 
            plan={plan}
            subscription={subscription}
            selectedDayPlan={selectedDayPlan}
            selectedDayHold={selectedDayHold}
            slotAddons={slotAddons?.[selectedDate]}
          />
        </div>
      </div>

      {/* Master PIN Delivery Card (Moved to top level) */}
      {subscription.meta?.delivery_otp && (
        <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 md:p-8 shadow-2xl shadow-indigo-900/20 border border-indigo-400/30 w-full mb-2">
          <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30 shrink-0 shadow-inner">
                <ShieldCheck size={28} className="text-white drop-shadow-md" />
              </div>
              <div>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-indigo-100 mb-1 drop-shadow-sm">Master Delivery PIN</p>
                <p className="text-xs md:text-sm font-medium text-indigo-50 leading-relaxed pr-2 max-w-sm">
                   Share this with your driver on delivery. This same secure PIN will be used for <strong className="text-white font-black">ALL deliveries</strong> throughout your entire subscription.
                </p>
              </div>
            </div>

            {/* PIN Digits */}
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 justify-between md:justify-start">
              {String(subscription.meta.delivery_otp).split('').map((digit, i) => (
                <div key={i} className="w-12 sm:w-14 h-14 sm:h-16 rounded-[1.25rem] bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg shadow-black/10">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">{digit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start min-w-0 w-full">
        {/* Planner Section */}
        <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6 md:gap-8 min-w-0 w-full">
          
          {/* Timeline Selector */}
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle 
                icon={CalendarDays} 
                title={dates.indexOf(selectedDate) >= durationDays ? "Rollover Buffer Day" : "Meal Planner"} 
                subtitle={dates.indexOf(selectedDate) >= durationDays ? "Extra days added for reschedules" : "Upcoming plan days"} 
              />
              {dates.indexOf(selectedDate) >= durationDays && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  <Sparkles size={10} /> Plan Transition
                </div>
              )}
            </div>
            
            <div className="flex gap-1.5 sm:gap-2 md:gap-3 w-full overflow-x-auto pb-4 pt-2 no-scrollbar scroll-smooth -mx-1 px-1">
              {dates.map((dk, idx) => {
                const isSelected = selectedDate === dk;
                const isRollover = idx >= durationDays;
                const isDayLocked = isLocked(dk);
                const dayDate = parseDateKeyToDate(dk);
                const dayName = dayDate.toLocaleDateString("en-IN", { weekday: "short" });
                const dayNum = dayDate.getDate();
                const held = holds[dk]?.day;
                const dp = planMap[dk] || {};
                const mealCount = plan.allowedSlots.filter((s: Slot) => !!dp[s]).length;
                const isPast = dk < todayKey;
                const isCompleted = isPast; // We can expand this later if needed

                return (
                  <button
                    key={dk}
                    onClick={() => setSelectedDate(dk)}
                    className={cn(
                      "flex-shrink-0 relative w-12 sm:w-14 md:w-20 h-16 sm:h-20 md:h-28 rounded-xl sm:rounded-2xl md:rounded-3xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-0.5 sm:gap-1 group",
                      isSelected 
                        ? (isRollover ? "bg-purple-900 border-purple-900 text-white shadow-xl shadow-purple-900/20 scale-105" : "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20 scale-105")
                        : isCompleted
                          ? "bg-white border-emerald-500 text-slate-600 hover:bg-emerald-50/30"
                          : (isRollover ? "bg-purple-50/30 border-purple-100 hover:border-purple-300 text-slate-600 hover:bg-purple-50" : "bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:bg-slate-50"),
                      held && !isSelected && "bg-rose-50 border-rose-200 text-rose-700"
                    )}
                  >
                    <div className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-normal sm:tracking-widest opacity-60", isSelected && "opacity-100")}>
                      {isRollover && !isSelected ? "Buffer" : dayName}
                    </div>
                    <div className="text-lg sm:text-xl md:text-2xl font-black leading-none">{dayNum}</div>
                    <div className="mt-1">
                      {held ? (
                        <Lock size={10} className={isSelected ? "text-emerald-400" : "text-rose-500"} />
                      ) : isCompleted ? (
                        <div className="bg-emerald-500 text-white rounded-full p-0.5">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex gap-0.5">
                          {Array.from({length: plan.allowedSlots.length}).map((_, i) => (
                             <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < mealCount ? (isSelected ? "bg-emerald-400" : "bg-slate-900") : "bg-slate-200")} />
                          ))}
                        </div>
                      )}
                    </div>
                    {isDayLocked && !isCompleted && !isRollover && <div className="absolute -top-1 -right-1 p-1 rounded-full bg-slate-900 text-white shadow-lg border border-white/20"><Lock size={8} /></div>}
                    {isRollover && <div className="absolute -top-1 -right-1 p-1 rounded-full bg-purple-500 text-white shadow-lg border border-white/20 text-[8px]">🎁</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modification Card — Selected Day View */}
          <Card className="border-none bg-white shadow-2xl shadow-slate-900/5 overflow-hidden rounded-2xl md:rounded-[2.5rem]">
            {/* Header: stack on mobile to prevent collision */}
            <CardHeader className="bg-slate-50/50 px-4 py-4 md:px-8 md:py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
               <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate">{formatDateIndia(selectedDate)}</h3>
                    {dates.indexOf(selectedDate) >= durationDays && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-widest rounded-md">Rollover Day</span>
                    )}
                  </div>
                  {(() => {
                    const activeSlotsForDay = plan.allowedSlots.filter((s: Slot) => !selectedDayHold.day && !selectedDayHold.slots[s]);
                    const allDelivered = activeSlotsForDay.length > 0 && activeSlotsForDay.every((s: Slot) => getSlotStatus(s) === 'delivered');
                    
                    if (allDelivered) {
                      return (
                        <div className="flex items-center gap-1.5 mt-1 sm:mt-0.5 flex-wrap">
                          <div className="bg-emerald-100 text-emerald-600 rounded-full p-0.5 shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Delivered</span>
                        </div>
                      );
                    }
                    if (isLocked(selectedDate)) {
                      return (
                        <div className="flex items-center gap-1.5 mt-1 sm:mt-0.5 flex-wrap">
                          <Lock size={12} className="text-slate-400 shrink-0" />
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide">Locked for Preparation</span>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1.5 mt-1 sm:mt-0.5 flex-wrap">
                        <Unlock size={12} className="text-emerald-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Modifications Open</span>

                      </div>
                    );
                  })()}
               </div>
               
               {!isLocked(selectedDate) && dates.indexOf(selectedDate) < durationDays && (
                 <Button 
                   variant={selectedDayHold.day ? "primary" : "outline"}
                   size="sm"
                   onClick={() => toggleHold(selectedDate, "day")}
                   className={cn(
                     "rounded-xl px-4 py-2 sm:px-6 font-bold text-[10px] transition-all whitespace-nowrap w-full sm:w-auto mt-2 sm:mt-0",
                     selectedDayHold.day ? "bg-rose-600 border-rose-600 hover:bg-rose-700 text-white" : "text-rose-600 border-rose-100 hover:bg-rose-50"
                   )}
                 >
                   {selectedDayHold.day ? "🏠 Hold Day ON" : "Hold Day"}
                 </Button>
               )}
            </CardHeader>
            <CardContent className="p-3 md:p-8 space-y-3 md:space-y-6">
              {plan.allowedSlots.map((s: Slot) => {
                const item = selectedDayPlan[s];
                const isSelectedRollover = dates.indexOf(selectedDate) >= durationDays;
                const isMealHeld = selectedDayHold.day || selectedDayHold.slots[s];
                const locked = isLocked(selectedDate);
                
                // On Rollover buffer days, NEVER show empty slots.
                // Only show slots that have an actual rescheduled meal in them.
                if (isSelectedRollover && !item) {
                   return null;
                }

                return (
                  <DashboardMealCard
                    key={s}
                    slot={s as Slot}
                    item={item as MenuItem | null}
                    isSelectedRollover={isSelectedRollover}
                    isMealHeld={isMealHeld}
                    locked={locked}
                    getSlotStatus={getSlotStatus}
                    selectedDate={selectedDate}
                    rescheduledTo={holds[selectedDate]?.rescheduledTo}
                    onHoldToggle={toggleHold}
                    onSwapMeal={onSwapMeal}
                    isDayHold={selectedDayHold.day}
                    addons={slotAddons?.[selectedDate]?.[s]}
                  />
                );
              })}

              {/* Empty state for buffer days with no rescheduled meals */}
              {dates.indexOf(selectedDate) >= durationDays && 
               !plan.allowedSlots.some((s: Slot) => !!selectedDayPlan[s]) && (
                <div className="text-center py-8 px-4">
                  <div className="text-3xl mb-3">📦</div>
                  <h4 className="text-sm font-black text-slate-700 mb-1">No Meals Rescheduled Here</h4>
                  <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                    This buffer day is available. Hold a meal from your plan and reschedule it to this date.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tracking & Status */}
        <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5 md:gap-8 min-w-0 w-full">

          {/* ─── Subscription Details Card ─── */}
          {(() => {
            return (
              <Card className="border-none bg-white shadow-xl shadow-slate-900/5 overflow-hidden rounded-2xl md:rounded-[2.5rem] w-full min-w-0">
                <CardHeader className="bg-slate-950 text-white px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-[0.2em] text-slate-400 truncate">Your Plan</div>
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-wider shrink-0">
                      Active
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl md:text-2xl font-black tracking-tight leading-tight truncate">
                    {subscription.meta?.plan || plan.title}
                  </h3>
                  <p className="text-slate-400 text-[9px] sm:text-xs mt-1 font-medium truncate">{mealLabel} · {durationDays}d</p>
                </CardHeader>
                <CardContent className="px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-6 flex flex-col gap-4 sm:gap-5">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest text-slate-400">Progress</span>
                      <span className={cn("text-[10px] sm:text-xs font-black", daysLeft > 0 ? "text-emerald-600" : "text-rose-500")}>
                        {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] text-slate-400 font-bold">{hasStarted ? `Day ${currentDayNum}` : "Starting Soon"}</span>
                      <span className="text-[9px] text-slate-400 font-bold">Day {durationDays}</span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-normal sm:tracking-widest text-slate-400 mb-1">Started</div>
                      <div className="text-[10px] sm:text-sm font-black text-slate-800 truncate">{startDateStrFormatted}</div>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-normal sm:tracking-widest text-slate-400 mb-1">Ends</div>
                      <div className="text-[10px] sm:text-sm font-black text-slate-800 truncate">{endDateStr}</div>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl bg-emerald-50 border border-emerald-100 col-span-2">
                      <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-normal sm:tracking-widest text-emerald-600 mb-1">Meals / Day</div>
                      <div className="text-[10px] sm:text-sm font-black text-emerald-800">{mealLabel}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}



          {/* Live Delivery Card */}
          <Card className="border-none bg-white shadow-xl shadow-slate-900/5 overflow-hidden rounded-2xl md:rounded-[2.5rem] w-full min-w-0">
            {(() => {
              const now = new Date();
              const hour = now.getHours();
              
              let currentSlot: "Breakfast" | "Lunch" | "Dinner" | null = null;
              let nextWindow: { label: string; time: string; icon: any } | null = null;

              if (hour >= 4 && hour < 8) currentSlot = "Breakfast";
              else if (hour >= 11 && hour < 13) currentSlot = "Lunch";
              else if (hour >= 17 && hour < 20) currentSlot = "Dinner";

              if (hour >= 20 || hour < 4) nextWindow = { label: "Breakfast", time: "4:00 AM", icon: Coffee };
              else if (hour >= 8 && hour < 11) nextWindow = { label: "Lunch", time: "11:00 AM", icon: Sun };
              else if (hour >= 13 && hour < 17) nextWindow = { label: "Dinner", time: "5:00 PM", icon: Moon };

              // If it's "off-slot" and we have no current active order being tracked for that slot
              const isIdle = !currentSlot && nextWindow;

              if (isIdle) {
                const NextIcon = nextWindow!.icon;
                return (
                  <>
                    <CardHeader className="bg-slate-900 text-white p-6 md:p-8">
                      <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-3 mb-4">
                         <div className="p-2 bg-white/10 rounded-xl shrink-0">
                           <Clock size={16} />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Next Delivery Window</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <NextIcon size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">{nextWindow!.label}</h3>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Starts at {nextWindow!.time}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                      <div className="p-4 rounded-2xl border border-slate-100 bg-white text-center space-y-2">
                        <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                          "We're preparing for the next slot. Your fresh meal will be on its way soon!"
                        </p>
                        <Button onClick={() => window.location.hash = "#orders"} variant="outline" className="w-full text-[10px] h-9 rounded-xl uppercase tracking-widest font-black">
                          Track Past Orders
                        </Button>
                      </div>
                    </CardContent>
                  </>
                );
              }

              return (
                <>
                  <CardHeader className="bg-emerald-600 text-white p-3 sm:p-6 md:p-8">
                    {/* Row: icon left, label right */}
                    <div className="flex items-center justify-between gap-1 border-b border-emerald-500/50 pb-3 mb-4">
                       <div className="p-1.5 sm:p-3 bg-white/20 rounded-xl sm:rounded-2xl backdrop-blur-md shrink-0">
                          <Bike size={14} className="sm:w-5 sm:h-5" />
                       </div>
                       <div className="text-right min-w-0">
                         <span className="block text-[8px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-[0.10em] opacity-90 truncate">
                           {(() => {
                             const label = todayOrder?.lines?.[0]?.label || "";
                             if (label.includes('[Breakfast]')) return "Tracking Breakfast";
                             if (label.includes('[Lunch]')) return "Tracking Lunch";
                             if (label.includes('[Dinner]')) return "Tracking Dinner";
                             return "Live Delivery";
                           })()}
                         </span>
                         {todayOrder?.orderNumber && (
                           <span className="text-[9px] font-bold opacity-70">ID: #{todayOrder.orderNumber}</span>
                         )}
                       </div>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      {todayOrder?.image && (
                        <div className="w-16 h-16 rounded-2xl border-2 border-white/20 overflow-hidden shadow-lg shrink-0">
                          <img 
                            src={todayOrder.image} 
                            className="w-full h-full object-cover" 
                            alt="Meal"
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg md:text-2xl font-black truncate leading-tight">
                          {todayOrder?.status === 'Out for delivery' ? 'On the way!' : todayOrder?.status === 'Delivered' ? 'Delivered' : 'Preparing...'}
                        </h3>
                        <p className="text-emerald-100 text-xs md:text-sm font-medium">
                          {(() => {
                            const label = todayOrder?.lines?.[0]?.label || "";
                            if (label.includes('[Breakfast]')) return "Today · 8:00 AM";
                            if (label.includes('[Lunch]')) return "Today · 1:00 PM";
                            if (label.includes('[Dinner]')) return "Today · 8:00 PM";
                            
                            if (!todayOrder?.estimatedArrival) return "TBD";
                            const d = new Date(todayOrder.estimatedArrival);
                            if (isNaN(d.getTime())) return todayOrder.estimatedArrival;
                            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          })()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-5 md:gap-8">
                    {/* Delivery Stepper */}
                    <div className="relative space-y-4 sm:space-y-6 md:space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                      {[
                        { label: "Order Confirmed", active: true, done: true },
                        { label: "Kitchen Preparing", active: todayOrder?.status !== 'New', done: ['Preparing', 'Ready', 'Out for delivery', 'Delivered'].includes(todayOrder?.status || '') },
                        { label: "Quality Checked", active: ['Ready', 'Out for delivery', 'Delivered'].includes(todayOrder?.status || ''), done: ['Ready', 'Out for delivery', 'Delivered'].includes(todayOrder?.status || '') },
                        { label: "Out for Delivery", active: todayOrder?.status === 'Out for delivery', done: todayOrder?.status === 'Delivered' },
                      ].map((step, i) => (
                        <div key={i} className="relative flex items-center gap-3 md:gap-4">
                          <div className={cn(
                            "w-6 h-6 rounded-full border-4 transition-all z-10 shrink-0",
                            step.done ? "bg-emerald-500 border-emerald-100" : step.active ? "bg-emerald-100 border-emerald-50 text-emerald-600" : "bg-white border-slate-50"
                          )} />
                          <span className={cn("text-xs font-bold", step.done ? "text-slate-900" : step.active ? "text-emerald-600" : "text-slate-400")}>{step.label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-5 md:pt-8 border-t border-slate-100">
                       <div className="flex items-center gap-2 p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-3xl bg-slate-50 border border-slate-100">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 shrink-0"><ChefHat size={14} className="sm:w-[18px] sm:h-[18px]" /></div>
                          <div className="min-w-0">
                            <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest text-slate-400">Head Chef</div>
                            <div className="text-[10px] sm:text-sm font-black text-slate-900 truncate">Mario Kitchen</div>
                          </div>
                       </div>
                    </div>
                    
                    <Button onClick={() => window.location.hash = "#orders"} variant="outline" className="w-full rounded-xl sm:rounded-2xl border-slate-100 py-3 sm:py-6 text-[9px] sm:text-xs font-black uppercase tracking-normal sm:tracking-widest hover:bg-slate-50 flex items-center justify-center">
                      View Tracking History <ArrowRight className="ml-2 shrink-0" size={14} />
                    </Button>
                  </CardContent>
                </>
              );
            })()}
          </Card>

          {/* Chef Note */}
          <div className="p-3 sm:p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-amber-50 border border-amber-100 relative overflow-hidden w-full min-w-0">
             <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12"><Sparkles size={50} className="sm:hidden" /><Sparkles size={120} className="hidden sm:block" /></div>
             <div className="relative z-10">
                <div className="p-1.5 sm:p-2 bg-amber-200/50 rounded-lg sm:rounded-xl inline-block mb-2 sm:mb-3 text-amber-700 font-black text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider">Chef's Note</div>
                <h4 className="text-base sm:text-lg md:text-xl font-black text-amber-900 mb-1.5 sm:mb-2">Good Day Ahead!</h4>
                <p className="text-amber-800/60 text-xs sm:text-sm leading-relaxed font-medium italic">
                  "{chefNote || "Your path to excellence is paved with healthy choices. Enjoy your meal!"}"
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

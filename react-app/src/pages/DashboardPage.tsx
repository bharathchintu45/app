import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppUser, Route, DashboardTab, MenuItem, Slot, ThreadMsg, PlanMap, HoldsMap } from "../types";
import { useCart } from "../contexts/CartContext";
import { usePlan } from "../contexts/PlanContext";
import type { SlotAddons } from "../components/dashboard/AddonPopup";
import { buildPlanFromSubscription, sumMacros, prunePlanMapToAllowed } from "../data/menu";
import { useMenu } from "../hooks/useMenu";
import { dayKey, addDays, parseDateKeyToDate } from "../lib/format";
import { PersonalizedPlanView } from "../components/dashboard/PersonalizedPlanView";
import { GroupOrderView } from "../components/dashboard/GroupOrderView";
import { DashboardChat } from "../components/dashboard/DashboardChat";
import { useAppSetting, useAppSettingNumber } from "../hooks/useAppSettings";
import { MenuItemModal } from "../components/ui/MenuItemModal";
import { SwapMealModal } from "../components/dashboard/SwapMealModal";
import { ActiveSubscriptionDashboard } from "../components/dashboard/ActiveSubscriptionDashboard";
import { supabase } from "../lib/supabase";
import { SkeletonDashboard } from "../components/ui/Skeleton";
import { useRazorpay } from "../hooks/useRazorpay";
import { SwapConfirmationModal } from "../components/dashboard/SwapConfirmationModal";
import { RescheduleModal } from "../components/dashboard/RescheduleModal";
import { EmptyDashboardState } from "../components/dashboard/EmptyDashboardState";

export function DashboardPage({
  user,
  activeSubscription,
  todayOrder,
  dashboardTab,
  chefNote,
  thread,
  sendMessage,
  setRoute,
  clearUnread,
  viewMode,
  showToast,
  isSubLoading = false,
}: {
  user: AppUser | null;
  activeSubscription?: any;
  isSubLoading?: boolean;
  todayOrder?: import("../types").OrderReceipt | null;
  dashboardTab: DashboardTab;
  viewMode: "planner" | "tracking";
  chefNote?: string;
  thread: ThreadMsg[];
  sendMessage: (text: string) => Promise<void>;
  setRoute: (r: Route) => void;
  triggerRefetch?: () => void;
  clearUnread?: () => void;
  showToast: (msg: string) => void;
}) {
  const { groupCart, setGroupCart, groupDraft, setGroupDraft } = useCart();
  const { 
    subscription, setSubscription,
    planMap, setPlanMap,
    holds, setHolds,
    startDates, setStartDates,
    targetMap, setTargetMap,
    dateSlotAddons, setDateSlotAddons
  } = usePlan();
  const { menu: MENU, loading } = useMenu();
  const plan = useMemo(() => buildPlanFromSubscription(subscription), [subscription]);

  const todayKey = dayKey(new Date());
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const builderStartKey = startDates[subscription] || startDates['last_selected'] || tomorrowKey;
  

  // Isolated state for "Explore Mode"
  const [explorePlanMap, setExplorePlanMap] = useState<PlanMap>({});
  const [exploreHolds, setExploreHolds] = useState<HoldsMap>({});

  const isExploring = viewMode === "planner" && activeSubscription && activeSubscription.status === "active";
  const currentPlanMap = isExploring ? explorePlanMap : planMap;
  const currentSetPlanMap = isExploring ? setExplorePlanMap : setPlanMap;
  const currentHolds = isExploring ? exploreHolds : holds;
  const currentSetHolds = isExploring ? setExploreHolds : setHolds;

  // Use DB start date for active subs, otherwise fallback to builder date
  const startKey = (viewMode === "tracking" && activeSubscription) 
    ? (activeSubscription.start_date || activeSubscription.meta?.startDate || (activeSubscription.delivery_date ? activeSubscription.delivery_date.split('T')[0] : builderStartKey))
    : builderStartKey;
    
  const startDate = useMemo(() => parseDateKeyToDate(startKey), [startKey]);
  const dates = useMemo(() => {
    if (viewMode === "tracking" && activeSubscription) {
       const dbStart = activeSubscription.start_date || activeSubscription.meta?.startDate || (activeSubscription.delivery_date ? activeSubscription.delivery_date.split('T')[0] : startKey);
       const durationDays = activeSubscription.total_days || activeSubscription.meta?.durationDays || plan.duration || 30;
       
       // 1. Generate the base plan days (start → start + duration)
       const baseDays = Array.from({ length: durationDays }, (_, i) => dayKey(addDays(parseDateKeyToDate(dbStart.split('T')[0]), i)));
       const baseDaySet = new Set(baseDays);

       // 2. Find buffer dates that have ACTUAL rescheduled meals in them
       const bufferDates: string[] = [];
       for (const dk of Object.keys(currentPlanMap)) {
         if (baseDaySet.has(dk)) continue; // Skip regular plan days
         const daySlots = currentPlanMap[dk] || {};
         const hasAnyMeal = Object.values(daySlots).some(it => !!it);
         if (hasAnyMeal) bufferDates.push(dk);
       }

       // 3. Sort buffer dates and append them
       bufferDates.sort();
       return [...baseDays, ...bufferDates];
    }

    // Builder Mode (Creation phase)
    return Array.from({ length: plan.duration }, (_, i) => dayKey(addDays(startDate, i)));
  }, [plan.duration, plan.allowedSlots, startDate, viewMode, activeSubscription, startKey, currentPlanMap]);

  const initialDate = useMemo(() => {
    if (viewMode !== "tracking" || !dates.length) return startKey;
    const today = dayKey(new Date());
    // If today is within our plan dates, default to it
    if (dates.includes(today)) return today;
    // Otherwise if we haven't started yet, default to first day
    if (dates[0] > today) return dates[0];
    // If we've finished, default to last day
    return dates[dates.length - 1];
  }, [viewMode, dates, startKey]);

  // Reliable calculation of the ORIGINAL end date (ignoring extensions caused by reschedules)
  const originalEndDate = useMemo(() => {
    if (!activeSubscription) return dates[dates.length - 1] || startKey;
    const dbStart = activeSubscription.start_date || activeSubscription.meta?.startDate || (activeSubscription.delivery_date ? activeSubscription.delivery_date.split('T')[0] : startKey);
    const durationDays = activeSubscription.total_days || activeSubscription.meta?.durationDays || plan.duration || 30;
    return dayKey(addDays(parseDateKeyToDate(dbStart.split('T')[0]), durationDays - 1));
  }, [activeSubscription, dates, startKey, plan.duration]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  useEffect(() => { setSelectedDate(initialDate); }, [initialDate]);
  useEffect(() => { setPlanMap((prev) => prunePlanMapToAllowed(prev, plan.allowedSlots)); }, [plan.allowedSlots, setPlanMap]);

  const selectedDayPlan = planMap[selectedDate] || {};
  const todaysHold = holds[selectedDate] || { day: false, slots: {} as Record<Slot, boolean> };

  // Popup-based meal selection state
  const [popup, setPopup] = useState<MenuItem | null>(null);
  const [addonPopup, setAddonPopup] = useState<MenuItem | null>(null);

  // Derive per-day SlotAddons from context (keyed by date)
  const slotAddons: SlotAddons = dateSlotAddons[selectedDate] || ({} as SlotAddons);

  function upsertMeal(slot: Slot, item: MenuItem) {
    const dayPlan = currentPlanMap[selectedDate] || {};
    const slotAlreadyFilled = !!dayPlan[slot];
    if (!slotAlreadyFilled) {
      const filledCount = plan.allowedSlots.filter((s) => !!dayPlan[s]).length;
      if (filledCount >= plan.maxMeals) {
        showToast(`Your plan allows ${plan.maxMeals} meal${plan.maxMeals > 1 ? "s" : ""}/day. Remove a meal first or upgrade your plan.`);
        return;
      }
    }
    currentSetPlanMap((prev) => {
      const cur = prev[selectedDate] || {};
      return { ...prev, [selectedDate]: { ...cur, [slot]: item } };
    });
  }

  function removeMeal(slot: Slot) {
    currentSetPlanMap((prev) => {
      const cur = prev[selectedDate] || {};
      return { ...prev, [selectedDate]: { ...cur, [slot]: null } };
    });
  }

  function attachAddon(slot: Slot, item: MenuItem) {
    setDateSlotAddons((prev) => {
      const dayAddons = { ...(prev[selectedDate] || {} as SlotAddons) };
      const list = [...(dayAddons[slot] || [])];
      const idx = list.findIndex((a) => a.item.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], qty: list[idx].qty + 1 };
      else list.push({ item, qty: 1 });
      dayAddons[slot] = list;
      return { ...prev, [selectedDate]: dayAddons };
    });
  }

  function removeAddon(slot: Slot, item: MenuItem) {
    setDateSlotAddons((prev) => {
      const dayAddons = { ...(prev[selectedDate] || {} as SlotAddons) };
      const list = [...(dayAddons[slot] || [])];
      const idx = list.findIndex((a) => a.item.id === item.id);
      if (idx < 0) return prev;
      if (list[idx].qty <= 1) list.splice(idx, 1);
      else list[idx] = { ...list[idx], qty: list[idx].qty - 1 };
      dayAddons[slot] = list;
      return { ...prev, [selectedDate]: dayAddons };
    });
  }

  const chatSetting = useAppSetting("chat_enabled", true);
  const cutoffSetting = useAppSettingNumber("order_cutoff_hour", 22);

  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [swapSlot, setSwapSlot] = useState<{ slot: Slot, date: string } | null>(null);
  const [pendingSwap, setPendingSwap] = useState<MenuItem | null>(null);
  const { openPayment, loading: payLoading } = useRazorpay();
  const [dbLoading, setDbLoading] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{ date: string, scope: "day" | Slot } | null>(null);

  const [showSubWarning, setShowSubWarning] = useState(false);
  useEffect(() => {
    if (viewMode === "planner" && dashboardTab !== "group" && activeSubscription && activeSubscription.status === "active") {
      setShowSubWarning(true);
    }
  }, [viewMode, activeSubscription, dashboardTab]);

  function handleSwapRequest(item: MenuItem) {
    setPendingSwap(item);
  }

  async function handleConfirmSwap() {
    if (!swapSlot || !activeSubscription || !pendingSwap) return;
    
    const item = pendingSwap;
    const currentItem = planMap[swapSlot.date]?.[swapSlot.slot];
    const priceDiff = (item.priceINR || 0) - (currentItem?.priceINR || 0);

    const performSwap = async (paymentId?: string) => {
      setDbLoading(true);
      const newSwap = {
        subscription_id: activeSubscription.id,
        date: swapSlot.date,
        slot: swapSlot.slot,
        menu_item_id: item.id,
        meta: paymentId ? { payment_id: paymentId, price_diff: priceDiff } : {}
      };

      try {
        const { error } = await supabase
          .from("subscription_swaps")
          .upsert(newSwap, { onConflict: 'subscription_id,date,slot' });
          
        if (error) {
          showToast(`Swap failed: ${error.message}`);
        } else {
           setPlanMap(prev => {
             const day = prev[swapSlot.date] || {};
             return { ...prev, [swapSlot.date]: { ...day, [swapSlot.slot]: item } };
           });
           showToast("Meal swapped successfully! ✅");
           setPendingSwap(null);
           setSwapSlot(null);
        }
      } finally {
        setDbLoading(false);
      }
    };

    if (priceDiff > 0) {
      if (payLoading) return;
      
      openPayment({
        amount: priceDiff,
        orderNumber: `SWAP-${activeSubscription.id.slice(0, 8)}-${Date.now()}`,
        customerName: user?.name || "Customer",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || "",
        onSuccess: (paymentId) => {
          performSwap(paymentId);
        },
        onFailure: (msg) => {
          showToast(`Upgrade payment failed: ${msg}`);
        }
      });
    } else {
      performSwap();
    }
  }


  function toggleSlotItem(dateKey: string, slot: Slot, item: MenuItem) {
    if (item.available === false) return;
    const dayPlan = currentPlanMap[dateKey] || {};
    const currentItem = dayPlan[slot];
    const isRemoving = (currentItem as MenuItem | null | undefined)?.id === item.id;
    if (!isRemoving && !currentItem) {
      const filledCount = plan.allowedSlots.filter((s) => !!dayPlan[s]).length;
      if (filledCount >= plan.maxMeals) {
        showToast(`Your plan allows ${plan.maxMeals} meal${plan.maxMeals > 1 ? "s" : ""}/day. Remove a meal first or upgrade your plan.`);
        return;
      }
    }
    currentSetPlanMap((prev) => {
      const cur = prev[dateKey] || {};
      const nextForSlot = (cur[slot] as MenuItem | null | undefined)?.id === item.id ? null : item;
      return { ...prev, [dateKey]: { ...cur, [slot]: nextForSlot } };
    });
  }

  function copyToNextDay() {
    const nextDate = dayKey(addDays(parseDateKeyToDate(selectedDate), 1));
    if (!dates.includes(nextDate)) return showToast("End of plan reached.");
    currentSetPlanMap((prev) => ({ ...prev, [nextDate]: { ...prev[selectedDate] } }));
    // Also copy addons for the selected day
    setDateSlotAddons((prev) => {
      const sourceAddons = prev[selectedDate];
      if (!sourceAddons || Object.keys(sourceAddons).length === 0) return prev;
      return { ...prev, [nextDate]: JSON.parse(JSON.stringify(sourceAddons)) };
    });
    setSelectedDate(nextDate);
  }

  function repeatForProjected() {
    if (!window.confirm("Copy today's selection to ALL future days in this plan?")) return;
    const idx = dates.indexOf(selectedDate);
    const future = dates.slice(idx + 1);
    currentSetPlanMap((prev) => {
      const next = { ...prev };
      for (const d of future) next[d] = { ...prev[selectedDate] };
      return next;
    });
    // Also copy addons to all future days
    setDateSlotAddons((prev) => {
      const sourceAddons = prev[selectedDate];
      if (!sourceAddons || Object.keys(sourceAddons).length === 0) return prev;
      const next = { ...prev };
      const addonsCopy = JSON.stringify(sourceAddons);
      for (const d of future) next[d] = JSON.parse(addonsCopy);
      return next;
    });
    showToast(`Copied to ${future.length} days.`);
  }

  async function toggleHold(dateKey: string, which: "day" | Slot) {
    if (!activeSubscription || viewMode === "planner") {
      // Allow local hold state while building a plan, but skip DB sync if no sub yet or if just exploring
      const cur = currentHolds[dateKey] || { day: false, slots: {} as Record<Slot, boolean> };
      const next = { ...currentHolds };
      if (which === "day") next[dateKey] = { ...cur, day: !cur.day };
      else next[dateKey] = { ...cur, slots: { ...cur.slots, [which]: !cur.slots[which] } };
      currentSetHolds(next);
      return;
    }

    const cur = currentHolds[dateKey] || { day: false, slots: {} as Record<Slot, boolean> };
    const isCurrentlyHeld = which === "day" ? cur.day : cur.slots[which];

    if (isCurrentlyHeld) {
      // UNHOLD logic (optimistic delete)
      if (!window.confirm("Restore this meal to the original date?")) return;
      // 1. Pull back the hold status (atomic cleanup of both tables)
      const payload = {
        p_sub_id: activeSubscription.id,
        p_date: dateKey,
        p_slot: which === "day" ? null : which
      };

      const { error } = await supabase.rpc('unhold_meal', payload);
      
      if (error) {
        console.error("[Unhold] failed:", error);
        showToast(`Restore failed: ${error.message}`);
      } else {
        showToast("Meal restored to original date! 🏠");
        
        // 1. Clear the hold status
        const next = { ...currentHolds };
        if (which === "day") next[dateKey] = { ...cur, day: false };
        else next[dateKey] = { ...cur, slots: { ...cur.slots, [which]: false } };
        currentSetHolds(next);

        // 2. CRITICAL: Remove the rescheduled meal from the buffer day's planMap
        const rescheduledTo = cur.rescheduledTo;
        if (rescheduledTo) {
          currentSetPlanMap(prev => {
            const bufferDay = { ...(prev[rescheduledTo] || {}) };
            if (which === "day") {
              plan.allowedSlots.forEach((s: Slot) => { delete bufferDay[s]; });
            } else {
              delete bufferDay[which as Slot];
            }
            // If buffer day is now empty, delete the key entirely
            const hasAnyMeal = Object.values(bufferDay).some(v => !!v);
            const newMap = { ...prev };
            if (!hasAnyMeal) {
              delete newMap[rescheduledTo];
            } else {
              newMap[rescheduledTo] = bufferDay;
            }
            return newMap;
          });

          // Auto-navigate back to the original date
          setSelectedDate(dateKey);
        }
      }
    } else {
      // Prompt for Reschedule Date
      setRescheduleData({ date: dateKey, scope: which });
    }
  }

  async function handleConfirmReschedule(targetDate: string, targetSlot?: Slot) {
    if (!rescheduleData || !activeSubscription) return;
    const { date, scope } = rescheduleData;
    setDbLoading(true);

    const dayPlan = planMap[date] || {};
    const itemsToMove: { slot: Slot, item: MenuItem }[] = [];
    
    if (scope === 'day') {
      plan.allowedSlots.forEach((s: Slot) => {
        if (dayPlan[s]) itemsToMove.push({ slot: s, item: dayPlan[s]! });
      });
    } else {
      if (dayPlan[scope]) itemsToMove.push({ slot: scope, item: dayPlan[scope]! });
    }

    const payload = {
        p_sub_id: activeSubscription.id,
        p_original_date: date,
        p_new_date: targetDate,
        p_is_full_day: scope === 'day',
        p_items: itemsToMove.map(i => ({ 
           original_slot: i.slot, 
           target_slot: (scope !== 'day' && targetSlot) ? targetSlot : i.slot, 
           menu_item_id: i.item.id 
        }))
    };

    const { error } = await supabase.rpc('reschedule_meal', payload);

    if (error) {
       console.error("[Reschedule] failed:", error);
       showToast(`Reschedule failed: ${error.message}`);
    } else {
       showToast("Meal rescheduled to buffer day successfully! 🎁");
       
       // Optimistic UI updates
       const cur = currentHolds[date] || { day: false, slots: {} as Record<Slot, boolean> };
       const next = { ...currentHolds };
       if (scope === "day") next[date] = { ...cur, day: true, rescheduledTo: targetDate };
       else next[date] = { ...cur, slots: { ...cur.slots, [scope]: true }, rescheduledTo: targetDate };
       currentSetHolds(next);

       currentSetPlanMap(prev => {
         const targetDay = prev[targetDate] || {};
         const newTarget = { ...targetDay };
         itemsToMove.forEach(i => {
            const mappedSlot = (scope !== 'day' && targetSlot) ? targetSlot : i.slot;
            newTarget[mappedSlot] = i.item;
         });
         return { ...prev, [targetDate]: newTarget };
       });
       setSelectedDate(targetDate);
    }

    setDbLoading(false);
    setRescheduleData(null);
  }


  const selectedMacros = useMemo(() => {
    const items = plan.allowedSlots.map((s) => selectedDayPlan[s]).filter((x): x is MenuItem => !!x && x !== null);
    const base = sumMacros(items);
    // Add addon macros (qty-weighted)
    for (const slot of plan.allowedSlots) {
      const addons = slotAddons[slot] || [];
      for (const a of addons) {
        base.calories += (a.item.calories || 0) * a.qty;
        base.protein += (a.item.protein || 0) * a.qty;
        base.carbs += (a.item.carbs || 0) * a.qty;
        base.fat += (a.item.fat || 0) * a.qty;
        base.fiber += (a.item.fiber || 0) * a.qty;
      }
    }
    return base;
  }, [plan.allowedSlots, selectedDayPlan, slotAddons]);

  const defaultTargets = useMemo(() => {
    const meals = plan.maxMeals;
    return {
      calories: meals === 3 ? 1400 : 550,
      protein: meals === 3 ? 90 : 35,
      carbs: meals === 3 ? 160 : 65,
      fat: meals === 3 ? 45 : 18,
      fiber: meals === 3 ? 25 : 10,
    };
  }, [plan.allowedSlots.length]);

  const targets = useMemo(() => targetMap[subscription] || defaultTargets, [defaultTargets, subscription, targetMap]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dashboardTab === "personal") {
      clearUnread?.();
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [thread.length, dashboardTab, clearUnread]);

  return (
    <>
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 md:py-8 animate-fade-in-up overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="text-2xl font-bold">
            {dashboardTab === "group" ? "Group Builder" : viewMode === "tracking" ? "Dashboard" : "Your Plan Builder"}
          </div>
          <div className="text-sm text-black/55 mt-1">
            {dashboardTab === "group" ? "Build group orders for events & parties." : viewMode === "tracking" ? "Manage and track your active subscription." : "Manage your personalized meal plan."}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button onClick={() => setRoute("home")} className="text-sm font-semibold text-black/60 hover:text-black transition-colors flex items-center gap-1.5">
            ← Back to Home
          </button>
        </div>
      </div>
      
      {isSubLoading && viewMode === "tracking" ? (
        <SkeletonDashboard />
      ) : dashboardTab === "group" ? (
        <GroupOrderView
          menu={MENU}
          isLoading={loading}
          groupDraft={groupDraft}
          setGroupDraft={setGroupDraft}
          groupCart={groupCart}
          setGroupCart={setGroupCart}
          setRoute={setRoute}
          setModalItem={setModalItem}
          showToast={showToast}
        />
      ) : (
        <>
          {viewMode === "tracking" && activeSubscription ? (
             <ActiveSubscriptionDashboard 
                subscription={activeSubscription || { plan_type: "Pro Account", status: "Active" }}
                plan={activeSubscription?.meta?.planId ? buildPlanFromSubscription(activeSubscription.meta.planId) : plan}
                todayKey={todayKey}
                todayOrder={todayOrder}
                onSwapMeal={(slot: Slot, date: string) => setSwapSlot({ slot, date })}
                planMap={currentPlanMap}
                holds={currentHolds}
                toggleHold={toggleHold}
                cutoffHour={cutoffSetting.value}
                dates={dates}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                chefNote={chefNote}
                 slotAddons={dateSlotAddons}
              />
          ) : viewMode === "tracking" && activeSubscription?.status === 'removed_by_admin' ? (
            /* ── Admin removal state ── */
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 md:p-12 text-center mt-6 shadow-sm max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-black text-amber-900 mb-2">Subscription Removed</h3>
              <p className="text-amber-700 font-medium mb-4">
                Your subscription was ended by The Fit Bowls administration.
              </p>
              {activeSubscription.meta?.admin_removal_note && (
                <div className="bg-white border border-amber-200 rounded-2xl px-5 py-4 mb-6 text-left shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Note from Admin</p>
                  <p className="text-sm text-slate-700 font-medium italic">"{activeSubscription.meta.admin_removal_note}"</p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="tel:+919876543210"
                  className="px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
                >
                  📞 Contact Us
                </a>
                <button
                  onClick={() => setRoute("home")}
                  className="px-6 py-3 rounded-xl border border-amber-300 text-amber-800 font-bold hover:bg-amber-100 transition-colors"
                >
                  Browse Menu
                </button>
              </div>
            </div>
          ) : viewMode === "tracking" ? (
            /* ── Self-cancelled / no subscription state ── */
            <EmptyDashboardState 
              onBrowseMenu={() => setRoute("home")}
              onBuildPlan={() => setRoute("app")}
            />
          ) : (
             <PersonalizedPlanView
               isLoading={loading}
               defaultTargets={defaultTargets}
               plan={plan}
               subscription={subscription}
               setSubscription={setSubscription}
               startKey={startKey}
               todayKey={todayKey}
               setStartDates={setStartDates}
               selectedMacros={selectedMacros}
               targets={targets}
               setTargetMap={setTargetMap}
               dates={dates}
               planMap={currentPlanMap}
               holds={currentHolds}
               selectedDate={selectedDate}
               setSelectedDate={setSelectedDate}
               todaysHold={todaysHold}
               toggleHold={toggleHold}
               setRoute={setRoute}
               copyToNextDay={copyToNextDay}
               repeatForProjected={repeatForProjected}
               selectedDayPlan={selectedDayPlan}
               toggleSlotItem={toggleSlotItem}
               setModalItem={setModalItem}
               hasActiveSubscription={!!(activeSubscription && activeSubscription.status === "active")}
               menu={MENU}
               slotAddons={slotAddons}
               popup={popup}
               setPopup={setPopup}
               addonPopup={addonPopup}
               setAddonPopup={setAddonPopup}
               upsertMeal={upsertMeal}
               removeMeal={removeMeal}
               attachAddon={attachAddon}
               removeAddon={removeAddon}
             />
          )}

          {!chatSetting.loading && chatSetting.value && (
          <DashboardChat
            user={user}
            thread={thread}
            sendMessage={sendMessage}
            dashboardTab={dashboardTab}
            clearUnread={clearUnread}
          />
          )}
        </>
      )}
    </div>
    <MenuItemModal item={modalItem} onClose={() => setModalItem(null)} />
    {swapSlot && (
      <SwapMealModal
        isOpen={true}
        onClose={() => setSwapSlot(null)}
        slot={swapSlot.slot}
        menu={MENU}
        onSwap={handleSwapRequest}
        currentItem={planMap[swapSlot.date]?.[swapSlot.slot]}
      />
    )}

    {pendingSwap && swapSlot && (
      <SwapConfirmationModal
        isOpen={true}
        onClose={() => setPendingSwap(null)}
        onConfirm={handleConfirmSwap}
        oldItem={planMap[swapSlot.date]?.[swapSlot.slot]}
        newItem={pendingSwap}
        isLoading={payLoading || dbLoading}
      />
    )}
    
    {rescheduleData && activeSubscription && (
      <RescheduleModal
        isOpen={true}
        onClose={() => setRescheduleData(null)}
        onConfirm={handleConfirmReschedule}
        originalDate={rescheduleData.date}
        endDate={originalEndDate}
        isFullDay={rescheduleData.scope === 'day'}
        slot={rescheduleData.scope !== 'day' ? rescheduleData.scope : undefined}
        itemsToMove={rescheduleData.scope === 'day' 
          ? plan.allowedSlots.map(s => ({ slot: s, item: planMap[rescheduleData.date]?.[s] })).filter((x): x is { slot: Slot, item: MenuItem } => !!x.item)
          : [{ slot: rescheduleData.scope as Slot, item: planMap[rescheduleData.date]?.[rescheduleData.scope as Slot]! }]}
        allowedSlots={plan.allowedSlots}
        isLoading={dbLoading}
      />
    )}
    <AnimatePresence>
      {showSubWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="mb-2 text-center text-xl font-black text-slate-900 leading-tight">Active Subscription Found</h3>
            <p className="mb-6 text-center text-sm font-medium text-slate-500 leading-relaxed">
              You already have an active meal plan. Do you want to modify your upcoming deliveries instead?
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setShowSubWarning(false); setRoute("dashboard"); }}
                className="w-full rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setExplorePlanMap({});
                  setExploreHolds({});
                  setShowSubWarning(false);
                }}
                className="w-full rounded-xl border-2 border-slate-100 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                Explore Plan Builder
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppUser, Route, DashboardTab, MenuItem, GroupCart, GroupOrderDraft, PlanMap, HoldsMap, StartDateMap, TargetMap, Slot, ThreadMsg } from "../types";
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

export function DashboardPage({
  user,
  activeSubscription,
  todayOrder,
  subscription,
  setSubscription,
  dashboardTab,
  holds,
  setHolds,
  chefNote,
  planMap,
  setPlanMap,
  thread,
  sendMessage,
  setRoute,
  groupCart,
  setGroupCart,
  groupDraft,
  setGroupDraft,
  startDates,
  setStartDates,
  targetMap,
  setTargetMap,
  clearUnread,
  viewMode,
  showToast,
  isSubLoading = false,
}: {
  user: AppUser | null;
  activeSubscription?: any;
  isSubLoading?: boolean;
  todayOrder?: import("../types").OrderReceipt | null;
  subscription: string;
  setSubscription: (id: string) => void;
  dashboardTab: DashboardTab;
  viewMode: "planner" | "tracking";
  holds: HoldsMap;
  setHolds: React.Dispatch<React.SetStateAction<HoldsMap>>;
  chefNote?: string;
  planMap: PlanMap;
  setPlanMap: React.Dispatch<React.SetStateAction<PlanMap>>;
  thread: ThreadMsg[];
  sendMessage: (text: string) => Promise<void>;
  setRoute: (r: Route) => void;
  groupCart: GroupCart;
  setGroupCart: React.Dispatch<React.SetStateAction<GroupCart>>;
  groupDraft: GroupOrderDraft;
  setGroupDraft: React.Dispatch<React.SetStateAction<GroupOrderDraft>>;
  triggerRefetch?: () => void;
  startDates: StartDateMap;
  setStartDates: React.Dispatch<React.SetStateAction<StartDateMap>>;
  targetMap: TargetMap;
  setTargetMap: React.Dispatch<React.SetStateAction<TargetMap>>;
  clearUnread?: () => void;
  showToast: (msg: string) => void;
}) {
  const { menu: MENU, loading } = useMenu();
  const plan = useMemo(() => buildPlanFromSubscription(subscription), [subscription]);

  const todayKey = dayKey(new Date());
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const builderStartKey = startDates[subscription] || startDates['last_selected'] || tomorrowKey;
  
  // Use DB start date for active subs, otherwise fallback to builder date
  const startKey = (viewMode === "tracking" && activeSubscription) 
    ? (activeSubscription.start_date || activeSubscription.meta?.startDate || (activeSubscription.delivery_date ? activeSubscription.delivery_date.split('T')[0] : builderStartKey))
    : builderStartKey;
    
  const startDate = useMemo(() => parseDateKeyToDate(startKey), [startKey]);
  const dates = useMemo(() => {
    const duration = (viewMode === "tracking" && activeSubscription?.meta?.durationDays) 
      ? activeSubscription.meta.durationDays 
      : plan.duration;
    return Array.from({ length: duration }, (_, i) => dayKey(addDays(startDate, i)));
  }, [plan.duration, startDate, viewMode, activeSubscription]);

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

  const [selectedDate, setSelectedDate] = useState(initialDate);
  useEffect(() => { setSelectedDate(initialDate); }, [initialDate]);
  useEffect(() => { setPlanMap((prev) => prunePlanMapToAllowed(prev, plan.allowedSlots)); }, [plan.allowedSlots, setPlanMap]);

  const selectedDayPlan = planMap[selectedDate] || {};
  const todaysHold = holds[selectedDate] || { day: false, slots: {} as Record<Slot, boolean> };

  // Popup-based meal selection state
  const [popup, setPopup] = useState<MenuItem | null>(null);
  const [addonPopup, setAddonPopup] = useState<MenuItem | null>(null);
  const [slotAddons, setSlotAddons] = useState<SlotAddons>({} as SlotAddons);

  function upsertMeal(slot: Slot, item: MenuItem) {
    const dayPlan = currentPlanMap[selectedDate] || {};
    const slotAlreadyFilled = !!dayPlan[slot];
    if (!slotAlreadyFilled) {
      // Count how many slots currently have a meal
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
    setSlotAddons((prev) => {
      const list = [...(prev[slot] || [])];
      const idx = list.findIndex((a) => a.item.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], qty: list[idx].qty + 1 };
      else list.push({ item, qty: 1 });
      return { ...prev, [slot]: list };
    });
  }

  function removeAddon(slot: Slot, item: MenuItem) {
    setSlotAddons((prev) => {
      const list = [...(prev[slot] || [])];
      const idx = list.findIndex((a) => a.item.id === item.id);
      if (idx < 0) return prev;
      if (list[idx].qty <= 1) list.splice(idx, 1);
      else list[idx] = { ...list[idx], qty: list[idx].qty - 1 };
      return { ...prev, [slot]: list };
    });
  }

  const chatSetting = useAppSetting("chat_enabled", true);
  const cutoffSetting = useAppSettingNumber("order_cutoff_hour", 22);

  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [swapSlot, setSwapSlot] = useState<{ slot: Slot, date: string } | null>(null);

  const [showSubWarning, setShowSubWarning] = useState(false);
  useEffect(() => {
    if (viewMode === "planner" && dashboardTab !== "group" && activeSubscription && activeSubscription.status === "active") {
      setShowSubWarning(true);
    }
  }, [viewMode, activeSubscription, dashboardTab]);

  // Isolated state for "Explore Mode"
  const [explorePlanMap, setExplorePlanMap] = useState<PlanMap>({});
  const [exploreHolds, setExploreHolds] = useState<HoldsMap>({});

  const isExploring = viewMode === "planner" && activeSubscription && activeSubscription.status === "active";
  const currentPlanMap = isExploring ? explorePlanMap : planMap;
  const currentSetPlanMap = isExploring ? setExplorePlanMap : setPlanMap;
  const currentHolds = isExploring ? exploreHolds : holds;
  const currentSetHolds = isExploring ? setExploreHolds : setHolds;

  async function handleSwapComplete(item: MenuItem) {
    if (!swapSlot || !activeSubscription) return;
    
    const newSwap = {
      subscription_id: activeSubscription.id,
      date: swapSlot.date,
      slot: swapSlot.slot,
      menu_item_id: item.id
    };

    console.log("[Swap] Upserting with subscription_id:", activeSubscription.id, newSwap);

    const { error } = await supabase
      .from("subscription_swaps")
      .upsert(newSwap, { onConflict: 'subscription_id,date,slot' });
      
    if (error) {
      console.error("[Swap] Error:", error);
      showToast(`Swap failed: ${error.message}`);
    } else {
       setPlanMap(prev => {
         const day = prev[swapSlot.date] || {};
         return { ...prev, [swapSlot.date]: { ...day, [swapSlot.slot]: item } };
       });
       showToast("Meal swapped successfully! ✅");
    }
    
    setSwapSlot(null);
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
    showToast(`Copied to ${future.length} days.`);
  }

  async function toggleHold(dateKey: string, which: "day" | Slot) {
    // Compute next state optimistically
    const cur = currentHolds[dateKey] || { day: false, slots: {} as Record<Slot, boolean> };
    const next = { ...currentHolds };
    if (which === "day") next[dateKey] = { ...cur, day: !cur.day };
    else next[dateKey] = { ...cur, slots: { ...cur.slots, [which]: !cur.slots[which] } };
    
    // Optimistic UI update
    currentSetHolds(next);

    if (!activeSubscription || viewMode === "planner") {
      // Allow local hold state while building a plan, but skip DB sync if no sub yet or if just exploring
      return;
    }
      
    // Sync to DB
    const payload = next[dateKey];
    const upsertData = {
      subscription_id: activeSubscription.id,
      hold_date: dateKey,
      is_full_day: payload.day,
      slots: payload.slots,
      updated_at: new Date().toISOString()
    };

    console.log("[Hold] Upserting with subscription_id:", activeSubscription.id, upsertData);

    const { error } = await supabase
      .from("subscription_holds")
      .upsert(upsertData, { onConflict: 'subscription_id,hold_date' });
    
    if (error) {
      console.error("[Hold] Error:", error);
      // Roll back optimistic update
      currentSetHolds(holds);
      showToast(`Hold failed: ${error.message}`);
    }
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
             <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center mt-6 shadow-sm">
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-xl font-bold mb-2">No Active Subscription</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">You do not have an active subscription meal plan. Browse the menu or set up a plan to see your dashboard.</p>
                <div className="flex justify-center flex-col sm:flex-row gap-4 max-w-sm mx-auto">
                  <button onClick={() => setRoute("home")} className="w-full px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors">Browse Menu</button>
                  <button onClick={() => setRoute("app")} className="w-full px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition-colors">Build a Plan</button>
                </div>
             </div>

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
        onSwap={handleSwapComplete}
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

import { useState, useMemo, useEffect, useRef } from "react";
import type { AppUser, Route, DashboardTab, Cat, MenuItem, GroupCart, GroupOrderDraft, PlanMap, HoldsMap, StartDateMap, TargetMap, Slot, ThreadMsg } from "../types";
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

  const [selectedDate, setSelectedDate] = useState(() => startKey);
  useEffect(() => { setSelectedDate(startKey); }, [startKey]);
  useEffect(() => { setPlanMap((prev) => prunePlanMapToAllowed(prev, plan.allowedSlots)); }, [plan.allowedSlots, setPlanMap]);

  const selectedDayPlan = planMap[selectedDate] || {};
  const todaysHold = holds[selectedDate] || { day: false, slots: {} as Record<Slot, boolean> };

  const [activeSlot, setActiveSlot] = useState<Slot>(() => plan.allowedSlots[0] || "Slot1");
  useEffect(() => { if (!plan.allowedSlots.includes(activeSlot)) setActiveSlot(plan.allowedSlots[0] || "Slot1"); }, [plan.allowedSlots, activeSlot]);

  const [slotMenuTab, setSlotMenuTab] = useState<Cat>("Breakfast");
  const [slotSearch, setSlotSearch] = useState("");
  const [slotSelectedTag, setSlotSelectedTag] = useState<string | null>(null);

  const availableSlotTags = useMemo(() => {
    const tags = new Set<string>();
    MENU.filter((m) => m.category === slotMenuTab).forEach(m => {
      m.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [MENU, slotMenuTab]);

  const slotFilteredMenu = useMemo(() => {
    const q = slotSearch.trim().toLowerCase();
    return MENU
      .filter((m) => m.category === slotMenuTab)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .filter((m) => !slotSelectedTag || m.tags?.includes(slotSelectedTag));
  }, [MENU, slotMenuTab, slotSearch, slotSelectedTag]);

  // Reset tag when category changes
  useEffect(() => {
    setSlotSelectedTag(null);
  }, [slotMenuTab]);

  const chatSetting = useAppSetting("chat_enabled", true);
  const cutoffSetting = useAppSettingNumber("order_cutoff_hour", 22);

  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [swapSlot, setSwapSlot] = useState<{ slot: Slot, date: string } | null>(null);

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
    setPlanMap((prev) => {
      const cur = prev[dateKey] || {};
      const currentItem = cur[slot];
      const nextForSlot = (currentItem as MenuItem | null | undefined)?.id === item.id ? null : item;
      return { ...prev, [dateKey]: { ...cur, [slot]: nextForSlot } };
    });
  }

  function copyToNextDay() {
    const nextDate = dayKey(addDays(parseDateKeyToDate(selectedDate), 1));
    if (!dates.includes(nextDate)) return showToast("End of plan reached.");
    setPlanMap((prev) => ({ ...prev, [nextDate]: { ...prev[selectedDate] } }));
    setSelectedDate(nextDate);
  }

  function repeatForProjected() {
    if (!window.confirm("Copy today's selection to ALL future days in this plan?")) return;
    const idx = dates.indexOf(selectedDate);
    const future = dates.slice(idx + 1);
    setPlanMap((prev) => {
      const next = { ...prev };
      for (const d of future) next[d] = { ...prev[selectedDate] };
      return next;
    });
    showToast(`Copied to ${future.length} days.`);
  }

  async function toggleHold(dateKey: string, which: "day" | Slot) {
    // Compute next state optimistically
    const cur = holds[dateKey] || { day: false, slots: {} as Record<Slot, boolean> };
    const next = { ...holds };
    if (which === "day") next[dateKey] = { ...cur, day: !cur.day };
    else next[dateKey] = { ...cur, slots: { ...cur.slots, [which]: !cur.slots[which] } };
    
    // Optimistic UI update
    setHolds(next);

    if (!activeSubscription) {
      // Allow local hold state while building a plan, but skip DB sync if no sub yet
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
      setHolds(holds);
      showToast(`Hold failed: ${error.message}`);
    }
  }


  const selectedMacros = useMemo(() => {
    const items = plan.allowedSlots.map((s) => selectedDayPlan[s]).filter((x): x is MenuItem => !!x && x !== null);
    return sumMacros(items);
  }, [plan.allowedSlots, selectedDayPlan]);

  const defaultTargets = useMemo(() => {
    const meals = plan.allowedSlots.length;
    return {
      calories: meals === 3 ? 1400 : 550,
      protein: meals === 3 ? 90 : 35,
      carbs: meals === 3 ? 160 : 65,
      fat: meals === 3 ? 45 : 18,
      fiber: meals === 3 ? 25 : 10,
    };
  }, [plan.allowedSlots.length]);

  const targets = useMemo(() => targetMap[subscription] || defaultTargets, [defaultTargets, subscription, targetMap]);
  const dates = useMemo(() => {
    // If tracking an active sub, use its strict duration
    const duration = (viewMode === "tracking" && activeSubscription?.meta?.durationDays) 
      ? activeSubscription.meta.durationDays 
      : plan.duration;
    return Array.from({ length: duration }, (_, i) => dayKey(addDays(startDate, i)));
  }, [plan.duration, startDate, viewMode, activeSubscription]);

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
          <button onClick={() => setRoute("home")} className="text-sm font-semibold text-black/60 hover:text-black transition-colors">
            ← Back to Home
          </button>
        </div>
      </div>
      
      {isSubLoading ? (
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
                planMap={planMap}
                holds={holds}
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
               planMap={planMap}
               holds={holds}
               selectedDate={selectedDate}
               setSelectedDate={setSelectedDate}
               todaysHold={todaysHold}
               toggleHold={toggleHold}
               setRoute={setRoute}
               copyToNextDay={copyToNextDay}
               repeatForProjected={repeatForProjected}
               activeSlot={activeSlot}
               setActiveSlot={setActiveSlot}
               selectedDayPlan={selectedDayPlan}
               slotSearch={slotSearch}
               setSlotSearch={setSlotSearch}
               slotMenuTab={slotMenuTab}
               setSlotMenuTab={setSlotMenuTab}
               slotFilteredMenu={slotFilteredMenu}
               toggleSlotItem={toggleSlotItem}
               setModalItem={setModalItem}
               slotSelectedTag={slotSelectedTag}
               setSlotSelectedTag={setSlotSelectedTag}
               availableSlotTags={availableSlotTags}
               showToast={showToast}
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
    </>
  );
}

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { OrderReceipt, KitchenStatus, AppUser } from "../types";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { SectionTitle, LuxuryLabel } from "../components/ui/Typography";
import { SkeletonKitchenCard } from "../components/ui/Skeleton";
import { formatDateTimeIndia, formatDateIndia, formatTimeIndia, dayKey, addDays } from "../lib/format";
import { UtensilsCrossed, Sparkles, MessageCircle, Send, Printer } from "lucide-react";
import { cn } from "../lib/utils";
import { BillPreviewModal, buildLabelsPageHtml, generatePdfTitle } from "../components/kitchen/BillPreviewModal";
import { CustomerContextPanel, hasActiveSubscription } from "../components/kitchen/CustomerContextPanel";
import { OrderEditModal } from "../components/kitchen/OrderEditModal";
import { useAppSetting, useAppSettingNumber } from "../hooks/useAppSettings";
import { useKitchenData } from "../hooks/useKitchenData";
import { PickupPinModal } from "../components/kitchen/PickupPinModal";


export function KitchenPage({ user, onBack, showToast }: { user: AppUser | null, onBack: () => void, showToast: (msg: string) => void }) {
  const [tab, setTab] = useState<"orders" | "groups" | "forecast" | "inbox" | "subscriptions" | "pickup">("orders");
  const [subSlotFilter, setSubSlotFilter] = useState<"All" | "Breakfast" | "Lunch" | "Dinner">("All");
  const [subSubTab, setSubSubTab] = useState<"new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled">("new");
  const [groupSubTab, setGroupSubTab] = useState<"new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled">("new");
  const [pickupSubTab, setPickupSubTab] = useState<"new" | "preparing" | "ready" | "delivered" | "cancelled">("new");
  
  // -- NEW UNIFIED HOOK --
  const {
    orders,
    deliveryBoys,
    assignments,
    isLoading,
    fetchError,
    unreadCounts,
    unreadMap,
    inboxRaw,
    activeSubs,
    allSwaps,
    allMenuItems,
    setStatus,
    fetchLiveOrders,
    muted,
    setMuted,
    setTab: setDataTab,
    fetchInbox,
    normalizeStatus,
  } = useKitchenData(user, showToast);

  const [autoAccept, setAutoAccept] = useState(() => localStorage.getItem("kitchen_auto_accept") === "true");
  const [autoReady, setAutoReady] = useState(() => localStorage.getItem("kitchen_auto_ready") === "true");
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Pickup PIN Modal State
  const [pickupPinModalOpen, setPickupPinModalOpen] = useState(false);
  const [pickupPinOrderId, setPickupPinOrderId] = useState<string | null>(null);

  // Catering / Bulk Prep Modal State
  const [bulkPrepModalOpen, setBulkPrepModalOpen] = useState(false);

  // Sync tab with data hook
  useEffect(() => {
    setDataTab(tab);
  }, [tab, setDataTab]);

  // Helper to compare statuses
  // Status normalization logic removed — handled by view if needed

  function openPickupPinModal(orderId: string) {
    setPickupPinOrderId(orderId);
    setPickupPinModalOpen(true);
  }

  // Legacy state for delivery boys, assignments and forecast is now handled by hooks
  
  const chatSetting = useAppSetting("chat_enabled", true);
  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const gstRate = taxSetting.value / 100;

  useEffect(() => {
    localStorage.setItem("kitchen_auto_accept", String(autoAccept));
  }, [autoAccept]);

  useEffect(() => {
    localStorage.setItem("kitchen_auto_ready", String(autoReady));
  }, [autoReady]);

  // -- PRINTING via hidden iframe (ensures Windows gets the title for PDF filename) --
  const printOrderLabels = useCallback((ids: string[]) => {
    const toPrint = ids
      .map(id => orders.find(o => o.id === id))
      .filter(Boolean) as OrderReceipt[];
    if (toPrint.length === 0) return;

    const pdfTitle = generatePdfTitle(toPrint);
    const pageHtml = buildLabelsPageHtml(toPrint, pdfTitle, gstRate);

    // Remove any existing print iframe
    const existing = document.getElementById('__print_iframe__');
    if (existing) existing.remove();

    // Create a hidden iframe — its document.title will become the PDF default filename
    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframe.contentWindow) { showToast('Print failed — iframe not ready.'); return; }

    iframeDoc.open();
    iframeDoc.write(pageHtml);
    iframeDoc.close();

    // Wait for content to render, then set title and print
    setTimeout(() => {
      iframeDoc.title = pdfTitle;
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        try { iframe.remove(); } catch {}
      }, 2000);
    }, 300);
  }, [orders, gstRate, showToast]);


  // const totalUnread = unreadCounts.inbox;

  // Data fetching and real-time syncing is now managed by useKitchenData hook

  // Fetch all threads on mount is now in useKitchenData
  const [replyText, setReplyText] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [kitchenSubTab, setKitchenSubTab] = useState<any>("new");

  // Group messages by customer_id
  const inboxGroups = useMemo(() => {
    const map = new Map<string, { customerId: string, name: string, messages: any[], lastUpdate: number }>();
    
    for (const msg of inboxRaw) {
      const cid = msg.customer_id;
      if (!map.has(cid)) {
        map.set(cid, { 
          customerId: cid, 
          // If the sender is also the customer, use their name. Otherwise "Customer" fallback.
          name: msg.sender_id === cid ? msg.sender_name : "Customer", 
          messages: [], 
          lastUpdate: 0 
        });
      }
      
      const group = map.get(cid)!;
      group.messages.push(msg);
      
      const time = new Date(msg.created_at).getTime();
      if (time > group.lastUpdate) group.lastUpdate = time;
      
      // Keep trying to find the actual customer name if it was a reply first (unlikely but possible)
      if (msg.sender_id === cid) group.name = msg.sender_name;
    }
    
    return Array.from(map.values()).sort((a, b) => b.lastUpdate - a.lastUpdate);
  }, [inboxRaw]);

  const activeChat = useMemo(() => {
    return inboxGroups.find(g => g.customerId === activeChatId) || null;
  }, [inboxGroups, activeChatId]);

  async function sendReply(customerId: string) {
    if (!replyText.trim() || !user || sendingMsg) return;
    setSendingMsg(true);
    const { error } = await supabase.from('chef_threads').insert({
      customer_id: customerId,
      sender_id: user.id,
      sender_name: user?.name.split(' ')[0] || "Chef",
      text: replyText.trim()
    });
    if (!error) {
      setReplyText("");
    }
    setSendingMsg(false);
  }

  const [forecastDate, setForecastDate] = useState(() => dayKey(addDays(new Date(), 1)));
  const [includeDone, setIncludeDone] = useState(false);

  // Live Orders: regular orders only (Delivery)
  const visibleOrders = useMemo(() => orders.filter((o: OrderReceipt) => {
    if (o.kind !== "regular" || o.customer?.isPickup) return false;
    const st = o.status || "New";
    if (!includeDone && (st === "Delivered" || st === "Cancelled")) return false;
    return true;
  }), [includeDone, orders]);

  // Pickup Orders: regular orders only (Pickup)
  const pickupOrders = useMemo(() => orders.filter(o => o.kind === "regular" && o.customer?.isPickup), [orders]);
  const visiblePickupOrders = useMemo(() => 
    pickupOrders.filter(o => {
      const st = o.status || "New";
      if (!includeDone && (st === "Delivered" || st === "Cancelled")) return false;
      return true;
    }).sort((a,b) => b.createdAt - a.createdAt), 
  [pickupOrders, includeDone]);
  const newPickupCount = useMemo(() => pickupOrders.filter(o => !o.status || o.status === "New").length, [pickupOrders]);

  // Group Orders tab
  const groupOrders = useMemo(() => orders.filter(o => o.kind === "group"), [orders]);
  const visibleGroupOrders = useMemo(() =>
    groupOrders
      .filter(o => {
        const st = o.status || "New";
        if (!includeDone && (st === "Delivered" || st === "Cancelled")) return false;
        return true;
      })
      .sort((a, b) => (a.deliveryAtLabel || "").localeCompare(b.deliveryAtLabel || "")),
  [groupOrders, includeDone]);
  const newGroupCount = useMemo(() => groupOrders.filter(o => !o.status || o.status === "New").length, [groupOrders]);

  // Subscriptions Today tab computed values
  const subTodayStr = useMemo(() => new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10), []);
  const subOrders = useMemo(() => {
    const todayOrders: any[] = [];
    orders.filter(o => (o.kind === "personalized" || o.kind === "subscription") && o.status !== 'Cancelled').forEach(o => {
      // Find what they should get TODAY specifically from their schedule
      const linesForToday = (o.meta?.scheduleLines || []).filter((l: any) => l.day === subTodayStr && l.qty > 0);
      
      const slotLabelMap: Record<string, string> = {
        Slot1: 'Breakfast', Slot2: 'Lunch', Slot3: 'Dinner',
        breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
        morning: 'Breakfast', Breakfast: 'Breakfast', Lunch: 'Lunch', Dinner: 'Dinner'
      };

      if (linesForToday.length > 0) {
        todayOrders.push({
          ...o,
          id: o.id, // Removed -today suffix
          headline: o.deliveryAtLabel === subTodayStr ? "Today's Delivery" : "Today's Order",
          lines: linesForToday.map((l: any) => ({
            itemId: l.itemId,
            label: l.type === 'addon' 
              ? `+ [${slotLabelMap[l.slot] || l.slot || "Meal"}] ${l.label} (Add-On)`
              : `[${slotLabelMap[l.slot] || l.slot || "Meal"}] ${l.label}`,
            qty: l.qty,
            unitPriceAtOrder: l.unitPriceAtOrder || 0
          }))
        });
      } else if (o.deliveryAtLabel === subTodayStr) {
        // Fallback for orders dated today that might lack scheduleLines (e.g. manual daily row)
        // We try to find a slot from kind or other meta if possible, but at least we show it in "All"
        todayOrders.push({
          ...o,
          id: o.id, // Removed -today suffix
          headline: "Today's Delivery"
        });
      }
    });
    return todayOrders;
  }, [orders, subTodayStr]);
  const newSubCount = useMemo(() => subOrders.filter(o => !o.status || o.status === "New").length, [subOrders]);
  
  const subSlotCounts = useMemo(() => {
    // Only count orders that still need processing in the kitchen (including out for delivery)
    const activeStatues = ['new', 'preparing', 'ready', 'out_for_delivery'];
    const pending = subOrders.filter(o => {
      const st = normalizeStatus(o.status);
      return activeStatues.includes(st);
    });
    
    return {
      All: pending.length,
      Breakfast: pending.filter(o => o.lines.some((l: any) => l.label.includes('[Breakfast]') || l.label.includes('[Slot1]'))).length,
      Lunch: pending.filter(o => o.lines.some((l: any) => l.label.includes('[Lunch]') || l.label.includes('[Slot2]'))).length,
      Dinner: pending.filter(o => o.lines.some((l: any) => l.label.includes('[Dinner]') || l.label.includes('[Slot3]'))).length,
    };
  }, [subOrders, normalizeStatus]);

  const slotFilteredSubOrders = useMemo(() => {
    let base = subOrders;
    
    // Filter by Slot and slice lines
    if (subSlotFilter === "All") return base;
    
    const slotAliasMap: Record<string, string[]> = {
      'Breakfast': ['[Breakfast]', '[Slot1]', '[morning]'],
      'Lunch': ['[Lunch]', '[Slot2]'],
      'Dinner': ['[Dinner]', '[Slot3]']
    };
    const searchTerms = slotAliasMap[subSlotFilter] || [`[${subSlotFilter}]`];

    return base
      .filter(o => o.lines.some((l: any) => searchTerms.some(term => l.label.includes(term))))
      .map(o => ({
        ...o,
        lines: o.lines.filter((l: any) => searchTerms.some(term => l.label.includes(term)))
      }));
  }, [subOrders, subSlotFilter]);

  const filteredSubOrders = useMemo(() => {
    return slotFilteredSubOrders.filter(o => {
      const st = normalizeStatus(o.status);
      return st === subSubTab;
    });
  }, [slotFilteredSubOrders, subSubTab, normalizeStatus]);

  // setStatus is now from the hook and handles optimism + DB

  const forecast = useMemo(() => {
    const counts = new Map<string, { label: string; qty: number }>();
    function addLine(itemId: string, label: string, qty: number) {
      if (!itemId) return;
      const cur = counts.get(itemId);
      if (cur) cur.qty += qty;
      else counts.set(itemId, { label, qty });
    }
    
    // 1. Regular and Group Orders
    for (const o of visibleOrders) {
      const st = o.status || "New";
      if (!includeDone && (st === "Delivered" || st === "Cancelled")) continue;
      
      if (o.kind === "group") {
        const datePart = (o.deliveryAtLabel || "").slice(0, 10);
        if (datePart && datePart !== forecastDate) continue;
        for (const l of o.lines) addLine(l.itemId, l.label, l.qty);
      }
      else if (o.kind === "regular") { 
        for (const l of o.lines) addLine(l.itemId, l.label, l.qty);
      }
    }

    // 2. Dynamic Subscription Forecast
    const targetDt = new Date(forecastDate);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = dayNames[targetDt.getDay()];

    for (const sub of activeSubs) {
       const dbStartDate = sub.meta?.startDate || sub.delivery_date || sub.created_at.split('T')[0];
       const durationDays = sub.meta?.durationDays || 30;
       
       const startMs = new Date(dbStartDate).getTime();
       const computedEndMs = startMs + (Math.max(0, durationDays - 1) * 24 * 60 * 60 * 1000);
       const dbEndDate = sub.meta?.endDate || new Date(computedEndMs).toISOString().slice(0, 10);

       if (dbStartDate && dbStartDate > forecastDate) continue;
       if (dbEndDate && dbEndDate < forecastDate) continue;

       const sched = sub.meta?.scheduleLines || [];
       const dayLines = sched.filter((l: any) => (l.day === targetDayName || l.day === forecastDate) && l.qty > 0);
       
       for (const line of dayLines) {
          const swap = allSwaps.find(s => s.subscription_id === sub.id && s.date === forecastDate && s.slot === line.slot);
          if (swap) {
             const mItem = allMenuItems.find(m => m.id === swap.menu_item_id);
             addLine(swap.menu_item_id, mItem?.name || "Swapped Item", line.qty);
          } else {
             const label = line.type === 'addon' ? `${line.label} (Add-On)` : line.label;
             addLine(line.itemId, label, line.qty);
          }
       }
    }

    const rows = Array.from(counts.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty);
    const totalItems = rows.reduce((acc, r) => acc + r.qty, 0);
    return { rows, totalItems };
  }, [forecastDate, includeDone, visibleOrders, activeSubs, allSwaps, allMenuItems]);

  const orderStats = useMemo(() => {
    let newCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let outCount = 0;
    let deliveredCount = 0;
    // Only count regular orders in the Live Orders stats
    for (const o of visibleOrders) {
       const st = o.status || "New";
       if (st === "New") newCount++;
       else if (st === "Preparing") preparingCount++;
       else if (st === "Ready") readyCount++;
       else if (st === "Out for delivery") outCount++;
       else if (st === "Delivered") deliveredCount++;
    }

   return {
       active: newCount + preparingCount + readyCount + outCount,
       new: newCount,
       preparing: preparingCount,
       ready: readyCount,
       out: outCount,
       delivered: deliveredCount
    };
  }, [visibleOrders]);

  // Using unreadMap directly from useKitchenData hook


  // --- START AUTO-PROCESSING ---
  useEffect(() => {
    if (!autoAccept && !autoReady) return;
    if (orders.length === 0) return;

    const toUpdate: { id: string; newStatus: KitchenStatus; dbStatus: string }[] = [];

    for (const o of orders) {
      // Group orders are NEVER auto-processed — they require manual kitchen review
      if (o.kind === "group") continue;

      const st = o.status || "New";
      if (autoAccept && st === "New") {
        toUpdate.push({ id: o.id, newStatus: "Preparing", dbStatus: 'preparing' });
      } else if (autoReady && st === "Preparing") {
        toUpdate.push({ id: o.id, newStatus: "Ready", dbStatus: 'ready' });
      }
    }

    if (toUpdate.length === 0) return;

    // Optimistically update UI first
    // setOrders(prev => prev.map(o => { // Removed unused forecast fetcher — forecasting is done dynamically in view
    //   const update = toUpdate.find(u => u.id === o.id);
    //   return update ? { ...o, status: update.newStatus } : o;
    // }));

    // Then persist to DB asynchronously with proper error handling
    (async () => {
      for (const u of toUpdate) {
        const { error } = await supabase.from('orders').update({ status: u.dbStatus }).eq('id', u.id);
        if (error) {
          console.error('[Kitchen] Auto-process update failed for order', u.id, error);
        }
      }
    })();
  }, [orders, autoAccept, autoReady]);
  // --- END AUTO-PROCESSING ---

  const renderOrderRow = (o: OrderReceipt, activeSubTab?: string) => {
    const subTab = activeSubTab ?? kitchenSubTab;
    const isGroup = o.kind === "group";
    const headcount = o.meta?.people || 0;

    return (
      <div key={o.id} className={cn(
        "bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col xl:flex-row group transition-all hover:shadow-md",
        isGroup ? "border-orange-200 ring-1 ring-orange-50" : "border-slate-200"
      )}>
        {/* Left Block: Basic Info */}
        <div className={cn(
          "xl:w-64 p-5 border-b xl:border-b-0 xl:border-r flex flex-col justify-center relative",
          isGroup ? "bg-orange-50/50 border-orange-100" : "bg-slate-50 border-slate-200"
        )}>
           {isGroup && (
             <div className="absolute top-3 right-3 bg-orange-600 text-white px-2 py-1 rounded-lg shadow-sm flex flex-col items-center min-w-[50px]">
               <span className="text-[10px] font-black uppercase leading-none mb-0.5">Heads</span>
               <span className="text-lg font-black leading-none">{headcount}</span>
             </div>
           )}

           <div className="flex items-center gap-2 mb-2">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order ID</span>
             <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-none px-2 py-0.5 text-[11px] font-bold">#{o.orderNumber || o.id.slice(0,8)}</Badge>
           </div>
           <h3 className="text-lg font-black text-slate-800 mb-1 leading-tight tracking-tight">{o.headline}</h3>
           <div className="flex flex-wrap gap-2 items-center">
             <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{formatDateTimeIndia(o.createdAt)}</div>
           </div>
           
           <div className="mt-4">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Expected Dispatch</div>
              <div className={cn(
                "text-sm font-black px-2 py-1 rounded inline-block",
                isGroup ? "text-orange-700 bg-orange-100/50" : "text-rose-700 bg-rose-100/50"
              )}>
                {isGroup ? formatDateTimeIndia(o.deliveryAtLabel) : formatDateIndia(o.deliveryAtLabel)}
              </div>
           </div>
        </div>

        {/* Middle Block: Items */}
        <div className="p-4 xl:w-1/3 border-b xl:border-b-0 xl:border-r border-slate-100 bg-white">
           <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Chef's Docket ({o.lines.length} Items)</div>
           <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
             {o.lines.map((l: any, idx: number) => (
               <div key={idx} className="flex items-start gap-2 text-sm text-slate-800">
                 <span className="font-black text-slate-900 w-6 text-right shrink-0"><span className="text-slate-400 font-medium text-xs pr-0.5">×</span>{l.qty}</span>
                 <span className="font-semibold">{l.label}</span>
               </div>
             ))}
           </div>
        </div>

        {/* Right Block: Customer Info */}
        <div className="p-4 xl:w-1/4 border-b xl:border-b-0 xl:border-r border-slate-100 bg-slate-50/50 flex flex-col justify-between">
           <div>
             <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Customer</div>
             <div className="font-black text-slate-900">{o.customer?.receiverName || "Unknown"}</div>
             <div className="text-xs font-semibold text-slate-500">{o.customer?.receiverPhone || "No phone"}</div>
           </div>
           
           <div className="mt-2 text-xs text-slate-600 leading-relaxed">
             <span className="inline-block bg-slate-800 text-white font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider mr-1.5">{o.customer?.locationType || "Home"}</span>
             {o.customer?.building}, {o.customer?.street}, {o.customer?.area}
           </div>

           {o.customer?.instructions && (
             <div className="mt-2 text-[11px] text-amber-900 bg-amber-100/50 p-2 rounded-lg border border-amber-200 font-medium flex gap-1.5">
               <span className="font-black uppercase tracking-wider text-[9px] bg-amber-200/50 text-amber-800 px-1 py-0.5 rounded shrink-0">Note</span>
               <span>{o.customer.instructions}</span>
             </div>
           )}
        </div>

        {/* Action Block */}
        <div className="p-4 xl:w-[16%] flex flex-col justify-center gap-3 bg-white">
           {subTab === "new" && (
             <>
               <button onClick={() => setStatus(o.id, "Preparing")} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors">Accept</button>
               <button onClick={() => setStatus(o.id, "Cancelled")} className="w-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 hover:border-rose-200 border border-transparent font-bold text-[10px] uppercase tracking-wider py-2 rounded-lg transition-colors">Reject</button>
             </>
           )}
           {subTab === "preparing" && (
             <button onClick={() => setStatus(o.id, "Ready")} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors">Mark Ready</button>
           )}

           {/* Ready tab: Assign Delivery Partner + conditional Send Out */}
           {subTab === "ready" && (() => {
             if (o.customer?.isPickup) {
               return (
                 <button onClick={() => openPickupPinModal(o.id)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors mt-auto">🔒 Verify PIN & Hand Over</button>
               );
             }

             const rawId = o.id.replace('-today', '');
             const existing = assignments.find((a: any) => a.order_id === rawId);
             const assignedBoy = existing ? deliveryBoys.find((b: any) => b.id === existing.delivery_boy_id) : null;
             return (
               <>
                 <div className="w-full">
                   <div className="flex items-center justify-between mb-1">
                     <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Delivery Partner</div>
                     {!existing && (
                       <button
                         onClick={async () => {
                           const activeBoys = deliveryBoys.filter((b: any) => b.is_active);
                           if (activeBoys.length === 0) { showToast("⚠️ No partners!"); return; }
                           
                           const loadMap: Record<string, number> = {};
                           activeBoys.forEach((b: any) => { loadMap[b.id] = 0; });
                           assignments.forEach((a: any) => {
                             if (a.status !== 'delivered' && loadMap[a.delivery_boy_id] !== undefined) loadMap[a.delivery_boy_id]++;
                           });
                           
                           const bestBoy = activeBoys.reduce((prev: any, curr: any) => (loadMap[curr.id] ?? 0) < (loadMap[prev.id] ?? 0) ? curr : prev);
                           await supabase.from('delivery_assignments').insert({ order_id: rawId, delivery_boy_id: bestBoy.id, status: 'assigned' });
                           showToast(`⚡ Assigned to ${bestBoy.name}`);
                         }}
                         className="text-[9px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded transition-colors"
                       >
                         ⚡ Auto
                       </button>
                     )}
                   </div>
                   <select
                     value={existing?.delivery_boy_id || ""}
                     onChange={async (e) => {
                       const boyId = e.target.value;
                       if (!boyId) return;
                       if (existing) {
                         await supabase.from('delivery_assignments').update({ delivery_boy_id: boyId, status: 'assigned' }).eq('id', existing.id);
                       } else {
                         await supabase.from('delivery_assignments').insert({ order_id: rawId, delivery_boy_id: boyId, status: 'assigned' });
                       }
                       showToast(`✅ Assigned to ${deliveryBoys.find((b: any) => b.id === boyId)?.name || 'partner'}`);
                     }}
                     className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
                   >
                     <option value="">{assignedBoy ? `✅ ${assignedBoy.name}` : '— Select Partner —'}</option>
                     {deliveryBoys.filter((b: any) => b.is_active).map((b: any) => (
                       <option key={b.id} value={b.id}>{b.name} {existing?.delivery_boy_id === b.id ? '(current)' : ''}</option>
                     ))}
                   </select>
                   {assignedBoy && (
                     <div className="text-[9px] font-bold text-emerald-600 mt-1 truncate">📱 {assignedBoy.phone}</div>
                   )}
                 </div>
                 {assignedBoy && (
                   <button onClick={() => setStatus(o.id, "Out for delivery")} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-lg shadow-sm transition-colors">Send Out</button>
                 )}
               </>
             );
           })()}

           {subTab === "out_for_delivery" && (
             <button onClick={() => setStatus(o.id, "Delivered")} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors">Delivered</button>
           )}

           {/* Edit Order Button — always available */}
           <button 
             onClick={() => setEditingOrderId(o.id)}
             className="w-full bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 py-2 rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
           >
             ✏️ Edit
           </button>

           {/* Print Label Button — available in Preparing status only */}
           {subTab === "preparing" && (
             <button 
               onClick={() => setPreviewOrderIds([o.id])}
               className="w-full mt-auto bg-black hover:bg-slate-800 text-white py-2 rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
             >
               <Printer className="w-3.5 h-3.5" /> Print
             </button>
           )}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
           <LuxuryLabel text={`Operator: ${user?.name || 'Kitchen Staff'}`} />
           <p className="text-sm text-slate-500 mt-1">Manage live orders and production forecasting.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLiveOrders} className="bg-white text-xs">↻ Refresh</Button>
          <Button
            variant="outline"
            onClick={() => setMuted(m => !m)}
            className={`bg-white text-xs ${muted ? 'text-slate-400' : 'text-emerald-700'}`}
            title={muted ? 'Sound muted — click to unmute' : 'Sound on — click to mute'}
          >
            {muted ? '🔕 Muted' : '🔔 Sound On'}
          </Button>
          <Button variant="outline" onClick={onBack} className="bg-white">Exit Kitchen</Button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between">
          <span>⚠️ Error loading orders: {fetchError}</span>
          <button onClick={fetchLiveOrders} className="text-red-400 hover:text-red-600 ml-4">↻ Retry</button>
        </div>
      )}

      <div className="bg-slate-100 p-1 rounded-2xl shadow-inner inline-flex mb-8 flex-wrap gap-y-1">
        <button onClick={() => setTab("orders")} className={cn("flex items-center gap-2 text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "orders" ? "bg-white text-emerald-800 shadow-sm border border-emerald-100/50" : "text-slate-500 hover:text-slate-800")}>
          Live Orders
          {(unreadCounts.orders > 0 || orderStats.new > 0) && (
            <span className={cn("text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm", unreadCounts.orders > 0 ? "bg-rose-600 animate-pulse" : "bg-slate-400")}>{unreadCounts.orders > 0 ? unreadCounts.orders : orderStats.new}</span>
          )}
        </button>
        <button onClick={() => { setTab("groups"); setGroupSubTab("new"); }} className={cn("flex items-center gap-2 text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "groups" ? "bg-white text-orange-800 shadow-sm border border-orange-100/50" : "text-slate-500 hover:text-slate-800")}>
          Group Orders
          {unreadCounts.groups > 0 || newGroupCount > 0 ? (
            <span className={cn("text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm", unreadCounts.groups > 0 ? "bg-rose-600 animate-pulse" : "bg-slate-400")}>{unreadCounts.groups > 0 ? unreadCounts.groups : newGroupCount}</span>
          ) : null}
        </button>
        <button onClick={() => { setTab("pickup"); setPickupSubTab("new"); }} className={cn("flex items-center gap-2 text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "pickup" ? "bg-white text-indigo-800 shadow-sm border border-indigo-100/50" : "text-slate-500 hover:text-slate-800")}>
          Pickup Orders
          {unreadCounts.pickups > 0 || newPickupCount > 0 ? (
            <span className={cn("text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm", unreadCounts.pickups > 0 ? "bg-rose-600 animate-pulse" : "bg-slate-400")}>{unreadCounts.pickups > 0 ? unreadCounts.pickups : newPickupCount}</span>
          ) : null}
        </button>
        <button onClick={() => { setTab("subscriptions"); setSubSlotFilter("All"); }} className={cn("flex items-center gap-2 text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "subscriptions" ? "bg-white text-violet-800 shadow-sm border border-violet-100/50" : "text-slate-500 hover:text-slate-800")}>
          📦 Subscriptions Today
          {unreadCounts.subs > 0 || newSubCount > 0 ? (
            <span className={cn("text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm", unreadCounts.subs > 0 ? "bg-rose-600 animate-pulse" : "bg-slate-400")}>{unreadCounts.subs > 0 ? unreadCounts.subs : newSubCount}</span>
          ) : null}
        </button>
        <button onClick={() => setTab("forecast")} className={cn("text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "forecast" ? "bg-white text-emerald-800 shadow-sm border border-emerald-100/50" : "text-slate-500 hover:text-slate-800")}>Production Forecast</button>
        {!chatSetting.loading && chatSetting.value && (<button onClick={() => { setTab("inbox"); }} className={cn("flex items-center gap-2 text-sm font-semibold rounded-xl py-2 px-5 transition-all outline-none", tab === "inbox" ? "bg-white text-emerald-800 shadow-sm border border-emerald-100/50" : "text-slate-500 hover:text-slate-800")}>
          Chef's Inbox
          {unreadCounts.inbox > 0 && (
             <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCounts.inbox}</span>
          )}
        </button>)}
      </div>

      {tab === "groups" ? (
        <div className="space-y-6">
          <Card className="border-t-4 border-t-orange-500 shadow-lg">
            <CardHeader className="bg-orange-50/50 border-b border-orange-100 flex flex-row items-center justify-between">
              <SectionTitle icon={UtensilsCrossed} title="Group Orders" subtitle="Scheduled bulk & event orders, sorted by delivery date." />
              <Button
                variant="outline"
                className="bg-white border-orange-200 text-orange-700 hover:bg-orange-50 font-black text-[10px] uppercase tracking-widest h-9 px-4 rounded-xl shadow-sm"
                onClick={() => setBulkPrepModalOpen(true)}
              >
                📋 Bulk Prep Summary
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {visibleGroupOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium italic">No group orders yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status sub-tab bar */}
                  <div className="flex border-b border-slate-200 gap-6 px-1 overflow-x-auto hide-scrollbar sticky top-0 bg-orange-50/60 z-20 pt-2 items-start">
                    {([
                      { key: "new" as const,              label: "New",              color: "border-amber-500 text-amber-700"    },
                      { key: "preparing" as const,        label: "Preparing",        color: "border-sky-500 text-sky-700"        },
                      { key: "ready" as const,            label: "Ready",            color: "border-emerald-500 text-emerald-700"},
                      { key: "out_for_delivery" as const, label: "Out for Delivery", color: "border-purple-500 text-purple-700"  },
                      { key: "delivered" as const,        label: "Delivered",        color: "border-slate-800 text-slate-800"    },
                      { key: "cancelled" as const,        label: "Cancelled",        color: "border-rose-500 text-rose-700"      },
                    ]).map(({ key, label, color }) => {
                      const count = visibleGroupOrders.filter(o => {
                        return normalizeStatus(o.status) === key;
                      }).length;
                      return (
                        <button
                          key={key}
                          onClick={() => setGroupSubTab(key)}
                          className={cn("whitespace-nowrap pb-3 font-bold text-sm transition-all border-b-[3px] shrink-0",
                            groupSubTab === key ? color : "border-transparent text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Order list for selected group sub-tab */}
                  <div className="flex flex-col gap-4">
                    {(() => {
                      const filtered = visibleGroupOrders.filter(o => {
                        return normalizeStatus(o.status) === groupSubTab;
                      });
                      if (filtered.length === 0) return (
                        <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No orders in this status.</div>
                      );
                      return filtered.map(o => renderOrderRow(o, groupSubTab));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : tab === "subscriptions" ? (

        <div className="space-y-6">
          {/* Slot Filter Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["All", "Breakfast", "Lunch", "Dinner"] as const).map(slot => {
              const slotColors: Record<string, {bg: string; border: string; text: string; num: string}> = {
                All:       { bg: "bg-violet-50",   border: "border-violet-300",  text: "text-violet-700",  num: "text-violet-600" },
                Breakfast: { bg: "bg-amber-50",    border: "border-amber-300",   text: "text-amber-800",   num: "text-amber-600"  },
                Lunch:     { bg: "bg-sky-50",      border: "border-sky-300",     text: "text-sky-800",     num: "text-sky-600"    },
                Dinner:    { bg: "bg-rose-50",     border: "border-rose-300",    text: "text-rose-800",    num: "text-rose-600"   },
              };
              const c = slotColors[slot];
              const isActive = subSlotFilter === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setSubSlotFilter(slot)}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition-all shadow-sm",
                    isActive ? `${c.bg} ${c.border} shadow-md scale-[1.02]` : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isActive ? c.text : "text-slate-400")}>{slot === "All" ? "All Slots" : slot}</div>
                  <div className={cn("text-3xl font-black", isActive ? c.num : "text-slate-600")}>{subSlotCounts[slot]}</div>
                  <div className="text-[10px] text-slate-400 mt-1">orders</div>
                </button>
              );
            })}
          </div>

          {/* Order List */}
          <Card className="border-t-4 border-t-violet-500 shadow-lg">
            <CardHeader className="bg-violet-50/50 border-b border-violet-100">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <SectionTitle
                    icon={UtensilsCrossed}
                    title={subSlotFilter === "All" ? "Today's Orders" : `${subSlotFilter} Orders`}
                    subtitle={`Delivery date: ${subTodayStr} · ${filteredSubOrders.length} order${filteredSubOrders.length !== 1 ? 's' : ''}`}
                  />
                  
                  <div className="flex border-b border-slate-200 gap-4 px-1 overflow-x-auto hide-scrollbar pt-2 items-start shrink-0">
                    {([
                      { key: "new" as const,              label: "New",              color: "border-amber-500 text-amber-700"    },
                      { key: "preparing" as const,        label: "Preparing",        color: "border-sky-500 text-sky-700"        },
                      { key: "ready" as const,            label: "Ready",            color: "border-emerald-500 text-emerald-700"},
                      { key: "out_for_delivery" as const, label: "Out for Delivery", color: "border-purple-500 text-purple-700"  },
                      { key: "delivered" as const,        label: "Delivered",        color: "border-slate-800 text-slate-800"    },
                      { key: "cancelled" as const,        label: "Cancelled",        color: "border-rose-500 text-rose-700"      },
                    ]).map(({ key, label, color }) => {
                      const count = slotFilteredSubOrders.filter(o => {
                        return normalizeStatus(o.status) === key;
                      }).length;
                      return (
                      <div key={key} className="flex flex-col gap-1 shrink-0 items-center">
                        <button
                          onClick={() => setSubSubTab(key)}
                          className={cn("whitespace-nowrap pb-1 font-bold text-[11px] uppercase tracking-wider transition-all border-b-[3px] shrink-0",
                            subSubTab === key ? color : "border-transparent text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {label} ({count})
                        </button>
                        {key === "new" && subSubTab === "new" && (
                          <label className="flex items-center justify-center gap-1 text-[9px] uppercase font-black tracking-widest text-amber-600 pb-1 cursor-pointer bg-amber-50 px-1 rounded">
                            <input type="checkbox" checked={autoAccept} onChange={e => setAutoAccept(e.target.checked)} className="accent-amber-600 w-3 h-3" /> Auto
                          </label>
                        )}
                        {key === "preparing" && subSubTab === "preparing" && (
                          <div className="flex flex-col gap-1 items-center">
                            <label className="flex items-center justify-center gap-1 text-[9px] uppercase font-black tracking-widest text-sky-600 pb-1 cursor-pointer bg-sky-50 px-1 rounded">
                              <input type="checkbox" checked={autoReady} onChange={e => setAutoReady(e.target.checked)} className="accent-sky-600 w-3 h-3" /> Auto
                            </label>
                            {count > 0 && (
                              <button 
                                onClick={() => setPreviewOrderIds(slotFilteredSubOrders.filter(o => normalizeStatus(o.status) === "preparing").map(o => o.id))}
                                className="text-[9px] uppercase font-black tracking-widest text-white bg-sky-600 hover:bg-sky-700 rounded px-1.5 py-0.5 transition-colors flex items-center justify-center gap-1 shadow-sm"
                              >
                                <Printer className="w-2.5 h-2.5" /> Print All
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
               </div>
            </CardHeader>
            <CardContent className="pt-4">
              {filteredSubOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium italic">No {subSubTab.replace('_', ' ')} orders matched.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredSubOrders.map(o => {
                    const impliedSubTab = normalizeStatus(o.status) as any;
                    return renderOrderRow(o, impliedSubTab);
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : tab === "inbox" ? (
         <Card className="border-t-4 border-t-amber-500 shadow-lg min-h-[600px] flex flex-col">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100">
            <SectionTitle icon={MessageCircle} title="Chef's Inbox" subtitle="Direct line to customers." />
          </CardHeader>
          <CardContent className="p-0 flex flex-1 overflow-hidden">
             
             {/* Sidebar List */}
             <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col max-h-[600px] overflow-y-auto">
                {inboxGroups.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500 italic mt-10">No messages yet.</div>
                ) : (
                  <div>
                    {inboxGroups.map(g => (
                      <button 
                        key={g.customerId} 
                        onClick={() => { setActiveChatId(g.customerId); }}
                        className={cn("w-full text-left p-4 border-b transition-colors", activeChatId === g.customerId ? "bg-white border-l-4 border-l-amber-500 border-b-slate-100" : "hover:bg-slate-100 border-l-4 border-l-transparent text-slate-600 border-b-slate-200")}
                      >
                         <div className="flex items-center justify-between mb-1">
                           <span className={cn("truncate", unreadMap[g.customerId] > 0 ? "font-black text-slate-900" : "font-bold text-slate-900")}>{g.name}</span>
                            {hasActiveSubscription(g.customerId, orders) && (
                              <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center" title="Active Subscription">
                                <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                              </span>
                            )}
                           {unreadMap[g.customerId] > 0 && (
                              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm ml-2 font-bold shrink-0">
                                {unreadMap[g.customerId]}
                              </span>
                           )}
                         </div>
                         <div className={cn("text-xs truncate", unreadMap[g.customerId] > 0 ? "font-bold text-slate-800" : "text-slate-500")}>{g.messages[g.messages.length - 1]?.text}</div>
                         <div className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">{formatTimeIndia(g.lastUpdate)}</div>
                      </button>
                    ))}
                  </div>
                )}
             </div>

             {/* Chat Area */}
             <div className="flex-1 flex flex-col bg-white min-w-0">
                {activeChat ? (
                  <>
                    <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur flex justify-between items-center">
                       <div>
                         <h3 className="font-bold text-lg text-slate-900">{activeChat.name}</h3>
                         <p className="text-xs text-slate-500">Customer ID: {activeChat.customerId}</p>
                       </div>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                         onClick={async () => {
                           if (window.confirm("Are you sure you want to clear this entire chat history?")) {
                             await supabase.from('chef_threads').delete().eq('customer_id', activeChat.customerId);
                             fetchInbox();
                             setActiveChatId(null);
                           }
                         }}
                       >
                         Clear Chat
                       </Button>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[450px]">
                       {activeChat.messages.map(m => {
                         const isKitchen = m.sender_id !== activeChat.customerId;
                         return (
                           <div key={m.id} className={cn("max-w-[70%] rounded-2xl p-4 text-sm", isKitchen ? "bg-amber-100 text-amber-900 ml-auto rounded-tr-sm" : "bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-sm")}>
                             <div className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-1">
                               {m.sender_name} • {formatTimeIndia(m.created_at)}
                             </div>
                             {m.text}
                           </div>
                         )
                       })}
                       <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-end gap-2">
                       <Input 
                         value={replyText} 
                         onChange={e => setReplyText(e.target.value)}
                         placeholder="Type a reply..."
                         onKeyDown={e => {
                           if(e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault();
                             sendReply(activeChat.customerId);
                           }
                         }}
                         className="flex-1"
                       />
                       <Button onClick={() => sendReply(activeChat.customerId)} disabled={!replyText.trim() || sendingMsg} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 h-10">
                          <Send className="w-4 h-4 mr-2" /> Reply
                       </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center flex-col text-slate-400">
                     <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                     <p>Select a customer to view messages.</p>
                  </div>
                )}
              </div>

              {/* Customer Context Panel */}
              {activeChat && (
                <CustomerContextPanel
                  customerId={activeChat.customerId}
                  allOrders={orders}
                  onOrderClick={(id) => setEditingOrderId(id)}
                />
              )}
           </CardContent>
          </Card>
      ) : tab === "forecast" ? (
        <Card className="border-t-4 border-t-sky-500 shadow-xl overflow-hidden bg-slate-50/30">
          <CardHeader className="bg-white border-b border-slate-100 p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <SectionTitle 
                icon={Sparkles} 
                title="Production Forecasting" 
                subtitle="Aggregated item counts across all active orders and upcoming subscription meals."
              />
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button
                  onClick={() => setIncludeDone(!includeDone)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    includeDone ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {includeDone ? "✓ Inc. Done" : "Hide Done"}
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <button
                  onClick={() => printOrderLabels(visibleOrders.map(o => o.id))}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" /> Print All
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid lg:grid-cols-3 gap-8">
              
              <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                       Target Date
                       <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded text-[9px]">Live Sync</span>
                    </div>
                    <div className="relative group">
                      <div className="w-full bg-slate-50 border-2 border-slate-100 group-hover:border-sky-200 rounded-[1.5rem] p-4 flex items-center justify-between cursor-pointer transition-all">
                        <span className="text-xl font-black text-slate-800">{formatDateIndia(forecastDate)}</span>
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 text-slate-400 group-hover:text-sky-500 transition-colors">📅</div>
                      </div>
                      <input 
                        id="forecast-date-picker"
                        type="date"
                        value={forecastDate}
                        onChange={(e) => setForecastDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="text-[11px] leading-relaxed font-medium text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-4">Personalized subscriptions use member selection timelines. Group events rely on requested delivery time. Walk-in / regular requests are mapped to "next available".</div>
                  </div>
                  
                  <div className="rounded-2xl border border-sky-100 bg-sky-600 p-6 shadow-md text-white">
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-200 mb-1">Total Unit Volume</div>
                      <div className="text-4xl font-black">{forecast.totalItems}</div>
                      <div className="text-sm text-sky-100 mt-2 font-medium">Unique preparations needed to fulfill active orders.</div>
                  </div>
              </div>

              <div className="lg:col-span-2">
                 <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
                    <div className="text-sm font-bold text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                       Preparation Breakdown
                       <Badge className="bg-sky-100 text-sky-800 rounded-lg px-3 py-1">{forecast.rows.length} Recipes</Badge>
                    </div>
                    <div className="space-y-3 overflow-y-auto max-h-[500px] flex-1 pr-2 custom-scrollbar">
                      {forecast.rows.length ? forecast.rows.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-sky-50 hover:border-sky-100 transition-colors group">
                          <div className="text-sm font-bold text-slate-800 group-hover:text-sky-900 pl-1">{r.label}</div>
                          <div className="px-4 py-1.5 bg-white border border-slate-200 text-slate-900 font-black rounded-xl shadow-sm">
                            <span className="text-slate-400 text-xs mr-0.5 uppercase tracking-tighter">Qty</span> {r.qty}
                          </div>
                        </div>
                      )) : <div className="text-center py-16 text-slate-400 font-medium italic">No scheduled volume for this date. Go relax!</div>}
                    </div>
                 </div>
              </div>

            </div>
          </CardContent>
        </Card>
      ) : tab === "pickup" ? (
        <div className="space-y-6">
          <Card className="border-t-4 border-t-indigo-500 shadow-lg">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
              <SectionTitle icon={UtensilsCrossed} title="Pickup Orders" subtitle="Orders waiting for customer pickup." />
            </CardHeader>
            <CardContent className="pt-4">
              {visiblePickupOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium italic">No pickup orders yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex border-b border-slate-200 gap-6 px-1 overflow-x-auto hide-scrollbar sticky top-0 bg-indigo-50/60 z-20 pt-2 items-start">
                    {([
                      { key: "new" as const,              label: "New",              color: "border-amber-500 text-amber-700"    },
                      { key: "preparing" as const,        label: "Preparing",        color: "border-sky-500 text-sky-700"        },
                      { key: "ready" as const,            label: "Ready",            color: "border-emerald-500 text-emerald-700"},
                      { key: "delivered" as const,        label: "Picked Up",        color: "border-slate-800 text-slate-800"    },
                      { key: "cancelled" as const,        label: "Cancelled",        color: "border-rose-500 text-rose-700"      },
                    ]).map(({ key, label, color }) => {
                      const count = visiblePickupOrders.filter(o => {
                        return normalizeStatus(o.status) === key;
                      }).length;
                      return (
                        <button
                          key={key}
                          onClick={() => setPickupSubTab(key)}
                          className={cn("whitespace-nowrap pb-3 font-bold text-sm transition-all border-b-[3px] shrink-0",
                            pickupSubTab === key ? color : "border-transparent text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-4">
                    {(() => {
                      const filtered = visiblePickupOrders.filter(o => {
                        return normalizeStatus(o.status) === pickupSubTab;
                      });
                      if (filtered.length === 0) return (
                        <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No orders in this status.</div>
                      );
                      return filtered.map(o => renderOrderRow(o, pickupSubTab));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <SkeletonKitchenCard />
          <SkeletonKitchenCard />
          <SkeletonKitchenCard />
          <SkeletonKitchenCard />
        </div>
      ) : (
        <div className="space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 <div className="bg-slate-100 py-2 border-b border-slate-200 text-center">
                   <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Total Active</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-slate-800">{orderStats.active}</div>
                 </div>
              </div>

              <button onClick={() => setKitchenSubTab("new")} className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden flex flex-col hover:border-amber-400 transition-colors">
                 <div className="bg-amber-100 py-2 border-b border-amber-200 text-center">
                   <div className="text-amber-800 text-[10px] uppercase font-bold tracking-widest">New</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-amber-600">{orderStats.new}</div>
                 </div>
              </button>

              <button onClick={() => setKitchenSubTab("preparing")} className="bg-white rounded-xl shadow-sm border border-sky-200 overflow-hidden flex flex-col hover:border-sky-400 transition-colors">
                 <div className="bg-sky-100 py-2 border-b border-sky-200 text-center">
                   <div className="text-sky-800 text-[10px] uppercase font-bold tracking-widest">Preparing</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-sky-600">{orderStats.preparing}</div>
                 </div>
              </button>

              <button onClick={() => setKitchenSubTab("ready")} className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden flex flex-col hover:border-emerald-400 transition-colors">
                 <div className="bg-emerald-100 py-2 border-b border-emerald-200 text-center">
                   <div className="text-emerald-800 text-[10px] uppercase font-bold tracking-widest">Ready</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-emerald-600">{orderStats.ready}</div>
                 </div>
              </button>

              <button onClick={() => setKitchenSubTab("out_for_delivery")} className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden flex flex-col hover:border-purple-400 transition-colors text-left outline-none">
                 <div className="bg-purple-100 py-2 border-b border-purple-200 text-center">
                   <div className="text-purple-800 text-[10px] uppercase font-bold tracking-widest">Out for Delivery</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-purple-600">{orderStats.out}</div>
                 </div>
              </button>

               <button onClick={() => setKitchenSubTab("delivered")} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-60 hover:opacity-100 hover:border-slate-400 transition-all">
                 <div className="bg-slate-100 py-2 border-b border-slate-200 text-center">
                   <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Delivered</div>
                 </div>
                 <div className="p-3 text-center flex-1 flex items-center justify-center">
                   <div className="text-3xl font-black text-slate-400">{orderStats.delivered}</div>
                 </div>
              </button>
           </div>
{!visibleOrders.length ? (
            <Card className="border-dashed border-2 bg-slate-50 text-center py-20">
               <CardContent>
                  <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
                  <h3 className="text-lg font-bold text-slate-700">Kitchen is clear</h3>
                  <p className="text-slate-500 text-sm mt-1">No active orders queued right now.</p>
               </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
               {/* Horizontal Tab Navigation */}
               <div className="flex border-b border-slate-200 gap-6 px-1 overflow-x-auto hide-scrollbar sticky top-0 bg-slate-50 z-20 pt-2 items-start">
                 
                 {/* New Tab with Auto Accept Toggle */}
                 <div className="flex flex-col gap-1.5 shrink-0">
                   <button 
                     onClick={() => setKitchenSubTab("new")}
                     className={cn("whitespace-nowrap pb-1 font-bold text-sm transition-all border-b-[3px]", kitchenSubTab === "new" ? "border-amber-500 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700")}
                   >
                     New ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "new" && !o.customer.isPickup).length})
                   </button>
                   {kitchenSubTab === "new" && (
                     <label className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-amber-600 pb-2 cursor-pointer bg-amber-50 px-2 rounded-md">
                       <input type="checkbox" checked={autoAccept} onChange={e => setAutoAccept(e.target.checked)} className="accent-amber-600" /> Auto Accept
                     </label>
                   )}
                 </div>

                 {/* Preparing Tab with Bulk Print Action */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button 
                      onClick={() => setKitchenSubTab("preparing")}
                      className={cn("whitespace-nowrap pb-1 font-bold text-sm transition-all border-b-[3px]", kitchenSubTab === "preparing" ? "border-sky-500 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700")}
                    >
                      Preparing ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "preparing").length})
                    </button>
                    {kitchenSubTab === "preparing" && visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "preparing").length > 0 && (
                      <button 
                        onClick={() => setPreviewOrderIds(visibleOrders.filter((o: OrderReceipt) => o.status === "Preparing").map(o => o.id))}
                        className="text-[10px] uppercase font-black tracking-widest text-white bg-sky-600 hover:bg-sky-700 rounded px-2 py-1 pb-1 mb-1 transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Printer className="w-3 h-3" /> Print All Bills
                      </button>
                    )}
                  </div>

                 {/* Ready Tab with Assign All Partners Action */}
                 <div className="flex flex-col gap-1.5 shrink-0">
                    <button 
                      onClick={() => setKitchenSubTab("ready")}
                      className={cn("whitespace-nowrap pb-1 font-bold text-sm transition-all border-b-[3px]", kitchenSubTab === "ready" ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700")}
                    >
                      Ready ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "ready").length})
                    </button>
                    {kitchenSubTab === "ready" && visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "ready").length > 0 && (
                      <button 
                        onClick={async () => {
                          const readyOrders = visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "ready");
                          const activeBoys = deliveryBoys.filter((b: any) => b.is_active);
                          if (activeBoys.length === 0) { showToast("⚠️ No active delivery partners!"); return; }
                          
                          const loadMap: Record<string, number> = {};
                          activeBoys.forEach((b: any) => { loadMap[b.id] = 0; });
                          assignments.forEach((a: any) => {
                            if (a.status !== 'delivered' && loadMap[a.delivery_boy_id] !== undefined) loadMap[a.delivery_boy_id]++;
                          });

                          let assigned = 0;
                          for (const o of readyOrders) {
                            const rawId = o.id; // Removed .replace('-today', '')
                            const existing = assignments.find((a: any) => a.order_id === rawId);
                            if (existing) continue;

                            const bestBoy = activeBoys.reduce((prev: any, curr: any) => (loadMap[curr.id] ?? 0) < (loadMap[prev.id] ?? 0) ? curr : prev);
                            await supabase.from('delivery_assignments').insert({ order_id: rawId, delivery_boy_id: bestBoy.id, status: 'assigned' });
                            loadMap[bestBoy.id]++;
                            assigned++;
                          }
                          showToast(`⚡ Auto-assigned ${assigned} order${assigned !== 1 ? 's' : ''} to partners`);
                        }}
                        className="text-[10px] uppercase font-black tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 rounded px-2 py-1 pb-1 mb-1 transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        🛵 Assign All Partners
                      </button>
                    )}
                  </div>
 

                 <button 
                   onClick={() => setKitchenSubTab("out_for_delivery")}
                   className={cn("whitespace-nowrap pb-3 font-bold text-sm transition-all border-b-[3px] shrink-0", kitchenSubTab === "out_for_delivery" ? "border-purple-500 text-purple-700" : "border-transparent text-slate-500 hover:text-slate-700")}
                 >
                   Out for Delivery ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "out_for_delivery").length})
                 </button>
                 <button 
                   onClick={() => setKitchenSubTab("delivered")}
                   className={cn("whitespace-nowrap pb-3 font-bold text-sm transition-all border-b-[3px] shrink-0", kitchenSubTab === "delivered" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700")}
                 >
                   Delivered ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "delivered").length})
                 </button>
                 <button 
                   onClick={() => setKitchenSubTab("cancelled")}
                   className={cn("whitespace-nowrap pb-3 font-bold text-sm transition-all border-b-[3px] shrink-0", kitchenSubTab === "cancelled" ? "border-rose-500 text-rose-700" : "border-transparent text-slate-500 hover:text-slate-700")}
                 >
                   Cancelled ({visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "cancelled").length})
                 </button>
               </div>

               {/* Render Area based on selected tab */}
               <div className="flex flex-col gap-4">
                 {kitchenSubTab === "new" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "new" && !o.customer.isPickup).length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No new orders waiting.</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "new" && !o.customer.isPickup).map(o => renderOrderRow(o))
                 )}

                 {kitchenSubTab === "preparing" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "preparing" && !o.customer.isPickup).length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No orders currently in preparation.</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "preparing" && !o.customer.isPickup).map(o => renderOrderRow(o))
                 )}

                 {kitchenSubTab === "ready" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "ready" && !o.customer.isPickup).length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No orders currently ready.</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "ready" && !o.customer.isPickup).map(o => renderOrderRow(o))
                 )}


                 {kitchenSubTab === "out_for_delivery" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "out_for_delivery").length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No orders currently out for delivery.</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "out_for_delivery").map(o => renderOrderRow(o))
                 )}

                 {kitchenSubTab === "delivered" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "delivered").length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No delivered orders in the current view. (Check your filters above)</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "delivered").map(o => renderOrderRow(o))
                 )}

                 {kitchenSubTab === "cancelled" && (
                   visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "cancelled").length === 0 ? (
                     <div className="py-12 text-center text-slate-400 font-medium italic bg-white rounded-xl border border-dashed border-slate-200">No cancelled orders.</div>
                   ) : visibleOrders.filter((o: OrderReceipt) => normalizeStatus(o.status) === "cancelled").map(o => renderOrderRow(o))
                 )}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
      {editingOrderId && orders.find(o => o.id === editingOrderId) && (
        <OrderEditModal 
          order={orders.find(o => o.id === editingOrderId)!} 
          onClose={() => setEditingOrderId(null)} 
          onSaved={() => { showToast("Order Updated"); fetchLiveOrders(); }} 
        />
      )}

      {bulkPrepModalOpen && (
        <BulkPrepModal 
          orders={groupOrders.filter(o => {
            const st = normalizeStatus(o.status);
            return st === "new" || st === "preparing" || st === "ready";
          })}
          onClose={() => setBulkPrepModalOpen(false)}
        />
      )}

      {previewOrderIds && (() => {
        const previewOrders = previewOrderIds
          .map(id => orders.find(o => o.id === id))
          .filter(Boolean) as OrderReceipt[];
        return previewOrders.length > 0 ? (
          <BillPreviewModal
            orders={previewOrders}
            onPrint={() => { printOrderLabels(previewOrderIds); setPreviewOrderIds(null); }}
            onClose={() => setPreviewOrderIds(null)}
            gstRate={gstRate}
          />
        ) : null;
      })()}

      <PickupPinModal
        isOpen={pickupPinModalOpen}
        onClose={() => setPickupPinModalOpen(false)}
        orderId={pickupPinOrderId || ""}
        showToast={showToast}
        onSuccess={(id: string) => {
          setStatus(id, "Delivered");
          setPickupPinModalOpen(false);
        }}
      />
    </>
  );
}

function BulkPrepModal({ orders, onClose }: { orders: OrderReceipt[], onClose: () => void }) {
  const totals = useMemo(() => {
    const map = new Map<string, { label: string, qty: number }>();
    orders.forEach(o => {
      o.lines.forEach(l => {
        const cur = map.get(l.itemId);
        if (cur) cur.qty += l.qty;
        else map.set(l.itemId, { label: l.label, qty: l.qty });
      });
    });
    return Array.from(map.values()).sort((a,b) => b.qty - a.qty);
  }, [orders]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-orange-600 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">✕</button>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-100 mb-2">Catering Mode</div>
          <h2 className="text-3xl font-black tracking-tighter">Bulk Prep Summary</h2>
          <p className="text-orange-100/80 text-sm font-medium mt-1">Consolidated item counts for {orders.length} active group orders.</p>
        </div>
        <div className="p-8">
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {totals.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic">No items to prepare.</div>
            ) : totals.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-orange-200 transition-colors">
                <span className="font-bold text-slate-800 transition-colors group-hover:text-orange-900">{t.label}</span>
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-1.5 shadow-sm">
                   <span className="text-xs font-black text-slate-400 mr-1.5 uppercase tracking-widest">Qty</span>
                   <span className="text-lg font-black text-orange-600">{t.qty}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button onClick={onClose} className="w-full bg-slate-900 h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-200">Close Summary</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { OrderReceipt, KitchenStatus, AppUser } from "../types";

export function useKitchenData(user: AppUser | null, showToast: (msg: string) => void) {
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  
  // Unread badge states
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadGroups, setUnreadGroups] = useState(0);
  const [unreadPickups, setUnreadPickups] = useState(0);
  const [unreadSubs, setUnreadSubs] = useState(0);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [inboxRaw, setInboxRaw] = useState<any[]>([]);

  // Forecast/Subscription data
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [allSwaps, setAllSwaps] = useState<any[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<any[]>([]);

  const isFirstLoad = useRef(true);
  const currentTabRef = useRef<string>("orders");
  const knownOrderIds = useRef<Set<string>>(new Set());


  function playBell() {
    if (muted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* ignore audio errors */ }
  }

  const fetchLiveOrders = useCallback(async () => {
    setFetchError(null);
    if (isFirstLoad.current) setIsLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items ( id, menu_item_id, item_name, quantity, unit_price )`)
      .neq('payment_status', 'pending') // Prevent unpaid checkouts from appearing in kitchen
      .or(`status.in.(pending,preparing,ready,out_for_delivery),delivery_date.eq.${todayStr}`)
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      setFetchError(error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      const mapped: OrderReceipt[] = data.map(dbOrder => ({
        id: dbOrder.id,
        userId: dbOrder.user_id,
        orderNumber: dbOrder.order_number,
        kind: dbOrder.kind as any,
        createdAt: new Date(dbOrder.created_at).getTime(),
        headline: dbOrder.kind === 'group' ? "Group Order" : dbOrder.kind === 'personalized' ? "Today's Order" : "Regular Order",
        deliveryAtLabel: dbOrder.delivery_date,
        customer: dbOrder.delivery_details || { receiverName: dbOrder.customer_name || 'Unknown', receiverPhone: '' },
        payment: dbOrder.payment_status,
        meta: dbOrder.meta,
        status: (() => {
          const st = dbOrder.status?.toLowerCase().replace(/[\s_]+/g, '_') || 'pending';
          if (st === 'pending') return 'New';
          if (st === 'preparing') return 'Preparing';
          if (st === 'ready') return 'Ready';
          if (st === 'out_for_delivery') return 'Out for delivery';
          if (st === 'delivered') return 'Delivered';
          if (st === 'cancelled') return 'Cancelled';
          return 'New';
        })() as any,
        priceSummary: {
          subtotal: dbOrder.subtotal,
          gst: dbOrder.gst_amount,
          gstRate: 0.05,
          deliveryFee: dbOrder.delivery_fee || 0,
          total: dbOrder.total,
        },
        lines: (dbOrder.order_items || []).map((dbItem: any) => ({
          itemId: dbItem.menu_item_id,
          label: dbItem.item_name || dbItem.menu_item_id || "Unknown Item",
          qty: dbItem.quantity,
          unitPriceAtOrder: dbItem.unit_price
        }))
      }));
      setOrders(mapped);
      
      const ids = new Set<string>();
      mapped.forEach(o => ids.add(o.id));
      knownOrderIds.current = ids;
    }
    setIsLoading(false);
    isFirstLoad.current = false;
  }, []);

  const fetchDeliveryData = useCallback(async () => {
    const { data: db } = await supabase.from('delivery_boys').select('*').order('name');
    if (db) setDeliveryBoys(db);
    const { data: da } = await supabase.from('delivery_assignments').select('*');
    if (da) setAssignments(da);
  }, []);

  const fetchInbox = useCallback(async () => {
    const { data } = await supabase.from('chef_threads').select('*').order('created_at', { ascending: true });
    if (data) setInboxRaw(data);
  }, []);

  const fetchForecastData = useCallback(async () => {
    const { data: subs } = await supabase.from('subscriptions').select('*').eq('status', 'active');
    if (subs) setActiveSubs(subs);
    const { data: swaps } = await supabase.from('subscription_swaps').select('*');
    if (swaps) setAllSwaps(swaps);
    const { data: items } = await supabase.from('menu_items').select('*');
    if (items) setAllMenuItems(items);
  }, []);

  // Set Status with full optimistic update
  const setStatus = useCallback(async (id: string, status: KitchenStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    let dbStatus = status.toLowerCase();
    if (status === 'New') dbStatus = 'pending';
    if (status === 'Out for delivery') dbStatus = 'out_for_delivery';
    const { error } = await supabase.from('orders').update({ status: dbStatus }).eq('id', id);
    if (error) {
      showToast("❌ Error updating status");
      fetchLiveOrders();
    }
  }, [fetchLiveOrders, showToast]);

  useEffect(() => {
    fetchLiveOrders();
    fetchDeliveryData();
    fetchInbox();
    fetchForecastData();
    const ordersChannel = supabase.channel('kitchen-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!isFirstLoad.current) {
          const newOrder = payload.new as any;
          if (newOrder.payment_status === 'pending') return; // Ignore unpaid checkout drafts

          knownOrderIds.current.add(newOrder.id);
          playBell();
          const isPickup = newOrder.delivery_details?.isPickup === true;
          const kind = newOrder.kind;
          const subTodayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const isTodaySub = (kind === 'personalized' || kind === 'subscription') && newOrder.delivery_date === subTodayStr;

          if (currentTabRef.current !== "orders" && kind === "regular" && !isPickup) setUnreadOrders(p => p + 1);
          if (currentTabRef.current !== "groups" && kind === "group") setUnreadGroups(p => p + 1);
          if (currentTabRef.current !== "pickup" && isPickup) setUnreadPickups(p => p + 1);
          if (currentTabRef.current !== "subscriptions" && isTodaySub) setUnreadSubs(p => p + 1);
        }
        fetchLiveOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as any;
        console.log("🔥 [REALTIME UPDATE] Order:", newOrder.id);
        console.log("   --> Payment Status:", newOrder.payment_status);
        console.log("   --> Already Known?", knownOrderIds.current.has(newOrder.id));

        // Trigger alerts when an abandoned checkout is verified by the Razorpay webhook
        // Supabase does not send `old.payment_status` without REPLICA IDENTITY FULL, so we use our local Set
        if (!isFirstLoad.current && newOrder.payment_status !== 'pending' && !knownOrderIds.current.has(newOrder.id)) {
          knownOrderIds.current.add(newOrder.id);
          playBell();
          
          const isPickup = newOrder.delivery_details?.isPickup === true;
          const kind = newOrder.kind;
          const subTodayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const isTodaySub = (kind === 'personalized' || kind === 'subscription') && newOrder.delivery_date === subTodayStr;

          if (currentTabRef.current !== "orders" && kind === "regular" && !isPickup) setUnreadOrders(p => p + 1);
          if (currentTabRef.current !== "groups" && kind === "group") setUnreadGroups(p => p + 1);
          if (currentTabRef.current !== "pickup" && isPickup) setUnreadPickups(p => p + 1);
          if (currentTabRef.current !== "subscriptions" && isTodaySub) setUnreadSubs(p => p + 1);
        }
        fetchLiveOrders();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (p) => {
        const deletedId = (p.old as any)?.id;
        if (deletedId) setOrders(prev => prev.filter(o => o.id !== deletedId));
      })
      .subscribe();

    const deliveryChannel = supabase.channel('kitchen-delivery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => fetchDeliveryData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_boys' }, () => fetchDeliveryData())
      .subscribe();

    const inboxChannel = supabase.channel('kitchen-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chef_threads' }, payload => {
        const newRow = payload.new;
        if (!isFirstLoad.current && newRow.sender_id !== user?.id) {
           playBell();
           const cid = newRow.customer_id;
           if (currentTabRef.current !== "inbox") {
             setUnreadMap(p => ({ ...p, [cid]: (p[cid] || 0) + 1 }));
           }
        }
        setInboxRaw(prev => prev.some(p => p.id === newRow.id) ? prev : [...prev, newRow as any]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chef_threads' }, payload => {
        const deletedId = payload.old.id;
        if (deletedId) setInboxRaw(prev => prev.filter(m => m.id !== deletedId));
        else fetchInbox(); // Fallback if old data is missing
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(deliveryChannel);
      supabase.removeChannel(inboxChannel);
    };
  }, [user?.id, fetchLiveOrders, fetchDeliveryData, fetchInbox]);

  return {
    orders,
    deliveryBoys,
    assignments,
    isLoading,
    fetchError,
    unreadCounts: { orders: unreadOrders, groups: unreadGroups, pickups: unreadPickups, subs: unreadSubs, inbox: Object.values(unreadMap).reduce((a,b)=>a+b, 0) },
    unreadMap,
    inboxRaw,
    activeSubs,
    allSwaps,
    allMenuItems,
    setStatus,
    fetchLiveOrders,
    fetchInbox,
    fetchForecastData,
    normalizeStatus: useCallback((s?: string) => {
      if (!s) return "new";
      let val = s.toLowerCase().trim();
      if (val === 'pending') return 'new';
      return val.replace(/\s+/g, '_');
    }, []),
    setMuted,
    muted,
    setTab: (t: string) => { 
      currentTabRef.current = t;
      if (t === "orders") setUnreadOrders(0);
      if (t === "groups") setUnreadGroups(0);
      if (t === "pickup") setUnreadPickups(0);
      if (t === "subscriptions") setUnreadSubs(0);
    },
    clearUnreadForChat: (cid: string) => setUnreadMap(prev => {
      const next = { ...prev };
      delete next[cid];
      return next;
    })
  };
}

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Sparkles, Settings, LogOut,
  Package, Star, TrendingUp, Shield, AlertTriangle,
  Clock, Zap,
  Bell, MapPin, Activity, ArrowRight,
  Calendar
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { useAppSetting } from "../hooks/useAppSettings";
import { supabase } from "../lib/supabase";
import type { AppUser, Route, OrderReceipt } from "../types";
import { ProfileForm } from "../components/profile/ProfileForm";
import { AddressManager } from "../components/profile/AddressManager";
import { OrderHistory } from "../components/profile/OrderHistory";
import { formatDateIndia } from "../lib/format";

type TabId = "profile" | "subscription" | "history" | "settings";

export function UserSettingsPage({
  user,
  setUser,
  setRoute,
  setRegularCart,
  showToast,
}: {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  setRoute: (r: Route) => void;
  setRegularCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  showToast: (msg: string) => void;
}) {
  const { value: rewardsEnabled } = useAppSetting("rewards_enabled", true);
  const { value: referralEnabled } = useAppSetting("referral_program_enabled", true);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [activeSub, setActiveSub] = useState<any>(null);
  const [isSubLoading, setIsSubLoading] = useState(true);
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Notification toggles
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifMacroReminder, setNotifMacroReminder] = useState(false);
  const [notifPromos, setNotifPromos] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) { setOrdersLoading(false); return; }
    setOrdersLoading(true);
    
    // Fetch orders and items (limit 25 for performance)
    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error || !dbOrders) { 
      console.error("[UserSettingsPage] Fetch orders error:", error);
      setOrdersLoading(false); 
      return; 
    }

    // Manual Join: Fetch menu items details for the orders shown
    const itemIds = new Set<string>();
    dbOrders.forEach(o => { 
      (o.order_items || []).forEach((i: any) => { 
        if (i.menu_item_id) itemIds.add(i.menu_item_id); 
      }); 
    });

    let menuItemsObj: Record<string, any> = {};
    if (itemIds.size > 0) {
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('id, name, calories, protein, image_url')
        .in('id', Array.from(itemIds));
      if (menuData) { 
        menuData.forEach(m => { menuItemsObj[m.id] = m; }); 
      }
    }

    setOrders(dbOrders.map(dbOrder => ({
      id: dbOrder.order_number,
      kind: dbOrder.kind as any,
      createdAt: new Date(dbOrder.created_at).getTime(),
      headline: dbOrder.kind,
      deliveryAtLabel: dbOrder.delivery_date,
      customer: dbOrder.delivery_details || { receiverName: '', receiverPhone: '' },
      payment: dbOrder.payment_status,
      status: dbOrder.status as any,
      priceSummary: { 
        subtotal: dbOrder.subtotal, 
        gst: dbOrder.gst_amount, 
        gstRate: 0.05, 
        deliveryFee: dbOrder.delivery_fee || 0, 
        total: dbOrder.total 
      },
      meta: dbOrder.meta || { durationDays: 30 },
      lines: (dbOrder.order_items || []).map((dbItem: any) => {
        const md = menuItemsObj[dbItem.menu_item_id];
        return {
          itemId: dbItem.menu_item_id,
          label: dbItem.item_name || md?.name || "Item",
          qty: dbItem.quantity,
          unitPriceAtOrder: dbItem.unit_price,
          calories: md?.calories,
          protein: md?.protein,
          image: md?.image_url
        };
      })
    })));
    setOrdersLoading(false);
  }, [user?.id]);

  const fetchActiveSub = useCallback(async () => {
    if (!user?.id) return;
    setIsSubLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) setActiveSub(data);
    setIsSubLoading(false);
  }, [user?.id]);

  useEffect(() => { 
    fetchOrders();
    fetchActiveSub();

    if (!user?.id) return;
    
    const channel = supabase
      .channel(`user_subscription_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchActiveSub();
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchOrders, fetchActiveSub]);

  // Active personalized subscription (the most recent one, regardless of status filter edge cases)
  const activePersonalizedOrder = useMemo(() => {
    const personalized = orders
      .filter(o => o.kind === "personalized" && !['cancelled', 'removed_by_admin'].includes(o.status as string))
      .sort((a, b) => b.createdAt - a.createdAt);
    return personalized[0] ?? null;
  }, [orders]);

  const subscriptionStatus = useMemo(() => {
    if (!user) return null;
    if (!activeSub) return null;
    
    const startDateStr = activeSub.start_date || activeSub.delivery_date;
    const duration = activeSub.duration_days || 30;
    
    const startTs = startDateStr ? new Date(startDateStr).getTime() : Date.now();
    const nowTs = new Date().setHours(0,0,0,0);
    const isNew = !startDateStr || (startTs > nowTs);
    
    if (isNew) {
      return { active: activeSub, daysLeft: duration, duration, progress: 0, isNew: true, deliveriesDone: 0 };
    }
    
    const daysPassed = Math.max(0, Math.floor((nowTs - startTs) / (1000 * 60 * 60 * 24)));
    const deliveriesDone = daysPassed + 1;
    const daysLeft = Math.max(0, duration - deliveriesDone);
    const progress = Math.min(100, Math.round((deliveriesDone / duration) * 100));
    
    return { active: activeSub, daysLeft, duration, progress, isNew, deliveriesDone };
  }, [user, activeSub]);

  if (!user) { setRoute("home"); return null; }

  const proPoints = orders.length * 15;
  const streak = (() => {
    const orderDays = new Set(orders.map(o => {
      const d = new Date(o.createdAt || 0);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (orderDays.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  const initials = (user.name || user.email || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "profile",      label: "Profile",       icon: User      },
    { id: "subscription", label: "My Plan",        icon: Sparkles  },
    { id: "history",      label: "Orders",         icon: Package   },
    { id: "settings",     label: "Settings",       icon: Settings  },
  ];

  const pct = subscriptionStatus?.progress || 0;
  const daysLeft = subscriptionStatus?.daysLeft ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 md:py-10">
      
      {/* Back button */}
      <div className="mb-6 px-2">
        <button 
          onClick={() => setRoute("home")} 
          className="text-sm font-semibold text-black/60 hover:text-black transition-colors flex items-center gap-1.5"
        >
          ← Back to Home
        </button>
      </div>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 md:p-8 mb-6">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-purple-600/10 blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-3xl font-black shadow-xl shadow-indigo-900/40">
              {initials}
            </div>
            {(user.isPro || subscriptionStatus) && (
              <div className="absolute -bottom-1.5 -right-1.5 bg-amber-400 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                PRO
              </div>
            )}
          </div>

          {/* Name + email */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{user.name || "Welcome!"}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{user.email}</p>
            {subscriptionStatus && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
                <Sparkles size={10} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  {activePersonalizedOrder ? (activePersonalizedOrder.meta?.plan || 'Pro Plan') : 'Pro Member'}
                </span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── TAB BAR ── */}
      <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1.5 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm shadow-slate-200"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <AnimatePresence mode="wait">

        {/* ─── PROFILE TAB ─── */}
        {activeTab === "profile" && (
          <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            {/* Active plan quick-card */}
            {subscriptionStatus && (
              <div className="rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <Sparkles size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Plan</div>
                      <div className="text-base font-black text-white">
                        {subscriptionStatus.isNew ? "Pro Membership" : `${daysLeft} days remaining`}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("subscription")} className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white transition-colors">
                    Manage <ArrowRight size={12} />
                  </button>
                </div>
                {!subscriptionStatus.isNew && (
                  <div className="px-4 py-3 bg-slate-50">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      <span>Progress</span><span className="text-slate-600">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-amber-400 rounded-full" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loyalty */}
            {rewardsEnabled && (
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center"><Star size={16} className="text-indigo-600" /></div>
                  <div>
                    <div className="text-sm font-black text-slate-900">Loyalty & Rewards</div>
                    <div className="text-xs text-slate-500">15 pts per order · redeem for meals</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Points",    value: proPoints,      color: "text-indigo-600" },
                    { label: "Streak",    value: `${streak}🔥`, color: "text-rose-500" },
                    { label: "Delivered", value: subscriptionStatus?.deliveriesDone || 0, color: "text-emerald-600" },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
                      <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mb-1.5 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Next Reward</span><span className="text-indigo-500">{proPoints}/500 pts</span>
                </div>
                <div className="h-2 bg-indigo-50 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (proPoints / 500) * 100)}%` }} className="h-full bg-indigo-500 rounded-full" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{Math.max(0, 500 - proPoints)} more pts to unlock a free meal 🎁</p>

                {referralEnabled && (
                  <div className="mt-4 bg-white rounded-xl border border-indigo-100 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Referral Code</div>
                      <div className="text-sm font-black text-slate-900 tracking-wider">
                        TFB-{user.name?.split(' ')[0]?.toUpperCase() || 'FIT'}-{(user.id || '1234').substring(0, 4).toUpperCase()}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 font-bold shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`TFB-${user.name?.split(' ')[0]?.toUpperCase() || 'FIT'}-${(user.id || '1234').substring(0, 4).toUpperCase()}`);
                        showToast("Referral code copied!");
                      }}>
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            )}

            <ProfileForm user={user} setUser={setUser} />
            <AddressManager user={user} setUser={setUser} />

            {/* Sign out (mobile visible always) */}
            <button
              onClick={async () => { if (window.confirm("Sign out?")) { await supabase.auth.signOut(); setUser(null); setRoute("home"); } }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 border border-rose-100 bg-white hover:bg-rose-50 shadow-sm transition-all"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </motion.div>
        )}

        {/* ─── MY PLAN TAB ─── */}
        {activeTab === "subscription" && (
          <motion.div key="subscription" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">

            {subscriptionStatus ? (
              <>
                {(() => {
                  const { daysLeft: dl, duration: dur, progress: subPct } = subscriptionStatus;
                  const proPointsValue = proPoints;
                  const streakValue = streak;

                  return (
                  <>
                    {/* 1. STATUS CARD (PREMIUM) */}
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 p-6 md:p-10 text-white shadow-2xl">
                      {/* Backdrop decoration */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 blur-[80px] translate-y-1/2 -translate-x-1/4 pointer-events-none" />

                      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        {/* Radial Progress */}
                        <div className="relative shrink-0">
                          <svg width="140" height="140" viewBox="0 0 140 140" className="w-[120px] h-[120px] md:w-[140px] md:h-[140px]">
                            <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                            <motion.circle
                              cx="70" cy="70" r="62" fill="none" stroke="#10b981"
                              strokeWidth="10"
                              strokeDasharray={`${2 * Math.PI * 62}`}
                              initial={{ strokeDashoffset: 2 * Math.PI * 62 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 62 * (1 - subPct / 100) }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              strokeLinecap="round" transform="rotate(-90 70 70)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl md:text-5xl font-black text-white">{dl}</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Days Left</span>
                          </div>
                        </div>

                        {/* Plan Info */}
                        <div className="flex-1 text-center md:text-left space-y-4">
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mx-auto md:mx-0",
                            activeSub.status === 'paused' 
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", activeSub.status === 'paused' ? "bg-amber-500" : "bg-emerald-500")} />
                            {activeSub.status}
                          </div>
                          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight">{activeSub.plan_name || "Personalized Plan"}</h2>
                          <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
                            Total {dur} days of fresh, nutritionist-planned meals delivered.
                          </p>
                          
                          <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 pt-2">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-500" />
                              <span className="text-xs md:text-sm font-bold text-slate-300">Started {formatDateIndia(activeSub.start_date || activeSub.delivery_date)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Zap size={16} className="text-slate-500" />
                              <span className="text-xs md:text-sm font-bold text-slate-300">{activeSub.meta?.mealsPerDay || 2} Meals / Day</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Completion", value: `${subPct}%`, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/5" },
                        { label: "Deliveries Done", value: subscriptionStatus.deliveriesDone, icon: Package, color: "text-sky-500", bg: "bg-sky-500/5" },
                        { label: "Pro Points", value: proPointsValue, icon: Star, color: "text-amber-500", bg: "bg-amber-500/5" },
                        { label: "Streak", value: `${streakValue}🔥`, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/5" },
                      ].map(stat => (
                        <div key={stat.label} className="bg-white border border-slate-100 rounded-[1.75rem] p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                            <stat.icon size={18} className={stat.color} />
                          </div>
                          <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* 3. SCHEDULE SNAPSHOT (NEXT 3 DAYS) */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/50">
                            <Calendar size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg md:text-xl font-black text-slate-900">Upcoming Schedule</h3>
                            <p className="text-xs text-slate-400 font-medium tracking-tight">Your next 3 days at a glance</p>
                          </div>
                        </div>
                        <button onClick={() => setRoute("dashboard")} className="hidden sm:flex text-[10px] font-black uppercase tracking-widest px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all items-center gap-2">
                          Go to Planner <ArrowRight size={12} />
                        </button>
                      </div>

                      <div className="grid gap-4">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const sched = activeSub.schedule || [];
                          // Get unique dates in the schedule which are >= today
                          const uniqueDates = Array.from(new Set(sched.map((s: any) => s.day)))
                            .filter((d: any) => d >= today)
                            .sort()
                            .slice(0, 3);

                          if (uniqueDates.length === 0) {
                            return (
                              <div className="py-10 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 w-full">
                                <p className="text-sm text-slate-400 font-medium">No deliveries scheduled in the next 3 days.</p>
                              </div>
                            );
                          }

                          return uniqueDates.map((dateStr: any) => {
                            const d = new Date(dateStr);
                            const key = dateStr;
                            const isToday = key === today;
                            const dayItems = sched.filter((s: any) => s.day === key);
                            const mealsCount = dayItems.length;
                            const labels = dayItems.map((s: any) => s.label).join(", ");

                            return (
                              <div key={key} className={cn(
                                "flex items-center gap-4 p-5 rounded-[2rem] border transition-all",
                                isToday ? "bg-slate-50 border-slate-200 shadow-inner" : "bg-white border-slate-100 hover:border-slate-300"
                              )}>
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex flex-col items-center justify-center shrink-0 shadow-sm">
                                  <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{d.toLocaleDateString("en-IN", { weekday: 'short' })}</span>
                                  <span className="text-xl font-black text-slate-900 leading-none">{d.getDate()}</span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{isToday ? "Next Delivery" : "Planned Delivery"}</div>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <div className="flex -space-x-2 shrink-0">
                                      {Array.from({ length: Math.min(3, mealsCount) }).map((_, i) => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm">
                                          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200" />
                                        </div>
                                      ))}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm md:text-base font-bold text-slate-900 leading-tight">
                                        {mealsCount} {mealsCount === 1 ? 'Meal' : 'Meals'} {isToday ? 'Today' : ''}
                                      </div>
                                      {labels && (
                                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                          {labels}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                                  <Zap size={10} className="text-amber-500" /> {activeSub.meta?.plan || "Pro"}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </>
                  );
                })()}

                {/* 4. MANAGEMENT ACTIONS - Removed as requested */}
              </>
            ) :
            isSubLoading ? (
              <div className="space-y-6 animate-pulse w-full">
                <div className="h-64 sm:h-80 bg-slate-200 rounded-[2.5rem] w-full shadow-sm" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="h-32 bg-slate-200 rounded-[1.75rem] w-full shadow-sm" />
                  <div className="h-32 bg-slate-200 rounded-[1.75rem] w-full shadow-sm" />
                  <div className="h-32 bg-slate-200 rounded-[1.75rem] w-full shadow-sm" />
                  <div className="h-32 bg-slate-200 rounded-[1.75rem] w-full shadow-sm" />
                </div>
              </div>
            ) : (
              /* No plan — upgrade card */
              <div className="rounded-[3rem] overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900 p-8 sm:p-12 text-white relative shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/5 blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                
                <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem] bg-amber-400/10 flex items-center justify-center text-amber-400 border border-amber-400/20 shadow-lg shadow-amber-900/20">
                    <Sparkles size={32} />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl md:text-6xl font-black tracking-tighter">Personalized Nutrition</h2>
                    <p className="text-slate-400 text-sm md:text-xl max-w-xl mx-auto leading-relaxed font-medium">
                      Fuel your goals with nutritionist-planned meals, advanced tracking, and priority service.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full max-w-3xl py-8">
                    {[
                      { icon: Activity, text: "Macro Analytics" },
                      { icon: Zap, text: "Priority Queuing" },
                      { icon: Clock, text: "Flexible Delivery" },
                      { icon: Star, text: "Exclusive Recipes" },
                      { icon: Shield, text: "Unlimited Holds" },
                      { icon: Activity, text: "Nutritionist Chat" }
                    ].map((f, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-[1.5rem] p-5 flex flex-col items-center gap-3 hover:bg-white/10 transition-colors group">
                        <f.icon size={20} className="text-amber-400 transition-transform group-hover:scale-110" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{f.text}</span>
                      </div>
                    ))}
                  </div>

                  <Button size="lg" onClick={() => setRoute("home")} className="h-16 md:h-20 px-8 md:px-14 bg-amber-400 text-slate-900 hover:bg-amber-300 font-black shadow-2xl shadow-amber-900/40 rounded-[2rem] text-sm md:text-xl transform hover:scale-105 transition-all">
                    Build My Custom Plan <ArrowRight size={24} className="ml-3" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── ORDERS TAB ─── */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <OrderHistory user={user} orders={orders} setRoute={setRoute} setRegularCart={setRegularCart} isLoading={ordersLoading} showToast={showToast} />
          </motion.div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {activeTab === "settings" && (
          <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            {/* Notifications */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center"><Bell size={16} className="text-sky-600" /></div>
                <div>
                  <div className="text-sm font-black text-slate-900">Notifications</div>
                  <div className="text-xs text-slate-400">Manage your alert preferences</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: "Order Updates",         desc: "When your food is being prepared.", value: notifOrderUpdates,  set: setNotifOrderUpdates },
                  { label: "Daily Macro Reminders", desc: "A nudge to log your meals.",         value: notifMacroReminder, set: setNotifMacroReminder },
                  { label: "Promos & Offers",       desc: "Be first to hear about deals.",       value: notifPromos,        set: setNotifPromos },
                ].map(n => (
                  <div key={n.label} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{n.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{n.desc}</div>
                    </div>
                    <button
                      onClick={() => n.set(!n.value)}
                      className={cn("w-11 h-6 rounded-full transition-all duration-300 flex items-center px-0.5 shrink-0", n.value ? "bg-slate-900 justify-end" : "bg-slate-200 justify-start")}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Account info */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Shield size={16} className="text-slate-600" /></div>
                <div>
                  <div className="text-sm font-black text-slate-900">Privacy & Security</div>
                  <div className="text-xs text-slate-400">Your account security settings</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: "Email",        value: user.email || "Not set",                      icon: MapPin    },
                  { label: "Phone",        value: user.phone || "Not set",                      icon: Activity  },
                  { label: "Account Type", value: (user.isPro || subscriptionStatus) ? "Pro Member" : "Standard", icon: Sparkles },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center"><row.icon size={13} className="text-slate-500" /></div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{row.label}</div>
                        <div className="text-sm font-bold text-slate-900">{row.value}</div>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab("profile")} className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">Edit →</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-rose-100">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center"><AlertTriangle size={16} className="text-rose-600" /></div>
                <div>
                  <div className="text-sm font-black text-rose-900">Danger Zone</div>
                  <div className="text-xs text-rose-400">Irreversible actions — be careful</div>
                </div>
              </div>
              <div className="divide-y divide-rose-100">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-black text-slate-900">Sign Out</div>
                    <div className="text-xs text-slate-400">Log out of your account on this device</div>
                  </div>
                  <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50 shrink-0"
                    onClick={async () => { if (window.confirm("Sign out?")) { await supabase.auth.signOut(); setUser(null); setRoute("home"); } }}>
                    <LogOut size={13} className="mr-1.5" /> Sign Out
                  </Button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-black text-slate-900">Delete Account</div>
                    <div className="text-xs text-slate-400">Permanently remove all your data</div>
                  </div>
                  <Button variant="outline" size="sm" className="border-rose-300 text-rose-700 hover:bg-rose-100 shrink-0"
                    onClick={() => showToast("Contact support@thefitbowls.com to delete your account.")}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Sparkles, Settings, LogOut,
  Package, Star, TrendingUp, Shield, AlertTriangle,
  Clock, Zap, Check,
  Bell, MapPin, Activity, ArrowRight, PlayCircle
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { useAppSetting } from "../hooks/useAppSettings";
import { supabase } from "../lib/supabase";
import type { AppUser, Route, OrderReceipt } from "../types";
import { ProfileForm } from "../components/profile/ProfileForm";
import { AddressManager } from "../components/profile/AddressManager";
import { OrderHistory } from "../components/profile/OrderHistory";
import { SubscriptionManagement } from "../components/profile/SubscriptionManagement";

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
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Notification toggles
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifMacroReminder, setNotifMacroReminder] = useState(false);
  const [notifPromos, setNotifPromos] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) { setOrdersLoading(false); return; }
    setOrdersLoading(true);
    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error || !dbOrders) { setOrdersLoading(false); return; }

    const itemIds = new Set<string>();
    dbOrders.forEach(o => { (o.order_items || []).forEach((i: any) => { if (i.menu_item_id) itemIds.add(i.menu_item_id); }); });

    let menuItemsObj: Record<string, any> = {};
    if (itemIds.size > 0) {
      const { data: menuData } = await supabase.from('menu_items').select('id, name, calories, protein').in('id', Array.from(itemIds));
      if (menuData) { menuData.forEach(m => { menuItemsObj[m.id] = m; }); }
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
      priceSummary: { subtotal: dbOrder.subtotal, gst: dbOrder.gst_amount, gstRate: 0.05, deliveryFee: dbOrder.delivery_fee || 0, total: dbOrder.total },
      meta: dbOrder.meta || { durationDays: 30 },
      lines: (dbOrder.order_items || []).map((dbItem: any) => {
        const md = menuItemsObj[dbItem.menu_item_id];
        return { itemId: dbItem.menu_item_id, label: dbItem.item_name || md?.name || "Item", qty: dbItem.quantity, unitPriceAtOrder: dbItem.unit_price, calories: md?.calories, protein: md?.protein };
      })
    })));
    setOrdersLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Active personalized subscription (the most recent one, regardless of status filter edge cases)
  const activePersonalizedOrder = useMemo(() => {
    const personalized = orders
      .filter(o => o.kind === "personalized" && !['cancelled', 'removed_by_admin'].includes(o.status as string))
      .sort((a, b) => b.createdAt - a.createdAt);
    return personalized[0] ?? null;
  }, [orders]);

  const subscriptionStatus = useMemo(() => {
    if (!user) return null;
    if (!activePersonalizedOrder) {
      return user.isPro ? { active: null, daysLeft: 30, duration: 30, deliveriesDone: 0, progress: 0, isNew: true } : null;
    }
    const daysPassed = Math.floor((Date.now() - activePersonalizedOrder.createdAt) / (1000 * 60 * 60 * 24));
    const duration = activePersonalizedOrder.meta?.durationDays || 30;
    const daysLeft = Math.max(0, duration - daysPassed);
    const deliveriesDone = orders.filter(o => o.status === "Delivered").length;
    return { active: activePersonalizedOrder, daysLeft, duration, deliveriesDone, progress: Math.min(100, Math.round((daysPassed / duration) * 100)), isNew: false };
  }, [user, activePersonalizedOrder, orders]);

  if (!user) { setRoute("home"); return null; }

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((s, o) => s + (o.priceSummary?.total || 0), 0);
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
  const duration = subscriptionStatus?.duration || 30;
  const meta = subscriptionStatus?.active?.meta;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 md:py-10">

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

          {/* Total spent */}
          {totalSpent > 0 && (
            <div className="hidden sm:block text-right shrink-0">
              <div className="text-2xl font-black">₹{totalSpent.toLocaleString("en-IN")}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Lifetime Spent</div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="relative z-10 mt-5 grid grid-cols-4 gap-2">
          {[
            { label: "Orders",    value: totalOrders,         color: "text-sky-400" },
            { label: "Points",    value: proPoints,           color: "text-amber-400" },
            { label: "Streak",    value: `${streak}🔥`,      color: "text-rose-400" },
            { label: "Days Left", value: daysLeft || "—",     color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
              <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</div>
            </div>
          ))}
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
              onClick={() => { if (window.confirm("Sign out?")) { setUser(null); setRoute("home"); } }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 border border-rose-100 bg-white hover:bg-rose-50 shadow-sm transition-all"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </motion.div>
        )}

        {/* ─── MY PLAN TAB ─── */}
        {activeTab === "subscription" && (
          <motion.div key="subscription" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            {/* Plan Hero Card */}
            {subscriptionStatus ? (
              <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-50 to-white border border-amber-100 shadow-sm">
                <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                  {/* Ring */}
                  <div className="relative shrink-0">
                    <svg width="110" height="110" viewBox="0 0 110 110">
                      <circle cx="55" cy="55" r="46" fill="none" stroke="#fef3c7" strokeWidth="9" />
                      <motion.circle
                        cx="55" cy="55" r="46" fill="none" stroke="#f59e0b"
                        strokeWidth="9"
                        strokeDasharray={`${2 * Math.PI * 46}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 46 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 46 * (1 - pct / 100) }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        strokeLinecap="round" transform="rotate(-90 55 55)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-amber-600">{daysLeft}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">days left</span>
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className={cn("inline-flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      subscriptionStatus.isNew ? "bg-sky-50 border-sky-200 text-sky-700" :
                      (activePersonalizedOrder?.status as string) === 'paused' ? "bg-amber-100 border-amber-200 text-amber-800" :
                      pct >= 100 ? "bg-slate-100 border-slate-200 text-slate-600" :
                      "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}>
                      <Sparkles size={10} />
                      {subscriptionStatus.isNew ? "New" : (activePersonalizedOrder?.status as string) === 'paused' ? "Paused" : pct >= 100 ? "Completed" : "Active"}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">{meta?.plan || `${duration}-Day Plan`}</h2>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2 text-xs text-slate-500 font-bold">
                      <span className="flex items-center gap-1"><Clock size={11} />{duration} days</span>
                      <span className="flex items-center gap-1"><Zap size={11} />{meta?.mealsPerDay || 2} meals/day</span>
                      <span className="flex items-center gap-1"><TrendingUp size={11} />Day {Math.min((duration - daysLeft) + 1, duration)} of {duration}</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        <span>Progress</span><span className="text-amber-600">{pct}% complete</span>
                      </div>
                      <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full bg-amber-400 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block text-right shrink-0">
                    <div className="text-2xl font-black text-slate-900">₹{totalSpent > 0 ? totalSpent.toLocaleString("en-IN") : "—"}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Lifetime Spent</div>
                  </div>
                </div>
              </div>
            ) : (
              /* No plan — upgrade card */
              <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900 p-8 text-white">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><Sparkles size={20} className="text-amber-400" /></div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">The Fit Bowls PRO</div>
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-3">Unlock Premium Nutrition</h2>
                <p className="text-slate-400 mb-6 max-w-md leading-relaxed">Advanced macro visualizers, priority kitchen queuing, and monthly health score reports.</p>
                <div className="grid gap-2.5 sm:grid-cols-2 mb-6">
                  {["Advanced Macro Analytics", "Priority Kitchen Queuing", "Monthly Health Report", "Exclusive Pro Recipes", "Unlimited Holds & Pauses", "Personal Nutri-Chat"].map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-sm font-semibold text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Check size={10} className="text-emerald-400" strokeWidth={3} /></div>
                      {f}
                    </div>
                  ))}
                </div>
                <Button size="lg" onClick={() => setRoute("home")} className="h-14 px-10 bg-amber-400 text-slate-900 hover:bg-amber-300 font-black shadow-xl">
                  Get a Personalized Plan <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            )}

            {/* Nutrition Journey sample chart */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><TrendingUp size={16} className="text-emerald-600" /></div>
                <div>
                  <div className="text-sm font-black text-slate-900">Nutrition Journey</div>
                  <div className="text-xs text-slate-400">Sample data — real tracking coming soon</div>
                </div>
              </div>
              <div className="flex items-end gap-2 h-20">
                {[65, 80, 45, 90, 70, 85, 60].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: `${h}%` }}
                      transition={{ delay: i * 0.07, duration: 0.5, ease: "easeOut" }}
                      className={cn("w-full rounded-t-lg", i === 6 ? "bg-emerald-400" : "bg-slate-100")}
                    />
                    <div className="text-[9px] text-slate-400 font-bold">{["M","T","W","T","F","S","S"][i]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-slate-300 font-bold text-center uppercase tracking-widest">Sample Data</div>
            </div>

            {/* Subscription management — pass prefetched order to avoid re-fetch mismatch */}
            <SubscriptionManagement
              user={user}
              onUpdate={fetchOrders}
              showToast={showToast}
              prefetchedOrder={activePersonalizedOrder}
            />

            {/* Go to dashboard button */}
            {subscriptionStatus && (
              <button
                onClick={() => setRoute("dashboard")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-black transition-all shadow-lg"
              >
                <PlayCircle size={16} /> Open Meal Dashboard
              </button>
            )}
          </motion.div>
        )}

        {/* ─── ORDERS TAB ─── */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Orders",  value: totalOrders,   color: "bg-sky-50 border-sky-100 text-sky-600" },
                { label: "Delivered",     value: subscriptionStatus?.deliveriesDone || 0, color: "bg-emerald-50 border-emerald-100 text-emerald-600" },
                { label: "Total Spent",   value: `₹${totalSpent > 0 ? (totalSpent / 1000).toFixed(1) + "k" : "0"}`, color: "bg-indigo-50 border-indigo-100 text-indigo-600" },
              ].map(s => (
                <div key={s.label} className={cn("rounded-2xl border p-4 text-center", s.color)}>
                  <div className="text-xl font-black">{s.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
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
                    onClick={() => { if (window.confirm("Sign out?")) { setUser(null); setRoute("home"); } }}>
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

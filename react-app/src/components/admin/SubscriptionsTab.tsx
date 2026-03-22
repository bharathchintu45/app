import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  UserPlus, 
  CalendarDays, 
  Search, 
  Plus, 
  Pause, 
  Play, 
  Archive, 
  X, 
  Trash2 
} from "lucide-react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { SkeletonTableRow } from "../ui/Skeleton";
import { formatDateIndia } from "../../lib/format";
import type { MenuItem } from "../../types";

interface SubscriptionsTabProps {
  showToast: (msg: string) => void;
  fetchOrders?: () => void;
}

export default function SubscriptionsTab({ showToast, fetchOrders }: SubscriptionsTabProps) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subFilterType, setSubFilterType] = useState<'all' | 'active' | 'expired'>('active');

  // Manual Sub State
  const [manualSubOpen, setManualSubOpen] = useState(false);
  const [msName, setMsName] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [msDuration, setMsDuration] = useState(30);
  const [msLoading, setMsLoading] = useState(false);

  // Future Order State
  const [futureOrderOpen, setFutureOrderOpen] = useState(false);
  const [foName, setFoName] = useState("");
  const [foEmail, setFoEmail] = useState("");
  const [foPhone, setFoPhone] = useState("");
  const [foAddress, setFoAddress] = useState("");
  const [foDate, setFoDate] = useState("");
  const [foNote, setFoNote] = useState("");
  const [foItems, setFoItems] = useState<{id: string; name: string; qty: number; price: number; category: string}[]>([]);
  const [foLoading, setFoLoading] = useState(false);

  const [parsedMenu, setParsedMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    fetchSubscriptions();
    fetchMenu();
  }, []);

  async function fetchSubscriptions() {
    setSubsLoading(true);
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSubscriptions(data);
    setSubsLoading(false);
  }

  async function fetchMenu() {
    const { data } = await supabase.from('menu_items').select('*').order('id');
    if (data) {
      setParsedMenu(data.map((d: any) => ({
        id: d.id, 
        category: d.category, 
        name: d.name, 
        description: d.description,
        image: d.image_url, 
        calories: d.calories, 
        protein: d.protein, 
        carbs: d.carbs,
        fat: d.fat, 
        fiber: d.fiber, 
        priceINR: d.price_inr, 
        available: d.available
      })) as MenuItem[]);
    }
  }

  async function addBonusDays(subId: string, currentDuration: number, currentEndDate: string, days: number) {
    if (days === 0) return;
    const newDuration = currentDuration + days;
    const endDate = new Date(currentEndDate);
    endDate.setDate(endDate.getDate() + days);
    const newEndDate = endDate.toISOString().slice(0, 10);

    const { error } = await api.v1.manageSubscriptions({
      action: 'add_days',
      subscriptionId: subId,
      data: { days, newDuration, newEndDate }
    });

    if (error) showToast("Error: " + error.message);
    else {
      showToast(`${days > 0 ? 'Added' : 'Removed'} ${Math.abs(days)} day(s) — plan now ends on ${newEndDate}`);
      fetchSubscriptions();
    }
  }

  async function deleteOrder(dbId: string) {
    if (!window.confirm("Are you sure you want to permanently remove this subscription?")) return;

    const { error } = await api.v1.manageSubscriptions({
      action: 'delete',
      subscriptionId: dbId
    });

    if (error) {
      showToast("Error removing subscription: " + error.message);
    } else {
      showToast("Subscription permanently removed.");
      fetchSubscriptions();
    }
  }

  async function handleManualSub(e: React.FormEvent) {
    e.preventDefault();
    if (!msName || !msEmail) { showToast("Please fill details"); return; }
    setMsLoading(true);
    
    const { data: profiles } = await supabase.from('profiles').select('id').eq('email', msEmail).maybeSingle();
    if (!profiles) {
      showToast("User profile not found. Make sure the user has an account.");
      setMsLoading(false);
      return;
    }

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', profiles.id)
      .in('status', ['active', 'ready', 'preparing', 'new'])
      .maybeSingle();

    if (existingSub) {
      showToast("This user already has an active subscription.");
      setMsLoading(false);
      return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + msDuration - 1);

    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    const scheduleLines = [
      { day: "Monday",    slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
      { day: "Tuesday",   slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
      { day: "Wednesday", slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
      { day: "Thursday",  slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
      { day: "Friday",    slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
      { day: "Saturday",  slot: "Lunch", itemId: null, label: "Lunch (Selection Pending)", qty: 1 },
    ];

    const { error } = await api.v1.manageSubscriptions({
      action: 'manual_add',
      data: {
        userId: profiles.id,
        name: msName,
        duration: msDuration,
        startDate: startStr,
        endDate: endStr,
        schedule: scheduleLines
      }
    });

    if (error) {
      showToast("Error: " + error.message);
    } else {
      showToast("Manual subscription created!");
      setManualSubOpen(false);
      fetchSubscriptions();
    }
    setMsLoading(false);
  }

  async function handleFutureOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!foName || !foEmail || !foDate) { showToast("Fill in name, email and delivery date."); return; }
    if (foItems.length === 0) { showToast("Add at least one menu item."); return; }
    setFoLoading(true);

    const { data: profile } = await supabase.from('profiles').select('id').eq('email', foEmail).maybeSingle();
    if (!profile) {
      showToast("User not found. They must have an account first.");
      setFoLoading(false);
      return;
    }

    const subtotal = foItems.reduce((s, i) => s + i.price * i.qty, 0);
    const gst = Math.round(subtotal * 0.05);
    const total = subtotal + gst;
    const orderNum = `FUT-${Math.floor(Math.random() * 90000) + 10000}`;

    const { error } = await supabase.from('orders').insert({
      order_number: orderNum,
      user_id: profile.id,
      customer_name: foName,
      status: 'pending',
      kind: 'regular',
      payment_status: 'paid',
      delivery_date: foDate,
      subtotal,
      gst_amount: gst,
      total,
      delivery_details: {
        receiverName: foName,
        receiverPhone: foPhone,
        building: foAddress,
        street: '',
        area: '',
      },
      meta: {
        is_future_order: true,
        admin_note: foNote || null,
        created_by_admin: true,
      },
    });

    if (error) { showToast("Error: " + error.message); setFoLoading(false); return; }

    const { data: newOrder } = await supabase.from('orders').select('id').eq('order_number', orderNum).maybeSingle();
    if (newOrder?.id) {
      await supabase.from('order_items').insert(
        foItems.map(i => ({ order_id: newOrder.id, menu_item_id: i.id, item_name: i.name, quantity: i.qty, unit_price: i.price }))
      );
    }

    showToast(`Future order ${orderNum} scheduled for ${foDate}!`);
    setFutureOrderOpen(false);
    setFoName(""); setFoEmail(""); setFoPhone(""); setFoAddress(""); setFoDate(""); setFoNote(""); setFoItems([]);
    fetchOrders?.(); // Refresh orders in parent if provided
    setFoLoading(false);
  }

  return (
    <motion.div key="subscriptions-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <Card className="border-emerald-100 shadow-xl shadow-emerald-900/5">
        <CardHeader className="bg-emerald-50/30 border-b border-emerald-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <SectionTitle icon={Users} title="Today's Deliveries" subtitle="Manage personalized member plans." />
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search..." 
                value={subSearchQuery}
                onChange={(e: any) => setSubSearchQuery(e.target.value)}
                className="pl-9 h-9 w-64 text-sm bg-white/50 border-emerald-100"
              />
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              {(['active', 'expired', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSubFilterType(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    subFilterType === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <Button size="sm" onClick={() => setManualSubOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1 h-9 rounded-xl">
              <UserPlus size={14} className="mr-1" /> Create Manual
            </Button>
            <Button size="sm" onClick={() => setFutureOrderOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-xs py-1 h-9 rounded-xl">
              <CalendarDays size={14} className="mr-1" /> Future Order
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid gap-4">
            {subsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} />)
            ) : (
              subscriptions
                .filter(sub => {
                  if (subFilterType === 'active') return sub.status === 'active';
                  if (subFilterType === 'expired') return sub.status !== 'active';
                  return true;
                })
                .filter(sub => {
                  if (!subSearchQuery) return true;
                  const q = subSearchQuery.toLowerCase();
                  const delivery = sub.delivery_details || {};
                  return (
                    (sub.customer_name || '').toLowerCase().includes(q) ||
                    (delivery.receiverName || '').toLowerCase().includes(q) ||
                    (delivery.receiverPhone || '').includes(q) ||
                    sub.id.toLowerCase().includes(q)
                  );
                })
                .map((sub) => {
                  const today = new Date();
                  const startDate = new Date(sub.start_date);
                  const daysPassed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / 86400000));
                  const daysLeft = Math.max(0, sub.duration_days - daysPassed);
                  const progress = Math.min(100, Math.round((daysPassed / sub.duration_days) * 100));
                  const delivery = sub.delivery_details || {};

                  return (
                    <div key={sub.id} className="flex flex-col lg:flex-row lg:items-center gap-6 p-6 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all group">
                      <div className="flex-1 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                          <Users size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-black text-slate-900">{sub.customer_name || delivery.receiverName || 'Unknown'}</div>
                          <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                            {delivery.receiverPhone} <span className="text-slate-200">•</span> {sub.plan_name}
                            {sub.status === 'paused' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black">PAUSED</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">{delivery.building} {delivery.street} {delivery.area}</div>
                          {sub.schedule?.length > 0 && (
                            <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Schedule:</p>
                              <div className="grid grid-cols-2 gap-1">
                                {sub.schedule.slice(0, 4).map((line: any, idx: number) => (
                                  <div key={idx} className="text-[10px] text-slate-600 truncate">• {line.day}: {line.label}</div>
                                ))}
                                {sub.schedule.length > 4 && <div className="text-[10px] text-slate-400">+{sub.schedule.length - 4} more...</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-8 px-8 border-x border-slate-50">
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Plan</div>
                          <div className="text-sm font-black text-slate-700">{sub.duration_days} Day Plan</div>
                          <div className="text-[9px] text-slate-400">{formatDateIndia(sub.start_date)} → {formatDateIndia(sub.end_date)}</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Progress</div>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${daysLeft > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {daysLeft > 0 ? `Day ${daysPassed + 1} / ${sub.duration_days}` : 'Ended'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 rounded-xl px-2 h-9 border border-slate-200">
                          <input type="number" defaultValue="7" id={`days-${sub.id}`} className="w-8 bg-transparent text-xs font-bold text-center focus:outline-none" />
                          <button onClick={() => {
                            const val = parseInt((document.getElementById(`days-${sub.id}`) as HTMLInputElement).value) || 0;
                            addBonusDays(sub.id, sub.duration_days, sub.end_date, val);
                          }} className="p-1 text-emerald-600 hover:bg-white rounded-lg transition-all"><Plus size={14} /></button>
                        </div>
                        <button onClick={async () => {
                          const newStatus = sub.status === 'paused' ? 'active' : 'paused';
                          const { error } = await api.v1.manageSubscriptions({
                            action: sub.status === 'paused' ? 'resume' : 'pause',
                            subscriptionId: sub.id
                          });
                          if (!error) { showToast(`Subscription ${newStatus === 'paused' ? 'paused' : 'resumed'}.`); fetchSubscriptions(); }
                          else showToast('Error: ' + error.message);
                        }} className={`p-2 rounded-lg transition-all ${sub.status === 'paused' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}>
                          {sub.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                        <button onClick={() => deleteOrder(sub.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Archive size={16} /></button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Sub Modal */}
      <AnimatePresence>
        {manualSubOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setManualSubOpen(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden">
              <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><UserPlus size={20} className="text-emerald-600"/> Manual Subscription</h2>
              <form onSubmit={handleManualSub} className="space-y-4">
                <Input value={msName} onChange={e => setMsName(e.target.value)} placeholder="Customer Name" required />
                <Input value={msEmail} onChange={e => setMsEmail(e.target.value)} placeholder="User Email" type="email" required />
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Duration (Days)</label>
                  <select value={msDuration} onChange={e => setMsDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                    <option value={7}>7 Days</option>
                    <option value={15}>15 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setManualSubOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={msLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700">{msLoading ? 'Creating...' : 'Create'}</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Future Order Modal */}
      <AnimatePresence>
        {futureOrderOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFutureOrderOpen(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-8 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><CalendarDays size={20} /></div>
                  <div><h2 className="text-xl font-black">Future Order</h2><p className="text-indigo-200 text-xs">Schedule a one-time order</p></div>
                </div>
                <button onClick={() => setFutureOrderOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"><X size={16} /></button>
              </div>
              <form onSubmit={handleFutureOrder} className="p-6 space-y-5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input value={foName} onChange={e => setFoName(e.target.value)} placeholder="Name *" required />
                  <Input value={foEmail} onChange={e => setFoEmail(e.target.value)} placeholder="Email *" type="email" required />
                  <Input value={foPhone} onChange={e => setFoPhone(e.target.value)} placeholder="Phone" />
                  <Input value={foAddress} onChange={e => setFoAddress(e.target.value)} placeholder="Address" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Delivery Date *</label>
                    <input type="date" value={foDate} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={e => setFoDate(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-400 outline-none" />
                  </div>
                  <Input value={foNote} onChange={e => setFoNote(e.target.value)} placeholder="Admin Note" />
                </div>
                
                <div className="bg-slate-50 rounded-2xl border border-slate-100 max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {parsedMenu.filter(m => m.available !== false).map(m => {
                    const existing = foItems.find(i => i.id === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white transition-colors">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="text-sm font-bold text-slate-900 truncate">{m.name}</div>
                          <div className="text-[10px] text-slate-400">{m.category} · ₹{m.priceINR || 0}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {existing ? (
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => setFoItems(prev => prev.map(pi => pi.id === m.id ? { ...pi, qty: Math.max(0, pi.qty - 1) } : pi).filter(pi => pi.qty > 0))} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">-</button>
                              <span className="text-sm font-black w-4 text-center">{existing.qty}</span>
                              <button type="button" onClick={() => setFoItems(prev => prev.map(pi => pi.id === m.id ? { ...pi, qty: pi.qty + 1 } : pi))} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">+</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setFoItems(prev => [...prev, { id: m.id, name: m.name, qty: 1, price: m.priceINR || 0, category: m.category }])} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Plus size={14}/></button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setFutureOrderOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={foLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">{foLoading ? 'Saving...' : 'Place Order'}</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

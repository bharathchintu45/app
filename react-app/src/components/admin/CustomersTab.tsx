import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  CalendarDays, 
  TrendingUp, 
  RefreshCw, 
  Search, 
  Package, 
  X, 
  Clock, 
  Sparkles 
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { Skeleton, SkeletonTableRow } from "../ui/Skeleton";
import { formatDateIndia } from "../../lib/format";
import { cn } from "../../lib/utils";

interface CustomersTabProps {
  showToast: (msg: string) => void;
}

export default function CustomersTab({ showToast }: CustomersTabProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "Champion" | "subscribers" | "At Risk">("all");
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    // Limit to customers active in the last 180 days to keep CRM snappy
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    
    const [profilesRes, ordersRes, subsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone_number, created_at, address, dietary_preferences'),
      supabase.from('orders')
        .select('id, total, kind, status, created_at, customer_name, delivery_details, order_items(item_name, quantity, unit_price)')
        .neq('status', 'cancelled')
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: false }),
      supabase.from('subscriptions')
        .select('id, status, customer_name, delivery_details, plan_name, start_date, end_date')
        .or(`status.eq.active,end_date.gte.${sixMonthsAgo}`)
    ]);

    if (profilesRes.error) {
       console.error("Profiles fetch error:", profilesRes.error);
    }

    const allProfiles = profilesRes.data || [];
    const allOrders = ordersRes.data || [];
    const allSubs = subsRes.data || [];
    const custMap = new Map<string, any>();
    const getPhone = (details: any) => details?.receiverPhone?.trim() || "No Phone";

    // Pre-populate with registered profiles
    allProfiles.forEach(p => {
      const phone = p.phone_number?.trim() && p.phone_number !== 'EMPTY' ? p.phone_number.trim() : `profile-${p.id}`;
      const name = p.full_name?.trim() && p.full_name !== 'EMPTY' ? p.full_name.trim() : "Unknown User";
      
      custMap.set(phone, {
        id: phone, name, phone: phone.startsWith('profile-') ? 'No Phone' : phone,
        address: p.address || 'Not Provided',
        dietaryPrep: p.dietary_preferences || 'Not Provided',
        healthCond: 'Not Provided',
        firstOrder: p.created_at || new Date().toISOString(), lastOrder: p.created_at || new Date().toISOString(),
        totalOrders: 0, totalSpent: 0, activeSub: false,
        orders: [], favorites: {}
      });
    });

    allOrders.forEach(o => {
      const phone = getPhone(o.delivery_details);
      const name = o.customer_name || o.delivery_details?.receiverName || "Unknown";
      const key = phone === "No Phone" ? name : phone;

      if (!custMap.has(key)) {
        custMap.set(key, { 
          id: key, name: name !== "Unknown" ? name : "Unknown User", phone, 
          address: 'Not Provided', dietaryPrep: 'Not Provided', healthCond: 'Not Provided',
          firstOrder: o.created_at, lastOrder: o.created_at, 
          totalOrders: 0, totalSpent: 0, activeSub: false, 
          orders: [], favorites: {}
        });
      }
      const c = custMap.get(key);
      c.totalOrders += 1;
      c.totalSpent += (o.total || 0);
      c.orders.push(o);
      if (o.created_at < c.firstOrder) c.firstOrder = o.created_at;
      if (o.created_at > c.lastOrder) c.lastOrder = o.created_at;

      // Track item frequencies
      if (o.order_items) {
        o.order_items.forEach((item: any) => {
          const itemName = item.item_name || 'Item';
          c.favorites[itemName] = (c.favorites[itemName] || 0) + item.quantity;
        });
      }
    });

    allSubs.forEach(s => {
      const phone = getPhone(s.delivery_details);
      const name = s.customer_name || s.delivery_details?.receiverName || "Unknown";
      const key = phone === "No Phone" ? name : phone;
      
      if (!custMap.has(key)) {
        custMap.set(key, { 
          id: key, name: name !== "Unknown" ? name : "Unknown User", phone, 
          address: 'Not Provided', dietaryPrep: 'Not Provided', healthCond: 'Not Provided',
          firstOrder: s.start_date || new Date().toISOString(), lastOrder: s.start_date || new Date().toISOString(), 
          totalOrders: 0, totalSpent: 0, activeSub: false, 
          orders: [], favorites: {}
        });
      }
      const c = custMap.get(key);
      if (s.status === 'active') c.activeSub = true;
      c.orders.push({ ...s, isSubRecord: true, created_at: s.start_date });
    });

    const now = new Date().getTime();
    const result = Array.from(custMap.values()).map(c => {
      const daysSinceLast = (now - new Date(c.lastOrder).getTime()) / (1000 * 3600 * 24);
      let segment = "New";
      
      // RFM Logic based on Indian Rupee typical amounts (assumed)
      if (c.totalOrders >= 5 && c.totalSpent >= 1500 && daysSinceLast <= 15) segment = "Champion";
      else if (c.totalOrders >= 3 && daysSinceLast <= 30) segment = "Loyal";
      else if (daysSinceLast > 30 && c.totalOrders > 1) segment = "At Risk";
      else if (c.totalOrders === 1) segment = "New";
      else segment = "Regular";

      // Sort favorites
      const topFavs = Object.entries(c.favorites).sort((a: any, b: any) => b[1] - a[1]).slice(0,3).map(f => f[0]);

      // Sort combined timeline
      c.orders.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { ...c, segment, daysSinceLast, topFavs };
    }).sort((a,b) => b.totalSpent - a.totalSpent); // Sort by Highest Spend by default

    setCustomers(result);
    setLoading(false);
  }

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalLTV = 0, activeSubsCount = 0, returningCount = 0;
    customers.forEach(c => {
      totalLTV += c.totalSpent;
      if (c.activeSub) activeSubsCount++;
      if (c.totalOrders > 1) returningCount++;
    });
    return {
      totalCusts: customers.length,
      avgLTV: customers.length ? totalLTV / customers.length : 0,
      activeSubs: activeSubsCount,
      returningRate: customers.length ? (returningCount / customers.length) * 100 : 0
    };
  }, [customers]);

  const filtered = customers.filter(c => {
    if (filter === "Champion" && c.segment !== "Champion") return false;
    if (filter === "At Risk" && c.segment !== "At Risk") return false;
    if (filter === "subscribers" && !c.activeSub) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
    }
    return true;
  });

  const segmentColor = (seg: string) => {
    if (seg === "Champion") return "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200";
    if (seg === "Loyal") return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (seg === "New") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (seg === "At Risk") return "bg-rose-100 text-rose-700 border-rose-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const exportCSV = () => {
    if (!customers.length) return showToast("No customers to export.");
    const headers = ["Name", "Phone", "Segment", "Total Orders", "Total Spent", "Last Order"];
    const rows = customers.map(c => [
      `"${c.name}"`, `"${c.phone}"`, c.segment, c.totalOrders, c.totalSpent, c.lastOrder.slice(0,10)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `TFB_Customers_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Audience", value: metrics.totalCusts.toLocaleString(), icon: Users, color: "text-indigo-600" },
          { label: "Active Subs", value: metrics.activeSubs.toLocaleString(), icon: CalendarDays, color: "text-emerald-600" },
          { label: "Avg LTV", value: `₹${Math.round(metrics.avgLTV).toLocaleString('en-IN')}`, icon: TrendingUp, color: "text-fuchsia-600" },
          { label: "Retention", value: `${metrics.returningRate.toFixed(1)}%`, icon: RefreshCw, color: "text-sky-600" },
        ].map((k, i) => (
          <Card key={i} className="rounded-3xl border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2 opacity-70">
                <k.icon size={16} className={k.color} />
                <span className="text-[10px] font-black uppercase tracking-widest">{k.label}</span>
              </div>
              <div className="text-3xl font-black text-slate-900">{loading ? <Skeleton className="h-8 w-16" /> : k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 px-8 pt-8">
          <SectionTitle icon={Users} title="CRM Directory" subtitle="Manage and segment your customer base." />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 transition-all text-xs font-bold" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as any)} className="h-10 text-xs font-bold bg-slate-50 border-none rounded-xl px-4 outline-none">
              <option value="all">All Audience</option>
              <option value="Champion">🏆 Champions Only</option>
              <option value="Loyal">⭐ Loyal</option>
              <option value="Regular">🔄 Regular</option>
              <option value="New">👋 Newcomers</option>
              <option value="At Risk">⚠️ At Risk</option>
              <option value="subscribers">📅 Active Subscribers</option>
            </select>
            <Button onClick={exportCSV} variant="outline" className="h-10 border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold px-4">
              <Package size={14} className="mr-2" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-4">Customer</th>
                  <th className="px-6 py-4">Segment</th>
                  <th className="px-6 py-4">Total Orders</th>
                  <th className="px-6 py-4">Lifetime Spent</th>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="p-4"><SkeletonTableRow /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-12 text-slate-400 font-bold">No customers match criteria.</td></tr>
                ) : (
                  filtered.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedProfile(c)}>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {c.name}
                              {c.activeSub && <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">Sub</span>}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">{c.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border", segmentColor(c.segment))}>
                          {c.segment}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">{c.totalOrders}</td>
                      <td className="px-6 py-4 font-black text-slate-900">₹{c.totalSpent.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-700">{formatDateIndia(c.lastOrder)}</div>
                        <div className="text-[10px] text-slate-400">{Math.floor(c.daysSinceLast)} days ago</div>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                             <Package size={14} /> {/* Placeholder for WhatsApp icon */}
                           </a>
                           <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={(e) => { e.stopPropagation(); setSelectedProfile(c); }}>View Profile</Button>
                         </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Slide-over Profile Drawer */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedProfile(null)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black">
                     {selectedProfile.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <div className="font-black text-slate-900 leading-none">{selectedProfile.name}</div>
                     <div className="text-xs text-slate-500 font-medium mt-1">{selectedProfile.phone}</div>
                   </div>
                </div>
                <button onClick={() => setSelectedProfile(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Segments & Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lifetime Spend</div>
                    <div className="text-xl font-black text-slate-900">₹{selectedProfile.totalSpent.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Orders</div>
                    <div className="text-xl font-black text-slate-900">{selectedProfile.totalOrders}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl col-span-2 flex items-center justify-between">
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current Segment</div>
                       <div className="text-sm font-bold text-slate-900">{selectedProfile.segment}</div>
                     </div>
                     <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border", segmentColor(selectedProfile.segment))}>
                        {selectedProfile.segment.toUpperCase()}
                     </span>
                  </div>
                </div>

                {/* Taste Profile */}
                {selectedProfile.topFavs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Sparkles size={14}/> Top Favorites</h3>
                    <div className="flex flex-wrap gap-2">
                       {selectedProfile.topFavs.map((fav: string) => (
                         <div key={fav} className="bg-amber-50 border border-amber-100 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-lg">
                           {fav}
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Clock size={14}/> Lifetime Timeline</h3>
                   <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                     {selectedProfile.orders.map((o: any, i: number) => {
                       const isExpanded = expandedOrderId === o.id;
                       return (
                       <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          </div>
                          <div 
                            onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            className={cn(
                              "w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:border-indigo-300",
                              isExpanded ? "border-indigo-500 shadow-md ring-1 ring-indigo-500" : "border-slate-100"
                            )}>
                             <div className="flex items-center justify-between mb-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{o.isSubRecord ? "Subscription" : "Order"} • {o.id.slice(0,6)}</span>
                               <span className="text-[10px] text-slate-400 font-bold">{formatDateIndia(o.created_at)}</span>
                             </div>
                             <div className="text-sm font-bold text-slate-900">
                                {o.isSubRecord ? o.plan_name : `Total: ₹${o.total}`}
                             </div>
                             
                             {/* Minimized View */}
                             {!isExpanded && !o.isSubRecord && <div className="text-xs text-slate-500 mt-1 truncate">{o.order_items?.map((it:any) => it.item_name).join(', ')}</div>}

                             {/* Expanded View */}
                             <AnimatePresence>
                               {isExpanded && (
                                 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                   <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                                     {o.isSubRecord ? (
                                       <>
                                         <div className="flex justify-between text-xs">
                                           <span className="text-slate-500">Status</span>
                                           <span className={cn("font-bold uppercase tracking-wider", o.status === 'active' ? "text-emerald-600" : "text-slate-600")}>{o.status}</span>
                                         </div>
                                         <div className="flex justify-between text-xs">
                                           <span className="text-slate-500">Duration</span>
                                           <span className="font-bold text-slate-700">{formatDateIndia(o.start_date)} - {formatDateIndia(o.end_date)}</span>
                                         </div>
                                       </>
                                     ) : (
                                       <>
                                         <div className="flex justify-between text-xs">
                                           <span className="text-slate-500">Status</span>
                                           <span className="font-bold uppercase tracking-wider text-slate-700">{o.status}</span>
                                         </div>
                                         <div className="space-y-1">
                                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items</span>
                                           {o.order_items?.map((it:any, idx:number) => (
                                             <div key={idx} className="flex justify-between text-xs text-slate-700">
                                               <span>{it.quantity}x {it.item_name}</span>
                                               <span className="font-bold">₹{it.unit_price * it.quantity}</span>
                                             </div>
                                           ))}
                                         </div>
                                       </>
                                     )}
                                   </div>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                          </div>
                       </div>
                     )})}
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

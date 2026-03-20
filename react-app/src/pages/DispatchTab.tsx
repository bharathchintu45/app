import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  Users, MapPin, Plus, Package, Zap, Sparkles
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SectionTitle } from "../components/ui/Typography";
import { Skeleton } from "../components/ui/Skeleton";
import { formatDateIndia } from "../lib/format";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useDelivery } from "../hooks/useDelivery";

export default function DispatchTab({ showToast }: { showToast: (msg: string) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<"assign" | "team">("assign");

  // Delivery State from Shared Hook
  const { deliveryBoys, assignments, loading: boysLoading, refetch } = useDelivery();

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    fetchDispatchQueue();

    // Subscribe to changes
    const channel = supabase.channel('dispatch-orders-only')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchDispatchQueue)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchDispatchQueue() {
    setOrdersLoading(true);
    // Fetch orders that are ready, pending, out_for_delivery, preparing
    const { data: qOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, status, delivery_details, created_at, kind')
      .in('status', ['pending', 'preparing', 'ready', 'out_for_delivery'])
      .order('created_at', { ascending: false });

    if (qOrders) setOrders(qOrders);
    setOrdersLoading(false);
  }

  async function autoAssignOrder(orderId: string): Promise<boolean> {
    // Find least-busy active delivery boy
    const activeBoys = deliveryBoys.filter(b => b.is_active);
    if (activeBoys.length === 0) { showToast("No active delivery partners available."); return false; }

    // Count active assignments per boy
    const loadMap: Record<string, number> = {};
    activeBoys.forEach(b => { loadMap[b.id] = 0; });
    assignments.forEach(a => {
      if (a.status !== 'delivered' && loadMap[a.delivery_boy_id] !== undefined) {
        loadMap[a.delivery_boy_id]++;
      }
    });

    // Pick boy with least assignments
    const bestBoy = activeBoys.reduce((prev, curr) =>
      (loadMap[curr.id] ?? 0) < (loadMap[prev.id] ?? 0) ? curr : prev
    );

    await assignOrder(orderId, bestBoy.id);
    showToast(`⚡ Auto-assigned to ${bestBoy.name}`);
    return true;
  }

  async function autoAssignAll() {
    const unassigned = orders.filter(o =>
      (o.status === 'ready' || o.status === 'preparing') &&
      !assignments.find(a => a.order_id === o.id)
    );
    if (unassigned.length === 0) { showToast("All orders already assigned."); return; }
    for (const o of unassigned) { await autoAssignOrder(o.id); }
    showToast(`⚡ ${unassigned.length} order(s) auto-assigned!`);
  }

  // Assign an order
  async function assignOrder(orderId: string, boyId: string) {
    if (!boyId) { showToast("Please select a delivery boy"); return; }
    
    // Check if already assigned
    const existing = assignments.find(a => a.order_id === orderId);
    if (existing) {
      // Update
      const { error } = await supabase.from('delivery_assignments')
        .update({ delivery_boy_id: boyId, status: 'assigned' })
        .eq('id', existing.id);
      if (error) showToast("Error updating assignment");
      else { showToast("Assignment updated!"); fetchDispatchQueue(); }
    } else {
      // Insert
      const { error } = await supabase.from('delivery_assignments').insert({
        order_id: orderId,
        delivery_boy_id: boyId,
        status: 'assigned'
      });
      if (error) showToast("Error assigning order");
      else { 
        showToast("Order assigned!"); 
        // Force order status to out_for_delivery/ready to sync.
        // Actually, trigger in DB should do it, but let's be safe.
        fetchDispatchQueue(); 
      }
    }
  }

  // ─── Sub-Components ───

  function AssignQueue() {
    const readyCount = orders.filter(o => o.status === 'ready').length;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-amber-900 tracking-tight">Pickup Queue</h2>
              <p className="text-amber-700/80 text-sm font-medium mt-1">
                {readyCount} order{readyCount !== 1 ? 's' : ''} waiting for pickup
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={autoAssignAll}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-600/20"
              >
                <Sparkles size={14} /> Auto-Assign All
              </button>
              <div className="flex -space-x-3">
                {deliveryBoys.slice(0, 5).map((b, i) => (
                  <div key={b.id} className="w-10 h-10 rounded-full bg-white border-2 border-amber-100 flex items-center justify-center shadow-sm text-xs font-black text-amber-600 relative z-10" style={{ zIndex: 10 - i }}>
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {deliveryBoys.length > 5 && (
                   <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-50 flex items-center justify-center shadow-sm text-[10px] font-black text-amber-900 z-0">
                     +{deliveryBoys.length - 5}
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 mt-6">
          {ordersLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : orders.filter(o => o.status === 'ready' || o.status === 'preparing' || o.status === 'out_for_delivery').map(order => {
            const assignment = assignments.find(a => a.order_id === order.id);
            const address = order.delivery_details?.building || 'Address not provided';
            
            return (
              <div key={order.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-amber-300 transition-colors">
                <div className="flex items-start gap-4 flex-1">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                    order.status === 'ready' ? "bg-amber-100/50 text-amber-600" : 
                    order.status === 'out_for_delivery' ? "bg-indigo-100/50 text-indigo-600" :
                    "bg-slate-100 text-slate-400"
                  )}>
                    <Package size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-black text-slate-900">{order.customer_name || 'Customer'}</span>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        #{order.order_number || order.id.slice(0,8)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 line-clamp-1">
                      <MapPin size={12} className="text-slate-400" />
                      {address}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                       <span className={cn(
                         "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                         order.status === 'ready' ? "bg-emerald-100 text-emerald-700" : 
                         order.status === 'preparing' ? "bg-amber-100 text-amber-700" :
                         order.status === 'out_for_delivery' ? "bg-indigo-100 text-indigo-700" :
                         "bg-slate-100 text-slate-600"
                       )}>
                         {order.status.replace("_", " ")}
                       </span>
                       <span className="text-[10px] text-slate-400 font-medium">{formatDateIndia(order.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Auto-assign lightning button */}
                  {!assignment && deliveryBoys.filter(b => b.is_active).length > 0 && (
                    <button
                      onClick={() => autoAssignOrder(order.id)}
                      title="Auto-assign to least busy partner"
                      className="w-10 h-10 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 flex items-center justify-center transition-all shrink-0 border border-amber-200"
                    >
                      <Zap size={16} />
                    </button>
                  )}
                  <div className="flex flex-col gap-1.5 w-48">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Assign To</label>
                    <select
                      value={assignment?.delivery_boy_id || ""}
                      onChange={(e) => assignOrder(order.id, e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    >
                      <option value="">Unassigned</option>
                      {deliveryBoys.map(b => (
                        <option key={b.id} value={b.id}>{b.name} {b.is_active ? '' : '(Offline)'}</option>
                      ))}
                    </select>
                  </div>
                  {assignment && (
                    <div className="w-36 flex flex-col justify-center bg-indigo-50 border border-indigo-100 p-2 rounded-xl text-center">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Assigned Courier</span>
                      <span className="text-xs font-bold text-indigo-700 truncate">{assignment.delivery_boys?.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!ordersLoading && orders.filter(o => o.status === 'ready' || o.status === 'preparing' || o.status === 'out_for_delivery').length === 0 && (
            <div className="py-20 text-center text-slate-400 italic font-medium">No orders in queue.</div>
          )}
        </div>
      </div>
    );
  }


  function TeamManager() {
    const [newBoyOpen, setNewBoyOpen] = useState(false);
    const [nbName, setNbName] = useState("");
    const [nbPhone, setNbPhone] = useState("");
    const [nbVehicle, setNbVehicle] = useState("Bike");
    const [nbReg, setNbReg] = useState("");
    const [nbProfileId, setNbProfileId] = useState("");
    const [saving, setSaving] = useState(false);
    const [deliveryProfiles, setDeliveryProfiles] = useState<any[]>([]);

    useEffect(() => {
      async function fetchProfiles() {
         const { data } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'delivery');
         if (data) setDeliveryProfiles(data);
      }
      fetchProfiles();
    }, []);

    async function handleAddBoy(e: any) {
      e.preventDefault();
      if (!nbName || !nbPhone) return showToast("Name and phone are required.");
      setSaving(true);
      const vehicleDesc = nbReg ? `${nbVehicle} - ${nbReg}` : nbVehicle;
      const { error } = await supabase.from('delivery_boys').insert({
        name: nbName, phone: nbPhone, vehicle: vehicleDesc, profile_id: nbProfileId || null
      });
      if (error) showToast("Error: " + error.message);
      else {
        showToast("Delivery Partner Added!");
        setNewBoyOpen(false); setNbName(""); setNbPhone(""); setNbReg(""); setNbProfileId("");
        refetch();
      }
      setSaving(false);
    }

    async function toggleActive(id: string, current: boolean) {
      const { error } = await supabase.from('delivery_boys').update({ is_active: !current }).eq('id', id);
      if (!error) refetch();
    }

    async function removeBoy(id: string) {
      if (!confirm("Remove this delivery partner?\n\nThis will also remove them from any associated past or present orders.")) return;
      
      setSaving(true);
      // Delete assignments first to prevent foreign key errors
      await supabase.from('delivery_assignments').delete().eq('delivery_boy_id', id);
      
      const { error } = await supabase.from('delivery_boys').delete().eq('id', id);
      if (error) showToast("Error: " + error.message);
      else { showToast("Partner removed"); refetch(); }
      setSaving(false);
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionTitle icon={Users} title="Delivery Partners" subtitle="Manage your fleet and assignments." />
          <Button onClick={() => setNewBoyOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <Plus size={16} className="mr-2" /> Add Partner
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boysLoading ? (
             <Skeleton className="h-32 rounded-2xl w-full" />
          ) : deliveryBoys.map(boy => (
             <div key={boy.id} className={cn("p-5 rounded-3xl border transition-all", boy.is_active ? "border-indigo-100 bg-white shadow-sm" : "border-slate-100 bg-slate-50 opacity-70")}>
               <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                     {boy.name.slice(0, 1).toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900">{boy.name}</h3>
                     <p className="text-xs text-slate-500">{boy.phone}</p>
                   </div>
                 </div>
                 <button onClick={() => toggleActive(boy.id, boy.is_active)} className={cn("w-10 h-6 flex items-center rounded-full p-1 transition-colors", boy.is_active ? "bg-emerald-500" : "bg-slate-300")}>
                   <div className={cn("w-4 h-4 rounded-full bg-white shadow transition-transform", boy.is_active ? "translate-x-4" : "translate-x-0")} />
                 </button>
               </div>
               <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Vehicle</span>
                    <span className="font-bold text-slate-800">{boy.vehicle}</span>
                  </div>
               </div>
               <div className="mt-4 flex justify-between items-center">
                 <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">
                   {assignments.filter(a => a.delivery_boy_id === boy.id && a.status === 'assigned').length} Active Deliveries
                 </div>
                 <button onClick={() => removeBoy(boy.id)} className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-1">Remove</button>
               </div>
             </div>
          ))}
          {deliveryBoys.length === 0 && !boysLoading && (
            <div className="col-span-full py-20 text-center text-slate-400 italic">No delivery partners added yet.</div>
          )}
        </div>

        <AnimatePresence>
          {newBoyOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setNewBoyOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><Plus size={20} className="text-indigo-600"/> Add Partner</h2>
                <form onSubmit={handleAddBoy} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Full Name</label>
                    <Input value={nbName} onChange={e => setNbName(e.target.value)} required placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Phone Number</label>
                    <Input value={nbPhone} onChange={e => setNbPhone(e.target.value)} required placeholder="10-digit number" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Vehicle Type</label>
                    <select value={nbVehicle} onChange={e => setNbVehicle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                      <option value="Bike">Bike</option>
                      <option value="Scooter">Scooter</option>
                      <option value="Car">Car</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Vehicle Reg. No (optional)</label>
                    <Input value={nbReg} onChange={e => setNbReg(e.target.value)} placeholder="e.g. MH 01 AB 1234" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Link to App Account (Optional)</label>
                    <select value={nbProfileId} onChange={e => setNbProfileId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                      <option value="">-- No Account --</option>
                      {deliveryProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email} ({p.email})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Select an account here so the partner can log into the Delivery Portal. Create accounts in the Staff tab first.</p>
                  </div>
                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setNewBoyOpen(false)} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Save</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200/50 shadow-inner">
        <button
          onClick={() => setActiveSubTab("assign")}
          className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeSubTab === "assign" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          Assign Orders
        </button>
        <button
          onClick={() => setActiveSubTab("team")}
          className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeSubTab === "team" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          Manage Team
        </button>
      </div>

      <AnimatePresence mode="wait">
         {activeSubTab === "assign" && (
           <motion.div key="assign" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <AssignQueue />
           </motion.div>
         )}
         {activeSubTab === "team" && (
           <motion.div key="team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <TeamManager />
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}

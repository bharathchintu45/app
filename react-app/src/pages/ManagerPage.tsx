import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity,
  Package, 
  Users, 
  Archive, 
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Bell,
  Search
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import type { AppUser } from "../types";

// Modular Tabs (Reusing Admin components but with Manager context)
import AllOrdersTab from "../components/admin/AllOrdersTab";
import CatalogTab from "../components/admin/CatalogTab";
import CustomersTab from "../components/admin/CustomersTab";
import StaffTab from "../components/admin/StaffTab";

type ManagerTab = "pulse" | "orders" | "stock" | "customers" | "staff";

interface ManagerPageProps {
  user: AppUser | null;
  onBack: () => void;
  showToast: (msg: string) => void;
}

export default function ManagerPage({ user, onBack, showToast }: ManagerPageProps) {
  const [activeTab, setActiveTab] = useState<ManagerTab>("pulse");
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    dispatched: 0
  });

  useEffect(() => {
    fetchStats();
    // Realtime listener for order stats
    const channel = supabase
      .channel('manager-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchStats)
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('orders')
      .select('status')
      .eq('delivery_date', today);
    
    if (data) {
      const s = { pending: 0, preparing: 0, ready: 0, dispatched: 0 };
      data.forEach((o: any) => {
        if (o.status === 'New') s.pending++;
        else if (o.status === 'Preparing') s.preparing++;
        else if (o.status === 'Ready') s.ready++;
        else if (o.status === 'Out for delivery') s.dispatched++;
      });
      setStats(s);
    }
  }

  const tabs: { id: ManagerTab; label: string; icon: any; color: string }[] = [
    { id: 'pulse', label: 'Pulse', icon: Activity, color: 'emerald' },
    { id: 'orders', label: 'Live Orders', icon: Package, color: 'amber' },
    { id: 'stock', label: 'Inventory', icon: Archive, color: 'sky' },
    { id: 'customers', label: 'CRM', icon: Users, color: 'violet' },
    { id: 'staff', label: 'Team', icon: ShieldCheck, color: 'slate' },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "pulse": return <PulseDashboard stats={stats} setActiveTab={setActiveTab} />;
      case "orders": return <AllOrdersTab showToast={showToast} />;
      case "stock": return <CatalogTab showToast={showToast} mode="stock" />;
      case "customers": return <CustomersTab showToast={showToast} />;
      case "staff": return <StaffTab showToast={showToast} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 lg:w-64 border-r border-slate-800 bg-[#0F1116] flex flex-col shrink-0 z-20">
          <div className="p-6 flex items-center gap-3">
            <div className="h-8 w-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <LayoutDashboard size={18} className="text-white" />
            </div>
            <span className="hidden lg:inline font-black tracking-tighter text-xl text-white">OPS<span className="text-emerald-500">HUB</span></span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group",
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  )}
                >
                  <Icon size={20} className={cn("shrink-0", isActive ? "text-emerald-400" : "group-hover:text-slate-200")} />
                  <span className="hidden lg:inline font-bold text-sm tracking-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div layoutId="active-indicator" className="ml-auto w-1 h-4 bg-emerald-500 rounded-full hidden lg:block" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={onBack}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all group"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="hidden lg:inline font-bold text-sm tracking-tight">Main Portal</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0A0C10]/50 backdrop-blur-3xl overflow-hidden">
          {/* Top Navbar */}
          <header className="h-16 border-b border-slate-800 bg-[#0F1116]/50 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">Live Workspace</h2>
              <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[10px] font-black uppercase text-emerald-500">Synced</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50">
                <Search size={14} className="text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Universal Search..." 
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-300 placeholder:text-slate-600 w-40"
                />
              </div>
              
              <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#0F1116]" />
              </button>

              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-emerald-500">
                {user?.name?.charAt(0) || "M"}
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-[1400px] mx-auto"
              >
                {renderActiveTab()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}

function PulseDashboard({ stats, setActiveTab }: { stats: any, setActiveTab: (t: ManagerTab) => void }) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter text-white">Operations Pulse</h1>
        <p className="text-slate-500 font-medium">Real-time throughput and system health diagnostic.</p>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Pending Dispatch" 
          value={stats.pending} 
          trend="+4 since last hour"
          color="amber"
          icon={Bell}
          onClick={() => setActiveTab("orders")}
        />
        <StatCard 
          label="In Kitchen" 
          value={stats.preparing} 
          trend="Target: <15m"
          color="emerald"
          icon={Activity}
          onClick={() => setActiveTab("orders")}
        />
        <StatCard 
          label="Ready To Go" 
          value={stats.ready} 
          trend="Assign riders now"
          color="sky"
          icon={Package}
          onClick={() => setActiveTab("orders")}
        />
        <StatCard 
          label="Dispatched" 
          value={stats.dispatched} 
          trend="12.5% increase"
          color="violet"
          icon={ChevronRight}
          onClick={() => setActiveTab("orders")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <Card className="lg:col-span-2 bg-[#0F1116] border-slate-800">
          <CardHeader>
            <h3 className="text-lg font-black text-white">Critical Flow</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {/* Simplified Order Flow View */}
               {[
                 { id: '101', customer: 'Rahul Sharma', items: '2 Meals', status: 'Late', time: '12m ago' },
                 { id: '102', customer: 'Sneha Kapur', items: '1 Meal + Addon', status: 'Optimal', time: '5m ago' },
                 { id: '103', customer: 'Amit Verma', items: 'Group Order (5)', status: 'High Priority', time: 'Just Now' },
               ].map((order, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 hover:border-emerald-500/30 transition-all group">
                   <div className="flex items-center gap-4">
                     <div className="h-10 w-10 bg-slate-800 rounded-xl flex items-center justify-center text-sm font-black text-slate-400 group-hover:text-emerald-400 transition-colors">
                       #{order.id}
                     </div>
                     <div>
                       <div className="font-bold text-slate-200">{order.customer}</div>
                       <div className="text-xs text-slate-500 font-medium">{order.items} • {order.time}</div>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className={cn(
                       "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                       order.status === 'Late' ? "bg-rose-500/10 text-rose-500" : 
                       order.status === 'Optimal' ? "bg-emerald-500/10 text-emerald-500" :
                       "bg-amber-500/10 text-amber-500"
                     )}>
                       {order.status}
                     </span>
                     <button className="p-2 text-slate-600 hover:text-white transition-colors">
                       <ChevronRight size={18} />
                     </button>
                   </div>
                 </div>
               ))}
               <Button variant="outline" className="w-full border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => setActiveTab("orders")}>
                 View All Live Orders
               </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <div className="space-y-6">
          <Card className="bg-[#0F1116] border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-lg font-black text-white">System Health</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-500 uppercase">Live</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <HealthGauge label="Kitchen Load" value={65} color="emerald" />
              <HealthGauge label="Rider Density" value={42} color="amber" />
              <HealthGauge label="Delivery TAT" value={88} color="sky" />
              
              <div className="pt-4 border-t border-slate-800/50">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-widest">
                  Generate Shift Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, color, icon: Icon, onClick }: any) {
  const colors: any = {
    emerald: "from-emerald-400/20 to-emerald-600/20 text-emerald-400 border-emerald-500/20",
    amber: "from-amber-400/20 to-amber-600/20 text-amber-400 border-amber-500/20",
    sky: "from-sky-400/20 to-sky-600/20 text-sky-400 border-sky-500/20",
    violet: "from-violet-400/20 to-violet-600/20 text-violet-400 border-violet-500/20"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "bg-gradient-to-br p-6 rounded-[2rem] border text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group",
        colors[color] || colors.emerald
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-white/5 rounded-xl">
          <Icon size={20} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Today</span>
      </div>
      <div className="text-4xl font-black tracking-tighter mb-1 text-white">{value}</div>
      <div className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-tight">{label}</div>
      <div className="mt-4 pt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest opacity-60">
        {trend}
      </div>
    </button>
  );
}

function HealthGauge({ label, value, color }: { label: string, value: number, color: string }) {
  const colorMap: any = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500"
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span>{label}</span>
        <span className={cn(color === 'emerald' ? 'text-emerald-500' : color === 'amber' ? 'text-amber-500' : 'text-sky-500')}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", colorMap[color])} 
        />
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  UtensilsCrossed, 
  Users, 
  Package, 
  Archive, 
  ShieldCheck, 
  Settings,
  BarChart3,
  CalendarDays,
  ArrowLeft
} from "lucide-react";
import { LuxuryLabel } from "../components/ui/Typography";
import { cn } from "../lib/utils";

// Import modular components
import StaffTab from "../components/admin/StaffTab";
import CustomersTab from "../components/admin/CustomersTab";
import AllOrdersTab from "../components/admin/AllOrdersTab";
import CatalogTab from "../components/admin/CatalogTab";
import SubscriptionsTab from "../components/admin/SubscriptionsTab";
import AnalyticsTab from "../components/admin/AnalyticsTab";
import SettingsTab from "../components/admin/SettingsTab";
import DispatchTab from "../components/admin/DispatchTab";

type AdminTab = "catalog" | "stock" | "subscriptions" | "all_orders" | "customers" | "staff" | "analytics" | "settings" | "dispatch";

interface AdminPageProps {
  user: any;
  onBack: () => void;
  showToast: (msg: string) => void;
}

export function AdminPage({ user, onBack, showToast }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("catalog");

  const tabs: { id: AdminTab; label: string; icon: any; color: string }[] = [
    { id: 'catalog', label: 'Catalog', icon: UtensilsCrossed, color: 'emerald' },
    { id: 'stock', label: 'Stock', icon: Archive, color: 'sky' },
    { id: 'subscriptions', label: 'Subscriptions', icon: Sparkles, color: 'amber' },
    { id: 'all_orders', label: 'Orders', icon: Package, color: 'indigo' },
    { id: 'dispatch', label: 'Dispatch', icon: CalendarDays, color: 'rose' },
    { id: 'customers', label: 'Customers', icon: Users, color: 'violet' },
    { id: 'staff', label: 'Staff', icon: ShieldCheck, color: 'slate' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'fuchsia' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'slate' },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "staff": return <StaffTab showToast={showToast} />;
      case "customers": return <CustomersTab showToast={showToast} />;
      case "all_orders": return <AllOrdersTab showToast={showToast} />;
      case "catalog": return <CatalogTab showToast={showToast} mode="catalog" />;
      case "stock": return <CatalogTab showToast={showToast} mode="stock" />;
      case "subscriptions": return <SubscriptionsTab showToast={showToast} />;
      case "analytics": return <AnalyticsTab showToast={showToast} />;
      case "settings": return <SettingsTab showToast={showToast} />;
      case "dispatch": return <DispatchTab showToast={showToast} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">

      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <button 
              onClick={onBack}
              className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-4 font-bold text-sm"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              Back to Portal
            </button>
            <LuxuryLabel text="Control Center" />
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 mt-2">Admin Dashboard</h1>
            <p className="text-slate-500 font-medium mt-2 max-w-md">Orchestrate the TFB ecosystem. Content, logistics, and user intelligence.</p>
            
            {/* User Greeting */}
            <div className="flex items-center gap-3 mt-6 p-3 bg-white/50 rounded-2xl border border-slate-100 w-fit">
              <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Logged in as</span>
                <span className="text-sm font-bold text-slate-700">{user?.name || 'Administrator'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 italic font-medium text-slate-400 text-sm px-6">
            <span>Server Status:</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-emerald-600 font-bold uppercase tracking-widest text-[10px]">Operational</span>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar Navigation */}
          <nav className="w-full lg:w-72 shrink-0 space-y-2 sticky top-8">
            <div className="p-4 mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Management</span>
            </div>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-[1.25rem] transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                      : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100"
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-tab-nav"
                      className="absolute inset-0 bg-slate-900 -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className={cn(
                    "p-2 rounded-xl transition-colors shrink-0",
                    isActive ? "bg-white/10" : "bg-slate-100 group-hover:bg-slate-200"
                  )}>
                    <Icon size={18} />
                  </div>
                  <span className="font-bold tracking-tight">{tab.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Main Content Area */}
          <main className="flex-grow w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 1.01 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {renderActiveTab()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

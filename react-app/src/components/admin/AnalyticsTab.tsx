import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  Users, 
  ChefHat, 
  Check, 
  ShieldCheck,
  Package,
  FileText,
  Zap
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { SectionTitle } from "../ui/Typography";
import { Skeleton } from "../ui/Skeleton";

interface AnalyticsTabProps {
  showToast: (msg: string) => void;
}

export default function AnalyticsTab({ showToast }: AnalyticsTabProps) {
  const [statsLoading, setStatsLoading] = useState(true);
  const [analyticsRange, setAnalyticsRange] = useState<"today" | "yesterday" | "this_week" | "last_week" | "30d" | "1m" | "6m" | "1y" | "custom">("30d");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });

  const [realStats, setRealStats] = useState<any>({
    totalRev: 0,
    previousRev: 0,
    activeSubs: 0,
    totalOrders: 0,
    previousOrders: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    thisWeekOrders: 0,
    lastWeekOrders: 0,
    filteredOrders: []
  });

  useEffect(() => {
    fetchRealStats();
  }, [analyticsRange, customRange]);

  async function fetchRealStats(silent = false) {
    if (!silent) setStatsLoading(true);
    const today = new Date();
    let currentPeriodStart = new Date(today);
    let currentPeriodEnd = new Date(today);
    currentPeriodEnd.setHours(23, 59, 59, 999);

    if (analyticsRange === "today") currentPeriodStart.setHours(0, 0, 0, 0);
    else if (analyticsRange === "yesterday") {
      currentPeriodStart.setDate(today.getDate() - 1);
      currentPeriodStart.setHours(0, 0, 0, 0);
      currentPeriodEnd = new Date(currentPeriodStart);
      currentPeriodEnd.setHours(23, 59, 59, 999);
    } else if (analyticsRange === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      currentPeriodStart.setDate(diff);
      currentPeriodStart.setHours(0, 0, 0, 0);
    } else if (analyticsRange === "last_week") {
      const day = today.getDay();
      const diff = today.getDate() - day - 6 + (day === 0 ? -6 : 1);
      currentPeriodStart.setDate(diff);
      currentPeriodStart.setHours(0, 0, 0, 0);
      currentPeriodEnd.setDate(diff + 6);
      currentPeriodEnd.setHours(23, 59, 59, 999);
    } else if (analyticsRange === "30d") currentPeriodStart.setDate(today.getDate() - 30);
    else if (analyticsRange === "1m") currentPeriodStart.setMonth(today.getMonth() - 1);
    else if (analyticsRange === "6m") currentPeriodStart.setMonth(today.getMonth() - 6);
    else if (analyticsRange === "1y") currentPeriodStart.setFullYear(today.getFullYear() - 1);
    else if (analyticsRange === "custom") {
      currentPeriodStart = new Date(customRange.start);
      currentPeriodEnd = new Date(customRange.end);
      currentPeriodEnd.setHours(23, 59, 59, 999);
    }

    const currentPeriodStartStr = currentPeriodStart.toISOString();
    let previousPeriodStart = new Date(currentPeriodStart);
    let previousPeriodEnd = new Date(currentPeriodStart);
    
    if (analyticsRange === "today") {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodEnd.setHours(0, 0, 0, 0);
      previousPeriodEnd.setDate(currentPeriodStart.getDate());
    } else if (analyticsRange === "yesterday") {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else if (analyticsRange === "this_week") {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else if (analyticsRange === "last_week") {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else if (analyticsRange === "custom") {
      const diff = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
      previousPeriodStart = new Date(currentPeriodStart.getTime() - diff);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else {
      if (analyticsRange === "30d") previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);
      else if (analyticsRange === "1m") previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      else if (analyticsRange === "6m") previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 6);
      else if (analyticsRange === "1y") previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
      previousPeriodEnd = new Date(currentPeriodStart);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fetchStartStr = (new Date(Math.min(previousPeriodStart.getTime(), thirtyDaysAgo.getTime()))).toISOString();

    const { data: orderData } = await supabase
      .from('orders')
      .select('id, order_number, total, kind, payment_status, status, created_at, customer_name, delivery_date, delivery_details, meta, order_items(item_name, quantity, unit_price)')
      .neq('status', 'cancelled')
      .neq('payment_status', 'pending')
      .neq('payment_status', 'failed')
      .gte('created_at', fetchStartStr)
      .lte('created_at', analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString())
      .order('created_at', { ascending: false });

    const { data: subRevData } = await supabase
      .from('subscriptions')
      .select('id, total, plan_name, status, payment_status, created_at, customer_name, delivery_details, meta')
      .eq('payment_status', 'paid')
      .gte('created_at', fetchStartStr)
      .lte('created_at', analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString());

    const { data: swapData } = await supabase
      .from('subscription_swaps')
      .select('created_at, meta')
      .gte('created_at', fetchStartStr)
      .lte('created_at', analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString());

    if (orderData) {
      const data = orderData; // Keep reference for existing code
      const currentOrders = data.filter(o => o.created_at >= currentPeriodStartStr && o.created_at <= (analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString()));
      const previousOrdersList = data.filter(o => o.created_at >= previousPeriodStart.toISOString() && o.created_at < currentPeriodStartStr);
      
      // Merge Subscriptions into revenue calculation
      const currentSubs = (subRevData || []).filter(s => s.created_at >= currentPeriodStartStr && s.created_at <= (analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString()));
      const previousSubs = (subRevData || []).filter(s => s.created_at >= previousPeriodStart.toISOString() && s.created_at < currentPeriodStartStr);

      const currentSwaps = (swapData || []).filter(s => s.created_at >= currentPeriodStartStr && s.created_at <= (analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString()));
      const previousSwaps = (swapData || []).filter(s => s.created_at >= previousPeriodStart.toISOString() && s.created_at < currentPeriodStartStr);

      const calculateOrderSum = (o: any) => o.total || (o.order_items?.reduce((s: number, i: any) => s + (i.unit_price * i.quantity), 0) || 0);
      const calculateSwapRev = (list: any[]) => list.reduce((sum, s) => sum + (s.meta?.price_diff || 0), 0);

      const orderRev = currentOrders.reduce((sum, o) => sum + calculateOrderSum(o), 0);
      const subPurchaseRev = currentSubs.reduce((sum, s) => sum + (s.total || 0), 0);
      const swapRev = calculateSwapRev(currentSwaps);
      const totalRev = orderRev + subPurchaseRev + swapRev;

      const prevOrderRev = previousOrdersList.reduce((sum, o) => sum + calculateOrderSum(o), 0);
      const prevSubRev = previousSubs.reduce((sum, s) => sum + (s.total || 0), 0);
      const prevSwapRev = calculateSwapRev(previousSwaps);
      const previousRev = prevOrderRev + prevSubRev + prevSwapRev;

      const activeSubs = currentOrders.filter(o => o.kind === 'personalized' && o.status !== 'delivered').length;
      const totalOrders = currentOrders.length + currentSubs.length; 
      const previousOrdersCount = previousOrdersList.length + previousSubs.length; 



      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const yestStart = new Date(); yestStart.setDate(today.getDate() - 1); yestStart.setHours(0,0,0,0);
      const yestEnd = new Date(); yestEnd.setDate(today.getDate() - 1); yestEnd.setHours(23,59,59,999);
      
      const day = today.getDay();
      const thisWeekStart = new Date();
      thisWeekStart.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
      thisWeekStart.setHours(0,0,0,0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);

      const todayOrders = data.filter(o => o.created_at >= todayStart.toISOString()).length;
      const yesterdayOrders = data.filter(o => o.created_at >= yestStart.toISOString() && o.created_at <= yestEnd.toISOString()).length;
      const thisWeekOrders = data.filter(o => o.created_at >= thisWeekStart.toISOString()).length;
      const lastWeekOrders = data.filter(o => o.created_at >= lastWeekStart.toISOString() && o.created_at <= lastWeekEnd.toISOString()).length;
      
      setRealStats({ 
        totalRev, previousRev, activeSubs, totalOrders, previousOrders: previousOrdersCount,
        todayOrders, yesterdayOrders, thisWeekOrders, lastWeekOrders, filteredOrders: currentOrders,
        filteredSubs: currentSubs,
        swapRev 
      });
    }
    setStatsLoading(false);
  }

  const stats = useMemo(() => {
    const { totalRev, previousRev, totalOrders, previousOrders, filteredOrders } = realStats;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
    const revenueGrowth = previousRev > 0 ? ((totalRev - previousRev) / previousRev) * 100 : 0;
    const orderGrowth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
    const taxCollected = Math.round(totalRev * 0.05);

    const catCounts: Record<string, number> = {};
    const itemCounts: Record<string, { qty: number; revenue: number; uniqueCustomers: Set<string> }> = {};
    const dailyVelocity: Record<string, { date: string; regular: number; subscription: number; group: number }> = {};
    const cityCounts: Record<string, number> = {};
    const customerStats: Record<string, { orders: number; revenue: number; firstOrder: string }> = {};
    const subPlanDistribution: Record<string, number> = {};
    const monthlyRevMap: Record<string, number> = { 'Jan':0,'Feb':0,'Mar':0,'Apr':0,'May':0,'Jun':0,'Jul':0,'Aug':0,'Sep':0,'Oct':0,'Nov':0,'Dec':0 };
    const hourlyDistribution: Record<number, number> = {};
    // Initialize hourly map (0-23)
    for (let i=0; i<24; i++) hourlyDistribution[i] = 0;

    let deliveryTimeSum = 0;
    let deliveryTimeCount = 0;

    filteredOrders.forEach((o: any) => {
      const orderTotal = o.total || (o.order_items?.reduce((s: number, i: any) => s + (i.unit_price * i.quantity), 0) || 0);
      
      // Hourly distribution
      const orderHour = new Date(o.created_at).getHours();
      hourlyDistribution[orderHour] = (hourlyDistribution[orderHour] || 0) + 1;

      // Delivery precision
      if (o.meta?.delivered_at_iso) {
        const start = new Date(o.created_at).getTime();
        const end = new Date(o.meta.delivered_at_iso).getTime();
        const diffMin = (end - start) / (1000 * 60);
        if (diffMin > 0 && diffMin < 1440) { // Limit to 24h to avoid extreme outliers
          deliveryTimeSum += diffMin;
          deliveryTimeCount++;
        }
      }

      const city = o.delivery_details?.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + orderTotal;

      const cName = o.customer_name || 'Guest';
      if (!customerStats[cName]) customerStats[cName] = { orders: 0, revenue: 0, firstOrder: o.created_at };
      customerStats[cName].orders++;
      customerStats[cName].revenue += orderTotal;
      if (o.created_at < customerStats[cName].firstOrder) customerStats[cName].firstOrder = o.created_at;

      (o.order_items || []).forEach((item: any) => {
        const name = item.item_name || 'Unknown Item';
        if (!itemCounts[name]) itemCounts[name] = { qty: 0, revenue: 0, uniqueCustomers: new Set() };
        itemCounts[name].qty += (item.quantity || 1);
        itemCounts[name].revenue += (item.unit_price || 0) * (item.quantity || 1);
        if (o.customer_name) itemCounts[name].uniqueCustomers.add(o.customer_name);
      });

      const dStr = new Date(o.created_at).toISOString().slice(5, 10);
      if (!dailyVelocity[dStr]) dailyVelocity[dStr] = { date: dStr, regular: 0, subscription: 0, group: 0 };
      if (o.kind === 'regular') dailyVelocity[dStr].regular += orderTotal;
      else if (o.kind === 'personalized') dailyVelocity[dStr].subscription += orderTotal;
      else if (o.kind === 'group') dailyVelocity[dStr].group += orderTotal;

      const d = new Date(o.created_at);
      const mStr = d.toLocaleString('en-US', { month: 'short' });
      if (monthlyRevMap[mStr] !== undefined) monthlyRevMap[mStr] += orderTotal;
    });

    // Add subscription purchases to velocity and monthly maps
    realStats.filteredSubs?.forEach((s: any) => {
      const dStr = new Date(s.created_at).toISOString().slice(5, 10);
      if (!dailyVelocity[dStr]) dailyVelocity[dStr] = { date: dStr, regular: 0, subscription: 0, group: 0 };
      dailyVelocity[dStr].subscription += (s.total || 0);

      const d = new Date(s.created_at);
      const mStr = d.toLocaleString('en-US', { month: 'short' });
      if (monthlyRevMap[mStr] !== undefined) monthlyRevMap[mStr] += (s.total || 0);
    });

    const avgDeliveryTime = deliveryTimeCount > 0 ? Math.round(deliveryTimeSum / deliveryTimeCount) : 0;
    
    const totalCustomers = Object.keys(customerStats).length;
    const repeatCustomers = Object.values(customerStats).filter(c => c.orders > 1).length;
    const retentionRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    return { 
      totalRev, previousRev, avgOrderValue, revenueGrowth, orderGrowth, taxCollected,
      activeSubs: realStats.activeSubs, totalOrders,
      avgDeliveryTime, 
      retentionRate,
      retentionData: [
        { name: 'Repeat', value: repeatCustomers },
        { name: 'New', value: totalCustomers - repeatCustomers }
      ],
      hourlyData: Object.entries(hourlyDistribution).map(([hour, count]) => ({ 
        hour: `${hour}:00`, 
        orders: count 
      })),
      topCats: Object.entries(catCounts).sort((a,b) => b[1] - a[1]),
      topItems: Object.entries(itemCounts).map(([name, data]) => ({ name, ...data, uniqueCustCount: data.uniqueCustomers.size })).sort((a,b) => b.revenue - a.revenue).slice(0, 10),
      topCustomers: Object.entries(customerStats).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.revenue - a.revenue).slice(0, 10),
      subDist: Object.entries(subPlanDistribution).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      monthlyRev: Object.entries(monthlyRevMap).map(([name, total]) => ({ name, total })),
      geoData: Object.entries(cityCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
      velocityData: Object.values(dailyVelocity).sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [realStats]);

  function downloadCSV() {
    if (realStats.filteredOrders.length === 0) { showToast("No data available to download."); return; }
    const headers = ["Order ID", "Customer", "Phone", "Address", "Date", "Amount", "Kind", "Status", "Items"];
    const rows = realStats.filteredOrders.map((o: any) => {
      const details = o.delivery_details || {};
      const address = [details.building, details.street, details.area].filter(Boolean).join(" ");
      const items = (o.order_items || []).map((i: any) => `${i.item_name} (x${i.quantity})`).join(" | ");
      return [ o.order_number || o.id, o.customer_name || "Unknown", details.receiverPhone || "-", `"${address.replace(/"/g, '""')}"`, new Date(o.created_at).toLocaleDateString("en-IN"), o.total, o.kind, o.status, `"${items.replace(/"/g, '""')}"` ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFB_Sales_Report_${analyticsRange}.csv`;
    link.click();
  }

  function downloadFinanceReport() {
    if (realStats.filteredOrders.length === 0) { showToast("No data available."); return; }
    const { totalRev, taxCollected } = stats;
    const netRev = totalRev - taxCollected;
    let csvContent = `TFB FINANCIAL REPORT\nGenerated On,${new Date().toLocaleDateString("en-IN")}\nGross Revenue,${totalRev}\nTax collected,${taxCollected}\nNet Revenue,${netRev}\n\n`;
    csvContent += "Date,Order ID,Customer,Amount,Type\n";
    realStats.filteredOrders.forEach((o: any) => {
      csvContent += `${new Date(o.created_at).toLocaleDateString("en-IN")},${o.order_number || o.id},"${o.customer_name}",${o.total},${o.kind}\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFB_Finance_Report_${analyticsRange}.csv`;
    link.click();
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "yesterday", "this_week", "30d", "1y", "custom"] as const).map(r => (
            <button key={r} onClick={() => setAnalyticsRange(r)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${analyticsRange === r ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>{r}</button>
          ))}
          {analyticsRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1" />
              <span className="text-slate-300 text-xs">to</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSV} className="text-xs h-9 rounded-xl"><Package size={14} className="mr-1.5"/> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={downloadFinanceReport} className="text-xs h-9 rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50"><FileText size={14} className="mr-1.5"/> Finance PDF</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><BarChart3 size={24} className="text-indigo-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Revenue</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div>
                <div className="text-3xl font-black text-slate-900">₹{stats.totalRev.toLocaleString('en-IN')}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`text-xs font-bold flex items-center gap-1 ${stats.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.revenueGrowth >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {Math.abs(Math.round(stats.revenueGrowth))}%
                  </div>
                  {realStats.swapRev > 0 && (
                    <div className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 flex items-center gap-1">
                      <Zap size={10} fill="currentColor" /> ₹{realStats.swapRev} Upgrades
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><Package size={24} className="text-emerald-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Orders</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div><div className="text-3xl font-black text-slate-900">{stats.totalOrders}</div><div className={`mt-2 text-xs font-bold flex items-center gap-1 ${stats.orderGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{stats.orderGrowth >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {Math.abs(Math.round(stats.orderGrowth))}% vs prev</div></div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><Users size={24} className="text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retention</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div><div className="text-3xl font-black text-slate-900">{stats.retentionRate}%</div><div className="mt-2 text-xs font-bold text-slate-400">Repeat customers</div></div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><Clock size={24} className="text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Delivery</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div><div className="text-3xl font-black text-slate-900">{stats.avgDeliveryTime}m</div><div className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1.5">Order to handover</div></div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><FileText size={24} className="text-slate-400" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Order</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div><div className="text-3xl font-black text-slate-900">₹{stats.avgOrderValue}</div><div className="mt-2 text-xs font-bold text-slate-400">Per transaction</div></div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4"><ShieldCheck size={24} className="text-slate-300" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Est.</span></div>
            {statsLoading ? <Skeleton className="h-10 w-24" /> : (
              <div><div className="text-3xl font-black text-slate-600">₹{stats.taxCollected.toLocaleString('en-IN')}</div><div className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1.5"><Check size={14} className="text-emerald-400" /> 5% GST incl.</div></div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Visualizations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-[2.5rem] shadow-sm border-slate-100">
          <CardHeader className="p-8 pb-0"><SectionTitle icon={TrendingUp} title="Revenue Velocity" subtitle="Daily revenue trends by order type." /></CardHeader>
          <CardContent className="p-8"><div className="h-[350px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.velocityData}><defs><linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient><linearGradient id="colorSub" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v}`} /><Tooltip /><Area type="monotone" name="Regular" dataKey="regular" stackId="1" stroke="#6366f1" strokeWidth={3} fill="url(#colorReg)" /><Area type="monotone" name="Subscription" dataKey="subscription" stackId="1" stroke="#10b981" strokeWidth={3} fill="url(#colorSub)" /><Area type="monotone" name="Group" dataKey="group" stackId="1" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} fill="#f59e0b" /></AreaChart></ResponsiveContainer></div></CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2.5rem] shadow-sm border-slate-100 overflow-hidden">
            <CardHeader className="p-8 pb-0"><SectionTitle icon={MapPin} title="Market Segments" subtitle="Geographic revenue hotspots." /></CardHeader>
            <CardContent className="p-8"><div className="h-[200px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.geoData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">{stats.geoData.map((_, i) => (<Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'][i % 5]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="mt-4 space-y-2">{stats.geoData.map((item, i) => (<div key={i} className="flex items-center justify-between text-[11px] font-bold"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'][i % 5] }} /><span className="text-slate-600 truncate max-w-[100px]">{item.name}</span></div><span className="text-slate-900">₹{item.value.toLocaleString()}</span></div>))}</div></CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
            <CardHeader className="p-8 pb-0"><SectionTitle icon={Users} title="Top Consumers" subtitle="By total revenue generated." /></CardHeader>
            <CardContent className="p-8"><div className="space-y-4">{stats.topCustomers.slice(0, 5).map((cust, i) => (<div key={i} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">{i+1}</div><div className="flex flex-col"><span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{cust.name}</span><span className="text-[10px] text-slate-400 font-medium">{cust.orders} orders</span></div></div><span className="text-xs font-black text-indigo-600">₹{cust.revenue.toLocaleString()}</span></div>))}</div></CardContent>
          </Card>
        </div>
      </div>

      {/* Secondary Insights Row */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2 rounded-[2.5rem] shadow-sm border-slate-100">
          <CardHeader className="p-8 pb-0"><SectionTitle icon={Clock} title="Peak Ordering Hours" subtitle="Concentration of orders by hour of day." /></CardHeader>
          <CardContent className="p-8">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.hourlyData}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="orders" fill="url(#barGrad)" radius={[10, 10, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
          <CardHeader className="p-8 pb-0"><SectionTitle icon={Users} title="Customer Retention" subtitle="Breakdown of Loyal vs New fans." /></CardHeader>
          <CardContent className="p-8 flex flex-col items-center justify-center">
             <div className="h-[180px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={stats.retentionData} 
                      cx="50%" cy="50%" 
                      innerRadius={50} outerRadius={70} 
                      paddingAngle={5} dataKey="value" stroke="none"
                    >
                      {stats.retentionData.map((_, i) => (<Cell key={i} fill={['#10b981', '#f1f5f9'][i % 2]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                   <div className="text-xl font-black text-slate-900">{stats.retentionRate}%</div>
                   <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Rate</div>
                </div>
             </div>
             <div className="mt-6 flex justify-center gap-6 w-full">
                {stats.retentionData.map((item, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.name}</span>
                    <span className="text-xl font-black text-slate-900">{item.value}</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
        <CardHeader className="p-8"><SectionTitle icon={ChefHat} title="Menu Performance Leaderboard" subtitle="Top 10 items by revenue." /></CardHeader>
        <CardContent className="p-8 pt-0"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{stats.topItems.map((item, i) => (<div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative overflow-hidden group hover:border-indigo-200 transition-all"><div className="text-[40px] font-black text-slate-200/50 absolute -right-2 -bottom-4 select-none group-hover:text-indigo-100 transition-colors">{i+1}</div><div className="relative z-10"><div className="text-xs font-black text-slate-400 uppercase mb-1 truncate">{item.name}</div><div className="text-xl font-black text-slate-900">₹{item.revenue.toLocaleString()}</div><div className="flex items-center justify-between mt-1"><div className="text-[10px] font-bold text-indigo-500">{item.qty} units</div><div className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.uniqueCustCount} fans</div></div></div></div>))}</div></CardContent>
      </Card>
    </motion.div>
  );
}

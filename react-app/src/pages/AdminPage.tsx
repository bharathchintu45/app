import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  CalendarDays,
  Check, 
  UtensilsCrossed, 
  Users, 
  BarChart3, 
  Package, 
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Plus,
  Archive,
  ShieldCheck,
  ChefHat,
  UserX,
  UserPlus,
  Eye,
  EyeOff,
  X,
  Mail,
  KeyRound,
  RefreshCw,
  ImageUp,
  Search,
  Settings,
  Pause,
  Play,
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import type { Cat, MenuItem, OrderReceipt, AppUser, UserRole } from "../types";
import { supabase } from "../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { SectionTitle, LuxuryLabel } from "../components/ui/Typography";
import { Skeleton, SkeletonTableRow, SkeletonMenuCard } from "../components/ui/Skeleton";
import { formatDateIndia, formatDateTimeIndia, digitsOnly } from "../lib/format";
import { useAppSetting, useAppSettingNumber, useAppSettingString } from "../hooks/useAppSettings";
import { cn } from "../lib/utils";
import DispatchTab from "./DispatchTab";

// ─── Staff Management Types ──────────────────────────────────────────────────
interface StaffProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

// ─── Staff Tab Component ─────────────────────────────────────────────────────
function StaffTab({ showToast }: { showToast: (msg: string) => void }) {
  const [profiles, setProfiles]         = useState<StaffProfile[]>([]);
  const [loading, setLoading]           = useState(false);
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [filter, setFilter]             = useState<"all" | "admin" | "kitchen" | "delivery" | "customer">("all");

  // Invite form state
  const [invEmail,    setInvEmail]    = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invName,     setInvName]     = useState("");
  const [invRole,     setInvRole]     = useState<"kitchen" | "admin" | "delivery">("kitchen");
  const [showPw,      setShowPw]      = useState(false);
  const [invLoading,  setInvLoading]  = useState(false);
  const [invError,    setInvError]    = useState("");
  const [invSuccess,  setInvSuccess]  = useState("");

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("role");
    if (!error && data) {
      setProfiles(data.map((p: any) => ({
        id: p.id,
        name: p.full_name || "Unknown",
        email: p.email || "—",
        phone: p.phone_number || "—",
        role: (p.role as UserRole) || "customer",
      })));
    }
    setLoading(false);
  }

  async function updateRole(userId: string, newRole: UserRole) {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) { showToast("Error: " + error.message); return; }
    setProfiles(ps => ps.map(p => p.id === userId ? { ...p, role: newRole } : p));
  }

  async function revokeAccess(userId: string) {
    if (!window.confirm("Revoke access and demote this user to Customer?")) return;
    await updateRole(userId, "customer");
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvError(""); setInvSuccess("");
    if (!invEmail.includes("@")) return setInvError("Enter a valid email.");
    if (invPassword.length < 8)  return setInvError("Password must be at least 8 characters.");
    if (!invName.trim())         return setInvError("Enter the staff member's name.");

    setInvLoading(true);
    try {
      // Use an isolated Supabase client so we don't disrupt the admin's session
      const anonClient = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      );

      // Step 1: Create the auth user (isolated client keeps admin session intact)
      const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
        email: invEmail,
        password: invPassword,
        options: { data: { full_name: invName.trim() } },
      });

      if (signUpError) throw new Error(signUpError.message);
      if (!signUpData.user) throw new Error("User creation failed — no user returned.");

      // Poll for the profile row to exist (up to 10 attempts x 600ms = 6 seconds)
      // The handle_new_user trigger creates the row asynchronously.
      let profileExists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 600));
        const { data: checkData } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', signUpData.user.id)
          .maybeSingle();
        if (checkData) { profileExists = true; break; }
      }
      if (!profileExists) throw new Error("Profile creation timed out. The user was created in Auth but the profile trigger may have failed. Please check the database.");

      // Step 2: UPDATE the role — trigger already inserted the row with 'customer'
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: invName.trim(), email: invEmail, role: invRole })
        .eq('id', signUpData.user.id);

      if (profileError) throw new Error(`Role assignment failed: ${profileError.message}`);

      setInvSuccess(`✅ ${invName} added as ${invRole === "kitchen" ? "Kitchen Staff" : "Administrator"}. They can now log in with the provided credentials.`);
      setInvEmail(""); setInvPassword(""); setInvName("");
      await fetchProfiles();
    } catch (err: any) {
      setInvError(err.message || "Failed to create staff account.");
    }
    setInvLoading(false);
  }

  function resetInvite() {
    setInvOpen(false); setInvEmail(""); setInvPassword(""); setInvName(""); setInvError(""); setInvSuccess(""); setShowPw(false);
  }
  function setInvOpen(v: boolean) { setInviteOpen(v); if (!v) { setInvError(""); setInvSuccess(""); } }

  const filtered = profiles.filter(p => filter === "all" || p.role === filter);

  const roleBadge = (role: UserRole) => cn(
    "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
    role === "admin"    ? "bg-rose-100 text-rose-700"
    : role === "kitchen"  ? "bg-amber-100 text-amber-700"
    : role === "delivery" ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-600"
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <SectionTitle icon={ShieldCheck} title="Staff & Permissions" subtitle="Manage operator roles and access levels." />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchProfiles} disabled={loading} className="h-9">
              <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            <Button onClick={() => setInvOpen(true)} className="h-9 bg-emerald-600 hover:bg-emerald-700">
              <UserPlus size={14} className="mr-2" /> Invite Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "admin", "kitchen", "delivery", "customer"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                  filter === f
                    ? f === "admin"    ? "bg-rose-600 text-white border-rose-600"
                      : f === "kitchen"  ? "bg-amber-500 text-white border-amber-500"
                      : f === "delivery" ? "bg-emerald-600 text-white border-emerald-600"
                      : f === "all"      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-600 text-white border-slate-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}>
                {f === "all" ? "All Users" : f === "admin" ? "⚙ Admins" : f === "kitchen" ? "🍳 Kitchen" : f === "delivery" ? "🛵 Delivery" : "👤 Customers"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div className="min-w-[500px]">
              <table className="w-full text-left min-w-max">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500">
                  <tr className="bg-slate-100/50 border-b border-slate-200">
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Name</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden sm:table-cell">Email</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Role</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    /* Skeleton rows while profiles are loading */
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-5 py-4" colSpan={4}>
                          <SkeletonTableRow />
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 italic">No users found.</td></tr>
                  ) : (
                    filtered.map(p => (
                      <tr key={p.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-400 sm:hidden">{p.email}</div>
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            {p.email}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={roleBadge(p.role)}>{p.role}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={p.role}
                              onChange={e => updateRole(p.id, e.target.value as UserRole)}
                              className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none shadow-sm hover:border-slate-300 transition-all"
                            >
                              <option value="customer">Customer</option>
                              <option value="kitchen">Kitchen Staff</option>
                              <option value="delivery">Delivery Boy</option>
                              <option value="admin">Administrator</option>
                            </select>
                            {(p.role === "kitchen" || p.role === "admin" || p.role === "delivery") && (
                              <button
                                onClick={() => revokeAccess(p.id)}
                                title="Revoke access"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                              >
                                <UserX size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Invite Staff Modal ── */}
      <AnimatePresence>
        {inviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setInvOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute right-4 top-4">
                <button onClick={resetInvite} className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
                  <ChefHat size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-1">Invite Staff Member</h2>
                <p className="text-sm text-slate-500 mb-6">Create a login for kitchen staff or a new admin. They can sign in at the portal URL.</p>

                {invSuccess ? (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-3">✅</div>
                    <p className="font-bold text-slate-800">{invSuccess}</p>
                    <Button className="mt-6 w-full" onClick={() => { setInvSuccess(""); setInvOpen(true); }}>
                      Add Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-4">
                    {/* Role selector */}
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                      {(["kitchen", "admin"] as const).map(r => (
                        <button key={r} type="button" onClick={() => setInvRole(r)}
                          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                            invRole === r
                              ? r === "kitchen" ? "bg-amber-500 text-white shadow-sm" : "bg-rose-600 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}>
                          {r === "kitchen" ? <ChefHat size={14} /> : <ShieldCheck size={14} />}
                          {r === "kitchen" ? "Kitchen Staff" : "Administrator"}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                      <Input placeholder="e.g. Ravi Kumar" value={invName} onChange={(e: any) => setInvName(e.target.value)} className="w-full" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="staff@example.com" value={invEmail} onChange={(e: any) => setInvEmail(e.target.value)} type="email" className="w-full pl-10" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Set Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <Input placeholder="Min 8 characters" value={invPassword} onChange={(e: any) => setInvPassword(e.target.value)} type={showPw ? "text" : "password"} className="w-full pl-10 pr-10" />
                      </div>
                      <p className="text-xs text-slate-400">Share this password with the staff member. They can change it later.</p>
                    </div>

                    {invError && (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-sm text-rose-700 font-medium">{invError}</div>
                    )}

                    <Button type="submit" className={cn("w-full", invRole === "kitchen" ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-600 hover:bg-rose-700")} disabled={invLoading} loading={invLoading}>
                      <UserPlus size={16} className="mr-2" /> Create {invRole === "kitchen" ? "Kitchen" : "Admin"} Account
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Customers Tab Component ──────────────────────────────────────────────────
function CustomersTab({ showToast }: { showToast: (msg: string) => void }) {
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
       // showToast("Failed to fetch all profiles: " + profilesRes.error.message);
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

type MenuDraft = { id: string; category: Cat; name: string; calories: string; protein: string; carbs: string; fat: string; fiber: string; priceINR: string; available: boolean; description?: string; image?: string; };
const emptyDraft = (id: string): MenuDraft => ({ id, category: "All-Day Kitchen", name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", priceINR: "", available: true, description: "", image: "" });
const toDraft = (it: MenuItem): MenuDraft => ({ id: it.id, category: it.category, name: it.name, calories: String(Math.round(it.calories||0)), protein: String(Math.round(it.protein||0)), carbs: String(Math.round(it.carbs||0)), fat: String(Math.round(it.fat||0)), fiber: String(Math.round(it.fiber||0)), priceINR: it.priceINR===undefined||it.priceINR===null?"":String(Math.round(it.priceINR)), available: it.available !== false, description: it.description || "", image: it.image || "" });
const fromDraft = (d: MenuDraft): MenuItem => { const n = (s: string) => Number(digitsOnly(s||"")||"0"); const p = d.priceINR.trim()===""?undefined:n(d.priceINR); return { id: d.id.trim(), category: d.category, name: d.name.trim(), calories: n(d.calories), protein: n(d.protein), carbs: n(d.carbs), fat: n(d.fat), fiber: n(d.fiber), priceINR: p, available: d.available, description: d.description?.trim() || undefined, image: d.image?.trim() || undefined }; };

// ─── All Orders Tab ─────────────────────────────────────────────────────────
function AllOrdersTab({
  orders,
  ordersLoading,
  fetchOrders,
  showToast,
  showMode,
}: {
  orders: OrderReceipt[];
  ordersLoading: boolean;
  fetchOrders: () => void;
  showToast: (msg: string) => void;
  showMode?: "all" | "regular" | "group" | "auto-generated";
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "regular" | "personalized" | "group">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "delivered" | "cancelled">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = orders.filter(o => {
    // 1. Handle auto-generated logic based on showMode
    if (showMode === "all") {
      // Show everything, do not filter out is_auto_generated
    } else if (showMode === "auto-generated") {
      if (!o.meta?.is_auto_generated) return false;
    } else {
      // Default behavior for "regular", "group", or undefined: HIDE auto-generated
      if (o.meta?.is_auto_generated) return false;
    }

    // 2. Handle kind filtering based on showMode
    if (showMode === "regular" && o.kind !== "regular") return false;
    if (showMode === "group" && o.kind !== "group") return false;

    // 3. Handle manual kind filter dropdown (only when showing everything/all)
    if (!showMode || showMode === "all") {
       if (kindFilter !== "all" && o.kind !== kindFilter) return false;
    }

    // Status filter — normalize both DB and kitchen-style statuses
    if (statusFilter !== "all") {
      const rawStatus = (o.status || "").toLowerCase();
      // Map kitchen-display values to filter keys
      const normalized = rawStatus === "new" ? "pending"
        : rawStatus === "preparing" ? "preparing"
        : rawStatus === "ready" ? "ready"
        : rawStatus === "out for delivery" ? "out_for_delivery"
        : rawStatus; // delivered, cancelled stay as-is
      if (normalized !== statusFilter) return false;
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        ((o as any).orderNumber || "").toLowerCase().includes(q) ||
        (o.customer?.receiverName || "").toLowerCase().includes(q) ||
        (o.customer?.receiverPhone || "").includes(q)
      );
    }
    return true;
  });

  const kindBadge = (kind: string) => {
    if (kind === "personalized") return "bg-emerald-100 text-emerald-700";
    if (kind === "group") return "bg-violet-100 text-violet-700";
    return "bg-sky-100 text-sky-700";
  };

  const statusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "bg-emerald-100 text-emerald-700";
    if (s === "confirmed") return "bg-sky-100 text-sky-700";
    if (s === "cancelled" || s === "removed_by_admin") return "bg-rose-100 text-rose-700";
    if (s === "paused") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  async function updateStatus(dbId: string, newStatus: string) {
    if (dbId.startsWith("v-")) {
      // Lazy insertion: Solidify this virtual order into a real DB row
      const [_, subId, _slot, dateStr] = dbId.split("-");
      const sub = orders.find(o => o.id === dbId) || ({} as any);

      // Extract delivery details correctly from the virtual order
      const customerNameProp = sub?.customer?.receiverName || "Unknown";
      
      const { data: newOrder, error } = await supabase.from('orders').insert({
        order_number: sub.orderNumber || sub.meta?.orderNumber || `SUB-${subId.slice(-6).toUpperCase()}`,
        user_id: sub.meta?.user_id,
        customer_name: customerNameProp,
        status: newStatus,
        kind: 'subscription',
        payment_status: 'paid',
        delivery_date: dateStr,
        subtotal: 0,
        gst_amount: 0,
        total: 0,
        delivery_details: sub.customer,
        meta: { 
          is_auto_generated: true, 
          subscription_id: subId,
          orderNumber: sub.orderNumber || sub.meta?.orderNumber
        }
      }).select("id").single();

      if (error) {
        showToast("Error creating specific delivery order: " + error.message);
        return;
      }
      
      // Also insert the item so it shows up
      if (newOrder && sub.lines && sub.lines.length > 0) {
        await supabase.from('order_items').insert(
          sub.lines.map((l: any) => ({
             order_id: newOrder.id,
             item_name: l.label,
             quantity: l.qty,
             unit_price: l.unitPriceAtOrder || 0
          }))
        );
      }

      showToast("Order status updated to " + newStatus);
      fetchOrders();
      return;
    }

    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", dbId);
    if (error) showToast("Error: " + error.message);
    else { showToast("Status updated to " + newStatus); fetchOrders(); }
  }

  async function updatePaymentStatus(dbId: string, newPaymentStatus: string) {
    const { error } = await supabase.from("orders").update({ payment_status: newPaymentStatus }).eq("id", dbId);
    if (error) showToast("Error updating payment: " + error.message);
    else { showToast("Payment marked as Received"); fetchOrders(); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
          <SectionTitle icon={Package} title="Order History" subtitle={`${filtered.length} order${filtered.length !== 1 ? 's' : ''} found`} />
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, ID..."
                className="pl-9 pr-4 h-9 w-56 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            {/* Kind filter (Only shown on All Orders & unmodified pages) */}
            {(!showMode || showMode === "all") && (
              <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                {(["all", "regular", "personalized", "group"] as const).map(k => (
                  <button key={k} onClick={() => setKindFilter(k)}
                    className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      kindFilter === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                    {k === "all" ? "All" : k === "personalized" ? "Plan" : k === "group" ? "Group" : "Regular"}
                  </button>
                ))}
              </div>
            )}
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none"
            >
              <option value="all">Any Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button variant="outline" onClick={fetchOrders} disabled={ordersLoading} className="h-9">
              <RefreshCw size={14} className={cn("mr-2", ordersLoading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Order</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden md:table-cell">Date</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden lg:table-cell">Amount</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordersLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-5 py-4"><SkeletonTableRow /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">No orders match the current filters.</td></tr>
                ) : filtered.map(o => {
                  const isExpanded = expandedId === o.id;
                  const delivDate = o.deliveryAtLabel || new Date(o.createdAt).toISOString().slice(0, 10);
                  const addr = [o.customer?.building, o.customer?.street, o.customer?.area].filter(Boolean).join(", ");
                  return (
                    <>
                      <tr key={o.id} className="bg-white hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        <td className="px-5 py-4">
                          <div className="text-sm font-black text-slate-900">#{(o as any).orderNumber || o.id}</div>
                          {o.meta?.is_auto_generated && <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">📅 Sub Delivery</div>}
                          {o.meta?.is_future_order && <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">📅 Future</div>}
                          {o.meta?.is_manual && <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-0.5">✋ Manual</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold text-slate-900">{o.customer?.receiverName || "—"}</div>
                          <div className="text-xs text-slate-400">{o.customer?.receiverPhone || ""}</div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <div className="text-sm text-slate-600">{formatDateIndia(delivDate)}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full", kindBadge(o.kind))}>
                            {o.kind === "personalized" ? "Plan" : o.kind === "group" ? "Group" : "Regular"}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <div className="text-sm font-bold text-slate-900">₹{(o.priceSummary?.total || 0).toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-400">{o.payment === 'paid' ? '✅ Paid' : '⏳ Pending'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full capitalize", statusBadge((o.status as string) || ""))}>
                            {o.status || "pending"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <select
                            value={((o.status as string) || "pending").toLowerCase()}
                            onChange={e => updateStatus((o as any).dbId || o.id, e.target.value)}
                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={o.id + "-exp"} className="bg-slate-50/60 border-b border-slate-100">
                          <td colSpan={7} className="px-8 py-5">
                            <div className="grid sm:grid-cols-3 gap-6">
                              {/* Delivery */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Details</div>
                                <div className="text-sm font-bold text-slate-800">{o.customer?.receiverName}</div>
                                <div className="text-xs text-slate-500">{o.customer?.receiverPhone}</div>
                                {addr && <div className="text-xs text-slate-500 mt-1">{addr}</div>}
                                <div className="text-xs text-slate-400 mt-1">Delivery: {formatDateIndia(delivDate)}</div>
                                {o.meta?.admin_note && (
                                  <div className="mt-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">📝 {o.meta.admin_note}</div>
                                )}
                              </div>
                              {/* Items */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Items</div>
                                {(o.lines || []).length > 0 ? (
                                  <div className="space-y-1.5">
                                    {o.lines.map((l, i) => (
                                      <div key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-700">{l.label} × {l.qty}</span>
                                        <span className="font-bold text-slate-900">₹{((l.unitPriceAtOrder || 0) * l.qty).toLocaleString('en-IN')}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400 italic">No itemised details.</div>
                                )}
                              </div>
                              {/* Billing */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Billing</div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>₹{(o.priceSummary?.subtotal || 0).toLocaleString('en-IN')}</span></div>
                                  <div className="flex justify-between text-xs text-slate-500"><span>GST ({((o.priceSummary?.gstRate || 0.05) * 100).toFixed(0)}%)</span><span>₹{(o.priceSummary?.gst || 0).toLocaleString('en-IN')}</span></div>
                                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200"><span>Total</span><span>₹{(o.priceSummary?.total || 0).toLocaleString('en-IN')}</span></div>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className={cn("text-xs font-bold px-2 py-1 rounded-lg inline-block", o.payment === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                                    {o.payment === 'paid' ? '✅ Payment Received' : '⏳ Payment Pending'}
                                  </div>
                                  {o.payment !== 'paid' && (
                                    <button
                                      onClick={() => updatePaymentStatus((o as any).dbId || o.id, 'paid')}
                                      className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AdminPage({ user, onBack, showToast }: { user: AppUser | null, onBack: () => void, showToast: (msg: string) => void }) {
  const chatSetting = useAppSetting("chat_enabled", true);
  const personalizedDiscount = useAppSettingNumber("personalized_discount_pct", 15);
  const groupDiscount = useAppSettingNumber("group_discount_pct", 0);
  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const maintenanceSetting = useAppSetting("maintenance_mode", false);
  const cutoffSetting = useAppSettingNumber("order_cutoff_hour", 22);
  const chefNoteSetting = useAppSettingString("chef_note", "Ready for your healthy meal journey?");
  const chefNoteEnabledSetting = useAppSetting("chef_note_enabled", true);
  const bypassEmailsSetting = useAppSettingString("maintenance_bypass_emails", "info@thefreshbox.in, admin@thefreshbox.in");
  const deliveryFeeSetting = useAppSettingNumber("delivery_fee", 0);
  const freeDeliverySetting = useAppSetting("free_delivery_enabled", false);

  const enableRegularOrders = useAppSetting("enable_regular_orders", true);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);
  const enableGroupMeals = useAppSetting("enable_group_meals", true);
  const rewardsEnabled = useAppSetting("rewards_enabled", true);
  const referralEnabled = useAppSetting("referral_program_enabled", true);
  const supportPhone = useAppSettingString("support_phone", "+91 8008880000");
  const supportWhatsApp = useAppSettingString("support_whatsapp", "918008880000");
  const autoOrderTimeSetting = useAppSettingString("auto_order_time", "05:00");
  const autoOrderEnabledSetting = useAppSetting("auto_order_enabled", false);
  const kitchenRealtimeStatus = useAppSetting("enable_kitchen_realtime_status", true);
  const kitchenPrepAggregation = useAppSetting("enable_kitchen_prep_aggregation", false);
  const healthPreferencesEnabled = useAppSetting("enable_health_preferences", true);
  const enableDelivery = useAppSetting("enable_delivery", true);
  const enablePickup = useAppSetting("enable_pickup", true);
  const storeAddressSetting = useAppSettingString("store_address", "123 Health Avenue\nFitness District 500001");
  const storeMapUrlSetting = useAppSettingString("store_map_url", "https://maps.google.com/?q=12.9715987,77.5945627");
  const storeOpenWeekday = useAppSettingString("store_open_weekday", "06:00");
  const storeCloseWeekday = useAppSettingString("store_close_weekday", "21:00");
  const storeOpenWeekend = useAppSettingString("store_open_weekend", "09:00");
  const storeCloseWeekend = useAppSettingString("store_close_weekend", "21:00");
  const googleMapsApiKey = useAppSettingString("google_maps_api_key", "");
  const enableStoreTimings = useAppSetting("enable_store_timings", true);
  const enableEmailAuth = useAppSetting("enable_email_auth", true);
  const enablePhoneAuth = useAppSetting("enable_phone_auth", true);

  const [draftSettings, setDraftSettings] = useState<{
    chatEnabled: boolean;
    personalizedDiscount: number;
    groupDiscount: number;
    taxPercentage: number;
    enableRegularOrders: boolean;
    enablePersonalizedSubscriptions: boolean;
    enableGroupMeals: boolean;
    maintenanceMode: boolean;
    orderCutoffHour: number;
    chefNote: string;
    chefNoteEnabled: boolean;
    rewardsEnabled: boolean;
    referralEnabled: boolean;
    maintenanceBypassEmails: string;
    deliveryFee: number;
    freeDeliveryEnabled: boolean;
    supportPhone: string;
    supportWhatsApp: string;
    autoOrderTime: string;
    autoOrderEnabled: boolean;
    kitchenRealtimeEnabled: boolean;
    enableKitchenPrepAggregation: boolean;
    enableHealthPreferences: boolean;
    enableDelivery: boolean;
    enablePickup: boolean;
    storeAddress: string;
    storeMapUrl: string;
    storeOpenWeekday: string;
    storeCloseWeekday: string;
    storeOpenWeekend: string;
    storeCloseWeekend: string;
    googleMapsApiKey: string;
    enableStoreTimings: boolean;
    enableEmailAuth: boolean;
    enablePhoneAuth: boolean;
  } | null>(null);

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Initialize draft when settings load
  useEffect(() => {
    // If we're not loading and we have values, initialize the draft
    const allLoaded = [
      chatSetting, personalizedDiscount, groupDiscount, taxSetting,
      enableRegularOrders, enablePersonalizedSubscriptions, enableGroupMeals,
      maintenanceSetting, cutoffSetting, chefNoteSetting, chefNoteEnabledSetting,
      rewardsEnabled, referralEnabled, bypassEmailsSetting, deliveryFeeSetting,
      freeDeliverySetting, supportPhone, supportWhatsApp, autoOrderTimeSetting,
      autoOrderEnabledSetting, kitchenRealtimeStatus, kitchenPrepAggregation,
      healthPreferencesEnabled, storeAddressSetting, storeMapUrlSetting,
      storeOpenWeekday, storeCloseWeekday, storeOpenWeekend, storeCloseWeekend, googleMapsApiKey, enableStoreTimings,
      enableEmailAuth, enablePhoneAuth
    ].every(s => !s.loading);

    if (allLoaded && !draftSettings) {
      setDraftSettings({
        chatEnabled: chatSetting.value,
        personalizedDiscount: personalizedDiscount.value,
        groupDiscount: groupDiscount.value,
        taxPercentage: taxSetting.value,
        enableRegularOrders: enableRegularOrders.value,
        enablePersonalizedSubscriptions: enablePersonalizedSubscriptions.value,
        enableGroupMeals: enableGroupMeals.value,
        maintenanceMode: maintenanceSetting.value,
        orderCutoffHour: cutoffSetting.value,
        chefNote: chefNoteSetting.value,
        chefNoteEnabled: chefNoteEnabledSetting.value,
        rewardsEnabled: rewardsEnabled.value,
        referralEnabled: referralEnabled.value,
        maintenanceBypassEmails: bypassEmailsSetting.value,
        deliveryFee: deliveryFeeSetting.value,
        freeDeliveryEnabled: freeDeliverySetting.value,
        supportPhone: supportPhone.value,
        supportWhatsApp: supportWhatsApp.value,
        autoOrderTime: autoOrderTimeSetting.value,
        autoOrderEnabled: autoOrderEnabledSetting.value,
        kitchenRealtimeEnabled: kitchenRealtimeStatus.value,
        enableKitchenPrepAggregation: kitchenPrepAggregation.value,
        enableHealthPreferences: healthPreferencesEnabled.value,
        enableDelivery: enableDelivery.value,
        enablePickup: enablePickup.value,
        storeAddress: storeAddressSetting.value,
        storeMapUrl: storeMapUrlSetting.value,
        storeOpenWeekday: storeOpenWeekday.value,
        storeCloseWeekday: storeCloseWeekday.value,
        storeOpenWeekend: storeOpenWeekend.value,
        storeCloseWeekend: storeCloseWeekend.value,
        googleMapsApiKey: googleMapsApiKey.value,
        enableStoreTimings: enableStoreTimings.value,
        enableEmailAuth: enableEmailAuth.value,
        enablePhoneAuth: enablePhoneAuth.value,
      });
    }
  }, [
    chatSetting.loading, personalizedDiscount.loading, groupDiscount.loading, taxSetting.loading,
    enableRegularOrders.loading, enablePersonalizedSubscriptions.loading, enableGroupMeals.loading,
    maintenanceSetting.loading, cutoffSetting.loading, chefNoteSetting.loading, chefNoteEnabledSetting.loading,
    rewardsEnabled.loading, referralEnabled.loading, deliveryFeeSetting.loading, freeDeliverySetting.loading,
    supportPhone.loading, supportWhatsApp.loading, autoOrderTimeSetting.loading, autoOrderEnabledSetting.loading,
    kitchenRealtimeStatus.loading, kitchenPrepAggregation.loading, healthPreferencesEnabled.loading,
    enableDelivery.loading, enablePickup.loading, storeAddressSetting.loading, storeMapUrlSetting.loading,
    storeOpenWeekday.loading, storeCloseWeekday.loading, storeOpenWeekend.loading, storeCloseWeekend.loading, googleMapsApiKey.loading,
    enableStoreTimings.loading, enableEmailAuth.loading, enablePhoneAuth.loading,
    draftSettings
  ]);

  async function handleSaveSettings() {
    if (!draftSettings) return;
    setIsSavingSettings(true);
    try {
      if (draftSettings.chatEnabled !== chatSetting.value) await chatSetting.update(draftSettings.chatEnabled);
      if (draftSettings.enableRegularOrders !== enableRegularOrders.value) await enableRegularOrders.update(draftSettings.enableRegularOrders);
      if (draftSettings.enablePersonalizedSubscriptions !== enablePersonalizedSubscriptions.value) await enablePersonalizedSubscriptions.update(draftSettings.enablePersonalizedSubscriptions);
      if (draftSettings.enableGroupMeals !== enableGroupMeals.value) await enableGroupMeals.update(draftSettings.enableGroupMeals);
      if (draftSettings.maintenanceMode !== maintenanceSetting.value) await maintenanceSetting.update(draftSettings.maintenanceMode);
      if (draftSettings.rewardsEnabled !== rewardsEnabled.value) await rewardsEnabled.update(draftSettings.rewardsEnabled);
      if (draftSettings.referralEnabled !== referralEnabled.value) await referralEnabled.update(draftSettings.referralEnabled);
      if (draftSettings.chefNoteEnabled !== chefNoteEnabledSetting.value) await chefNoteEnabledSetting.update(draftSettings.chefNoteEnabled);
      if (draftSettings.kitchenRealtimeEnabled !== kitchenRealtimeStatus.value) await kitchenRealtimeStatus.update(draftSettings.kitchenRealtimeEnabled);
      if (draftSettings.enableKitchenPrepAggregation !== kitchenPrepAggregation.value) await kitchenPrepAggregation.update(draftSettings.enableKitchenPrepAggregation);
      if (draftSettings.enableHealthPreferences !== healthPreferencesEnabled.value) await healthPreferencesEnabled.update(draftSettings.enableHealthPreferences);
      if (draftSettings.enableDelivery !== enableDelivery.value) await enableDelivery.update(draftSettings.enableDelivery);
      if (draftSettings.enablePickup !== enablePickup.value) await enablePickup.update(draftSettings.enablePickup);
      
      await personalizedDiscount.update(draftSettings.personalizedDiscount);
      await groupDiscount.update(draftSettings.groupDiscount);
      await taxSetting.update(draftSettings.taxPercentage);
      await cutoffSetting.update(draftSettings.orderCutoffHour);
      await chefNoteSetting.update(draftSettings.chefNote);
      await bypassEmailsSetting.update(draftSettings.maintenanceBypassEmails);
      await deliveryFeeSetting.update(draftSettings.deliveryFee);
      await supportPhone.update(draftSettings.supportPhone);
      await supportWhatsApp.update(draftSettings.supportWhatsApp);
      await storeAddressSetting.update(draftSettings.storeAddress);
      await storeMapUrlSetting.update(draftSettings.storeMapUrl);
      await storeOpenWeekday.update(draftSettings.storeOpenWeekday);
      await storeCloseWeekday.update(draftSettings.storeCloseWeekday);
      await storeOpenWeekend.update(draftSettings.storeOpenWeekend);
      await storeCloseWeekend.update(draftSettings.storeCloseWeekend);
      await googleMapsApiKey.update(draftSettings.googleMapsApiKey);
      if (draftSettings.freeDeliveryEnabled !== freeDeliverySetting.value) await freeDeliverySetting.update(draftSettings.freeDeliveryEnabled);
      await autoOrderTimeSetting.update(draftSettings.autoOrderTime);
      if (draftSettings.autoOrderEnabled !== autoOrderEnabledSetting.value) await autoOrderEnabledSetting.update(draftSettings.autoOrderEnabled);
      if (draftSettings.enableStoreTimings !== enableStoreTimings.value) await enableStoreTimings.update(draftSettings.enableStoreTimings);
      if (draftSettings.enableEmailAuth !== enableEmailAuth.value) await enableEmailAuth.update(draftSettings.enableEmailAuth);
      if (draftSettings.enablePhoneAuth !== enablePhoneAuth.value) await enablePhoneAuth.update(draftSettings.enablePhoneAuth);
      showToast("Settings saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  const [activeTab, setActiveTab] = useState<"catalog" | "stock" | "subscriptions" | "all_orders" | "orders" | "group_orders" | "sub_orders" | "customers" | "staff" | "analytics" | "settings">("catalog");
  const [analyticsRange, setAnalyticsRange] = useState<"today" | "yesterday" | "this_week" | "last_week" | "30d" | "1m" | "6m" | "1y" | "custom">("30d");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });

  // ── Auto Order "Run Now" State ───────────────────────────────────────────────
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowResult, setRunNowResult] = useState<{ success: boolean; message: string; created: number; skipped: number } | null>(null);

  async function handleRunNow() {
    setRunNowLoading(true);
    setRunNowResult(null);
    let created = 0, skipped = 0, errors = 0;
    try {
      // Calculate today's date in IST (UTC+5:30)
      const now = new Date();
      const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
      const targetStr = ist.toISOString().slice(0, 10);
      const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const targetDayName = dayNames[new Date(targetStr + 'T12:00:00Z').getDay()];

      // 1. Fetch all active subscriptions scheduled for today
      const { data: subs, error: subErr } = await supabase
        .from('subscriptions')
        .select('id, user_id, customer_name, schedule, delivery_details, start_date, end_date, status, meta')
        .eq('status', 'active')
        .lte('start_date', targetStr)
        .gte('end_date', targetStr);

      if (subErr) throw new Error('Failed to fetch subscriptions: ' + subErr.message);
      if (!subs || subs.length === 0) {
        setRunNowResult({ success: true, message: 'No active subscriptions found for today.', created: 0, skipped: 0 });
        showToast('ℹ️ No active subscriptions found for ' + targetStr);
        return;
      }

      for (const sub of subs) {
        // 2. Find schedule lines for today
        const scheduleLines: any[] = sub.schedule || [];
        const dayLines = scheduleLines.filter((l: any) =>
          (l.day === targetStr || l.day === targetDayName) && l.qty > 0
        );
        if (dayLines.length === 0) { skipped++; continue; }

        // 3. Skip if user has a hold today
        const { data: holds } = await supabase
          .from('subscription_holds')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('hold_date', targetStr);
        if (holds && holds.length > 0) { skipped++; continue; }

        // 4. Find existing auto-generated orders for this sub today
        const { data: existing } = await supabase
          .from('orders')
          .select('id, meta')
          .eq('delivery_date', targetStr)
          .filter('meta->>subscription_id', 'eq', sub.id)
          .filter('meta->>is_auto_generated', 'eq', 'true');
        
        const existingSlots = new Set((existing || []).map(o => (o.meta as any)?.slot));

        // 5. Group lines by slot
        const linesBySlot: Record<string, any[]> = {};
        dayLines.forEach((line: any) => {
          const slot = line.slot || 'Meal';
          if (!linesBySlot[slot]) linesBySlot[slot] = [];
          linesBySlot[slot].push(line);
        });

        // 6. Create order per slot
        const canonicalOrderNum = sub.meta?.orderNumber
          || (sub as any).order_number
          || `SUB-${sub.id.slice(-6).toUpperCase()}`;
        const deliveryDetails = sub.delivery_details || { receiverName: sub.customer_name || 'Subscription Customer', receiverPhone: '' };

        let subGeneratedAtLeastOne = false;
        let subHasErrors = false;

        for (const [slot, itemsForSlot] of Object.entries(linesBySlot)) {
           if (existingSlots.has(slot)) continue;
           
           const orderNumberForSlot = `${canonicalOrderNum}-${slot}`;

           const { data: insertedOrder, error: insErr } = await supabase.from('orders').insert({
             user_id: sub.user_id,
             order_number: orderNumberForSlot,
             customer_name: sub.customer_name || (deliveryDetails as any).receiverName,
             delivery_details: deliveryDetails,
             payment_status: 'paid',
             subtotal: 0, total: 0, gst_amount: 0,
             kind: 'personalized',
             status: 'pending',
             delivery_date: targetStr,
             meta: {
               subscription_id: sub.id,
               is_auto_generated: true,
               generated_at: new Date().toISOString(),
               orderNumber: canonicalOrderNum,
               slot: slot,
               delivery_otp: Math.floor(1000 + Math.random() * 9000).toString(),
             }
           }).select('id').single();

           if (insErr || !insertedOrder) { subHasErrors = true; continue; }

           // Create order items
           const items = itemsForSlot.map((line: any) => ({
             order_id: insertedOrder.id,
             menu_item_id: line.itemId,
             item_name: `[${slot}] ${line.label}`,
             quantity: line.qty,
             unit_price: line.unitPriceAtOrder || 0
           }));
           
           const { error: itemsErr } = await supabase.from('order_items').insert(items);
           if (itemsErr) { console.error('Error inserting auto items:', itemsErr); subHasErrors = true; }
           else subGeneratedAtLeastOne = true;
        }

        if (subGeneratedAtLeastOne) created++;
        else if (!subHasErrors) skipped++;
        else errors++;
      }

      setRunNowResult({ success: true, message: `Orders generated for ${targetStr}`, created, skipped });
      showToast(`✅ Done: ${created} order(s) created, ${skipped} skipped`);
      fetchOrders();
    } catch (err: any) {
      setRunNowResult({ success: false, message: err.message || 'Unknown error', created, skipped });
      showToast('❌ Error: ' + (err.message || 'Unknown error'));
    } finally {
      setRunNowLoading(false);
    }
  }


  // Orders State
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  async function fetchOrders() {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items ( id, menu_item_id, item_name, quantity, unit_price )`)
      .order('created_at', { ascending: false })
      .limit(200); // Only show last 200 orders for performance
    if (!error && data) {
      const mapped: OrderReceipt[] = data.map(dbOrder => {
        const meta = typeof dbOrder.meta === 'string' ? JSON.parse(dbOrder.meta) : dbOrder.meta;
        return {
          id: dbOrder.order_number || dbOrder.id,
          dbId: dbOrder.id,
          kind: dbOrder.kind as any,
          createdAt: new Date(dbOrder.created_at).getTime(),
          headline: dbOrder.kind,
          deliveryAtLabel: dbOrder.delivery_date,
          customer: dbOrder.delivery_details || {
            receiverName: dbOrder.customer_name || 'Unknown',
            receiverPhone: '', building: '', street: '', area: ''
          },
          payment: dbOrder.payment_status,
          status: (dbOrder.status === 'pending' ? 'New' : dbOrder.status) as any,
          priceSummary: {
            subtotal: dbOrder.subtotal,
            gst: dbOrder.gst_amount,
            gstRate: 0.05,
            deliveryFee: dbOrder.delivery_fee || 0,
            total: dbOrder.total,
          },
          meta: meta || { durationDays: 30 },
          lines: (dbOrder.order_items || []).map((dbItem: any) => ({
            label: dbItem.item_name || dbItem.menu_item_id || 'Item',
            qty: dbItem.quantity, unitPriceAtOrder: dbItem.unit_price
          }))
        };
      });
      // --- VIRTUAL ORDER SYNTHESIS FOR TODAY ---
      const todayStr = new Date().toISOString().split("T")[0];
      const virtualOrders: OrderReceipt[] = [];
      const actualAutoGenDbIds = new Set(data.filter(o => o.delivery_date === todayStr && o.meta?.is_auto_generated).map(o => o.meta?.subscription_id));

      const slotMap: Record<string, string> = { 'Slot1': 'Breakfast', 'Slot2': 'Lunch', 'Slot3': 'Dinner' };

      // Generate virtuals for New Table Subscriptions
      subscriptions.filter(s => s.status === "active").forEach(sub => {
         if (actualAutoGenDbIds.has(sub.id)) return; // Already solidified in DB
         const schedule = sub.schedule || [];
         const ISTDay = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long' });
         const todaySchedule = schedule.filter((l: any) => (l.day === todayStr || l.day === ISTDay) && l.qty > 0);
         
         if (todaySchedule.length > 0) {
            todaySchedule.forEach((l: any) => {
               const slot = slotMap[l.slot] || l.slot || 'Meal';
               const canonicalOrderNum = sub.meta?.orderNumber || sub.order_number || `SUB-${sub.id.slice(-6).toUpperCase()}`;
               virtualOrders.push({
                 id: `v-${sub.id}-${slot}-${todayStr}`,
                 dbId: `v-${sub.id}-${slot}-${todayStr}`,
                 orderNumber: canonicalOrderNum,
                 kind: 'subscription' as any,
                 createdAt: new Date().getTime(),
                 headline: 'subscription',
                 deliveryAtLabel: todayStr,
                 customer: sub.delivery_details || { receiverName: sub.customer_name },
                 payment: 'paid',
                 status: 'pending' as any,
                 priceSummary: { subtotal: 0, gst: 0, gstRate: 0.05, deliveryFee: 0, total: 0 },
                 meta: { is_auto_generated: true, subscription_id: sub.id, user_id: sub.user_id, orderNumber: canonicalOrderNum },
                 lines: [{ itemId: l.itemId, label: `[${slot}] ${l.label.replace(/\[.*?\]\s*/, '')}`, qty: l.qty, unitPriceAtOrder: 0 }]
               } as any);
            });
         }
      });

      // Generate virtuals for Legacy Personalized Orders
      data.filter(o => o.kind === 'personalized' && o.status !== "delivered" && o.status !== "cancelled" && !o.meta?.is_auto_generated).forEach(sub => {
         if (actualAutoGenDbIds.has(sub.id)) return;
         const subMeta = typeof sub.meta === 'string' ? JSON.parse(sub.meta) : sub.meta;
         const schedule = subMeta?.scheduleLines || [];
         const ISTDay = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long' });
         const todaySchedule = schedule.filter((l: any) => (l.day === todayStr || l.day === ISTDay) && l.qty > 0);
         
         if (todaySchedule.length > 0) {
            todaySchedule.forEach((l: any) => {
               const slot = slotMap[l.slot] || l.slot || 'Meal';
               const canonicalOrderNum2 = sub.order_number || subMeta?.orderNumber || `SUB-${sub.id.slice(-6).toUpperCase()}`;
               virtualOrders.push({
                 id: `v-${sub.id}-${slot}-${todayStr}`,
                 dbId: `v-${sub.id}-${slot}-${todayStr}`,
                 orderNumber: canonicalOrderNum2,
                 kind: 'subscription' as any,
                 createdAt: new Date().getTime(),
                 headline: 'subscription',
                 deliveryAtLabel: todayStr,
                 customer: sub.delivery_details || { receiverName: sub.customer_name },
                 payment: 'paid',
                 status: 'pending' as any,
                 priceSummary: { subtotal: 0, gst: 0, gstRate: 0.05, deliveryFee: 0, total: 0 },
                 meta: { is_auto_generated: true, subscription_id: sub.id, user_id: sub.user_id, orderNumber: canonicalOrderNum2 },
                 lines: [{ itemId: l.itemId, label: `[${slot}] ${l.label.replace(/\[.*?\]\s*/, '')}`, qty: l.qty, unitPriceAtOrder: 0 }]
               } as any);
            });
         }
      });

      setOrders([...virtualOrders, ...mapped]);
    }
    setOrdersLoading(false);
  }

  // ─── Subscriptions State (dedicated subscriptions table) ─────────────────────
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  async function fetchSubscriptions() {
    setSubsLoading(true);
    // Only fetch active or recently expired subscriptions for performance
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setSubscriptions(data);
    else if (error) console.error('[Admin] fetchSubscriptions error:', error);
    setSubsLoading(false);
  }

  // Effect to keep orders in sync with subscriptions for virtual sub orders
  useEffect(() => {
    fetchOrders();
  }, [subscriptions]);

  // Load subscriptions whenever the subscriptions tab becomes active


  // ─── Real Revenue Stats from DB ───────────────────────────────────────────
  const [realStats, setRealStats] = useState({ 
    totalRev: 0, 
    previousRev: 0,
    activeSubs: 0, 
    totalOrders: 0, 
    previousOrders: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    thisWeekOrders: 0,
    lastWeekOrders: 0,
    filteredOrders: [] as any[]
  });
  const [statsLoading, setStatsLoading] = useState(true);

   async function fetchRealStats(silent = false) {
    if (!silent) setStatsLoading(true);
    const today = new Date();
    
    // Calculate start date for the CURRENT period
    let currentPeriodStart = new Date();
    let currentPeriodEnd = new Date(); // default to today
    
    if (analyticsRange === "today") {
      currentPeriodStart.setHours(0, 0, 0, 0);
    } else if (analyticsRange === "yesterday") {
      currentPeriodStart.setDate(today.getDate() - 1);
      currentPeriodStart.setHours(0, 0, 0, 0);
      currentPeriodEnd.setDate(today.getDate() - 1);
      currentPeriodEnd.setHours(23, 59, 59, 999);
    } else if (analyticsRange === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      currentPeriodStart.setDate(diff);
      currentPeriodStart.setHours(0, 0, 0, 0);
    } else if (analyticsRange === "last_week") {
      const day = today.getDay();
      const diff = today.getDate() - day - 6 + (day === 0 ? -6 : 1); // Last Monday
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

    // Calculate start/end dates for the PREVIOUS period (for growth indicators)
    let previousPeriodStart = new Date(currentPeriodStart);
    let previousPeriodEnd = new Date(currentPeriodStart);
    
    if (analyticsRange === "today") {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodEnd.setHours(0, 0, 0, 0);
      previousPeriodEnd.setDate(currentPeriodStart.getDate()); // Starts at current start
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
    const previousPeriodStartStr = previousPeriodStart.toISOString();

    // To ensure snapshots (Today, Yesterday, This Week, Last Week) are always accurate,
    // we fetch at least 30 days of data even if the range is smaller.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fetchStartStr = (new Date(Math.min(previousPeriodStart.getTime(), thirtyDaysAgo.getTime()))).toISOString();

    // Fetch all valid orders (including pending payments, excluding cancelled) from the start of the PREVIOUS period to now
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total, kind, payment_status, status, created_at, customer_name, delivery_date, delivery_details, order_items(item_name, quantity, unit_price)')
      .neq('status', 'cancelled')
      .gte('created_at', fetchStartStr)
      .lte('created_at', analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      // Data filtered for the SELECTED periods (current vs previous)
      const currentOrders = data.filter(o => o.created_at >= currentPeriodStartStr && o.created_at <= (analyticsRange === 'custom' ? customRange.end + 'T23:59:59Z' : today.toISOString()));
      const previousOrdersList = data.filter(o => o.created_at >= previousPeriodStartStr && o.created_at < currentPeriodStartStr);

      const totalRev = currentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const previousRev = previousOrdersList.reduce((sum, o) => sum + (o.total || 0), 0);
      
      const activeSubs = currentOrders.filter(o => o.kind === 'personalized' && o.status !== 'delivered').length;
      const totalOrders = currentOrders.length;
      const previousOrdersCount = previousOrdersList.length;
      
      // Snapshot Calculations (Fixed timeframes)
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
        totalRev, 
        previousRev,
        activeSubs, 
        totalOrders, 
        previousOrders: previousOrdersCount,
        todayOrders,
        yesterdayOrders,
        thisWeekOrders,
        lastWeekOrders,
        filteredOrders: currentOrders 
      });
    }
    setStatsLoading(false);
  }

  useEffect(() => {
    if (activeTab === "analytics") fetchRealStats();
    else if (activeTab === "subscriptions") fetchSubscriptions();
    else if (activeTab === "catalog" || activeTab === "stock") fetchMenu();
    else if (activeTab === "all_orders" || activeTab === "orders" || activeTab === "group_orders" || activeTab === "sub_orders") fetchOrders();
  }, [activeTab, analyticsRange, customRange]);

  // Real-time notifications for new subscriptions
  useEffect(() => {
    const subChannel = supabase.channel('admin-updates')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'subscriptions' 
      }, payload => {
        showToast(`Subscription Update: ${payload.new.customer_name}`);
        if (activeTab === 'subscriptions') fetchSubscriptions();
        if (activeTab === 'analytics') fetchRealStats(true);
      })
      .on('postgres_changes', {
        event: '*', // Listen for all order changes (New orders, Payment updates, Status changes)
        schema: 'public',
        table: 'orders'
      }, () => {
        // Silently refresh analytics and orders if relevant
        if (activeTab === 'analytics') fetchRealStats(true);
        if (activeTab === 'all_orders' || activeTab === 'orders' || activeTab === 'group_orders' || activeTab === 'sub_orders') {
          fetchOrders();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_items'
      }, () => {
        if (activeTab === 'catalog' || activeTab === 'stock') fetchMenu();
      })
      .subscribe();

    return () => { supabase.removeChannel(subChannel); };
  }, [activeTab, analyticsRange, customRange]);


  function downloadCSV() {
    if (realStats.filteredOrders.length === 0) {
      showToast("No data available to download.");
      return;
    }

    const headers = ["Order ID", "Customer", "Phone", "Address", "Date", "Amount", "Kind", "Status", "Items"];
    const rows = realStats.filteredOrders.map(o => {
      const details = o.delivery_details || {};
      const address = [details.building, details.street, details.area].filter(Boolean).join(" ");
      const items = (o.order_items || []).map((i: any) => `${i.item_name} (x${i.quantity})`).join(" | ");
      
      return [
        o.order_number || o.id,
        o.customer_name || "Unknown",
        details.receiverPhone || "-",
        `"${address.replace(/"/g, '""')}"`, // Escape quotes for CSV
        new Date(o.created_at).toLocaleDateString("en-IN"),
        o.total,
        o.kind,
        o.status,
        `"${items.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TFB_Sales_Report_${analyticsRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadFinanceReport() {
    if (realStats.filteredOrders.length === 0) {
      showToast("No data available to generate finance report.");
      return;
    }

    const { totalRev, taxCollected, totalOrders } = stats;
    const netRev = totalRev - taxCollected;
    const taxRateStr = "5%";

    const regCount = realStats.filteredOrders.filter(o => o.kind === 'regular').length;
    const subCount = realStats.filteredOrders.filter(o => o.kind === 'personalized').length;
    const groupCount = realStats.filteredOrders.filter(o => o.kind === 'group').length;

    let csvContent = "TFB FINANCIAL & TAX REPORT\n";
    csvContent += `Generated On,${new Date().toLocaleDateString("en-IN")}\n`;
    csvContent += `Date Range,${analyticsRange.toUpperCase()}\n\n`;

    csvContent += "--- EXECUTIVE SUMMARY ---\n";
    csvContent += `Gross Revenue (INR),${totalRev}\n`;
    csvContent += `Total Tax Collected (INR) @ ${taxRateStr},${taxCollected}\n`;
    csvContent += `Net Revenue (INR),${netRev}\n\n`;

    csvContent += "--- ORDER BREAKDOWN ---\n";
    csvContent += `Total Orders Processed,${totalOrders}\n`;
    csvContent += `Regular Orders,${regCount}\n`;
    csvContent += `Subscription Orders,${subCount}\n`;
    csvContent += `Group Orders,${groupCount}\n\n`;

    // Detailed Ledger
    csvContent += "--- DETAILED TRANSACTION LEDGER ---\n";
    csvContent += "Date,Order ID,Customer,Gross Amount (INR),Tax (INR),Net (INR),Type\n";
    
    realStats.filteredOrders.forEach(o => {
      const amt = o.total || 0;
      const t = Math.round(amt - (amt / 1.05));
      const net = amt - t;
      csvContent += `${new Date(o.created_at).toLocaleDateString("en-IN")},${o.order_number || o.id},"${o.customer_name || 'Unknown'}",${amt},${t},${net},${o.kind}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFB_Finance_Report_${analyticsRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  async function deleteOrder(dbId: string) {
    if (!window.confirm("Are you sure you want to permanently remove this subscription?")) return;

    try {
      // 1. Hard-delete any daily delivery child orders linked to this subscription
      const { data: childOrders } = await supabase
        .from('orders')
        .select('id')
        .filter('meta->>subscription_id', 'eq', dbId);

      if (childOrders && childOrders.length > 0) {
        const childIds = childOrders.map((o: any) => o.id);
        await supabase.from('order_items').delete().in('order_id', childIds);
        await supabase.from('orders').delete().in('id', childIds);
      }

      // 2. Clear swap & hold records
      await supabase.from('subscription_swaps').delete().eq('subscription_id', dbId);
      await supabase.from('subscription_holds').delete().eq('subscription_id', dbId);

      // 3. Hard-delete the subscription itself from the subscriptions table
      //    Row gone = user's dashboard instantly shows nothing (no filtering games)
      const { error } = await supabase.from('subscriptions').delete().eq('id', dbId);

      if (error) {
        showToast("Error removing subscription: " + error.message);
      } else {
        showToast("Subscription permanently removed.");
        fetchSubscriptions();
      }
    } catch (err: any) {
      showToast("Unexpected error: " + (err.message || err));
    }
  }

  async function addBonusDays(subId: string, currentDuration: number, currentEndDate: string, days: number) {
    if (days === 0) return;
    const newDuration = currentDuration + days;
    // Calculate new end_date by adding/subtracting days from current end_date
    const endDate = new Date(currentEndDate);
    endDate.setDate(endDate.getDate() + days);
    const newEndDate = endDate.toISOString().slice(0, 10);

    const { error } = await supabase
      .from('subscriptions')
      .update({ duration_days: newDuration, end_date: newEndDate })
      .eq('id', subId);

    if (error) showToast("Error: " + error.message);
    else {
      showToast(`${days > 0 ? 'Added' : 'Removed'} ${Math.abs(days)} day(s) — plan now ends on ${newEndDate}`);
      fetchSubscriptions();
    }
  }


  // Manual Sub Modal State
  const [manualSubOpen, setManualSubOpen] = useState(false);
  const [msName, setMsName] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [msDuration, setMsDuration] = useState(30);
  const [msLoading, setMsLoading] = useState(false);

  // Future Order Modal State
  const [futureOrderOpen, setFutureOrderOpen] = useState(false);
  const [foName, setFoName] = useState("");
  const [foEmail, setFoEmail] = useState("");
  const [foPhone, setFoPhone] = useState("");
  const [foAddress, setFoAddress] = useState("");
  const [foDate, setFoDate] = useState("");
  const [foNote, setFoNote] = useState("");
  const [foItems, setFoItems] = useState<{id: string; name: string; qty: number; price: number; category: string}[]>([]);
  const [foLoading, setFoLoading] = useState(false);

  async function handleFutureOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!foName || !foEmail || !foDate) { showToast("Fill in name, email and delivery date."); return; }
    if (foItems.length === 0) { showToast("Add at least one menu item."); return; }
    setFoLoading(true);

    // Look up user
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

    // Fetch the inserted order id to attach items
    const { data: newOrder } = await supabase.from('orders').select('id').eq('order_number', orderNum).maybeSingle();
    if (newOrder?.id) {
      await supabase.from('order_items').insert(
        foItems.map(i => ({ order_id: newOrder.id, menu_item_id: i.id, item_name: i.name, quantity: i.qty, unit_price: i.price }))
      );
    }

    showToast(`Future order ${orderNum} scheduled for ${foDate}!`);
    setFutureOrderOpen(false);
    setFoName(""); setFoEmail(""); setFoPhone(""); setFoAddress(""); setFoDate(""); setFoNote(""); setFoItems([]);
    fetchOrders();
    setFoLoading(false);
  }

  // Search & Filter State
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subFilterType, setSubFilterType] = useState<'all' | 'active' | 'expired'>('active');

  async function handleManualSub(e: React.FormEvent) {
    e.preventDefault();
    if (!msName || !msEmail) { showToast("Please fill details"); return; }
    setMsLoading(true);
    
    // Find user by email
    const { data: profiles } = await supabase.from('profiles').select('id').eq('email', msEmail).single();
    if (!profiles) {
      showToast("User profile not found. Make sure the user has an account.");
      setMsLoading(false);
      return;
    }

    // ── Check for existing active subscription using the dedicated subscriptions table ──
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', profiles.id)
      .in('status', ['active', 'ready', 'preparing', 'new'])
      .maybeSingle();

    if (existingSub) {
      showToast("This user already has an active subscription. You cannot add multiple subscriptions for the same user.");
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

    const { error } = await supabase.from('subscriptions').insert({
      user_id: profiles.id,
      customer_name: msName,
      plan_name: "Manual Subscription",
      plan_type: "Lunch Only",
      duration_days: msDuration,
      start_date: startStr,
      end_date: endStr,
      status: 'active',
      schedule: scheduleLines,
      delivery_details: {
        receiverName: msName,
        receiverPhone: "",
        building: "Deliver at Home",
        street: "",
        area: ""
      },
      targets: { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 30 },
      meta: { is_manual: true, manual_order_number: `MAN-${Math.floor(Math.random() * 90000) + 10000}` },
      total: 0,
      payment_status: 'paid'
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
  const [parsedMenu, setParsedMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  async function fetchMenu() {
    setMenuLoading(true);
    const { data } = await supabase.from('menu_items').select('*').order('id');
    if (data) {
      setParsedMenu(data.map((d: any) => {
        const rawCat = d.category || '';
        let mappedCat = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) : 'Add-Ons';
        // Map legacy DB categories
        if (mappedCat === 'Breakfast') mappedCat = 'All-Day Kitchen';
        else if (mappedCat === 'Lunch' || mappedCat === 'Dinner') mappedCat = 'Midday-Midnight Kitchen';
        else if (mappedCat === 'Snack') mappedCat = 'Add-Ons';

        return {
          id: d.id, category: mappedCat, name: d.name, description: d.description,
          image: d.image_url, calories: d.calories, protein: d.protein, carbs: d.carbs,
          fat: d.fat, fiber: d.fiber, priceINR: d.price_inr, available: d.available
        };
      }) as MenuItem[]);
    }
    setMenuLoading(false);
  }
  // Initial data load moved to lazy tab effect above
  useEffect(() => {
    // We can still fetch the menu on mount if we want the Catalog to be ready immediately,
    // but with the lazy effect above, it's safer to just let the tab drive it.
  }, []);

  const BACKUPS_KEY = "tfb_menu_backups_v2";
  
  function loadMenuBackups(): any[] { 
      try { const raw = window.localStorage.getItem(BACKUPS_KEY); if (!raw) return []; const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } 
  }
  const [backups] = useState<any[]>(() => loadMenuBackups());
  const [simpleSearch, setSimpleSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<MenuDraft>(() => emptyDraft(""));
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("All");
  const [stockAvailabilityFilter, setStockAvailabilityFilter] = useState<string>("All");

  // Analytics Helpers
  const stats = useMemo(() => {
    const { totalRev, previousRev, totalOrders, previousOrders, filteredOrders } = realStats;
    
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
    const revenueGrowth = previousRev > 0 ? ((totalRev - previousRev) / previousRev) * 100 : 0;
    const orderGrowth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
    const taxCollected = Math.round(totalRev * 0.05); // Assuming 5% tax included

    // Aggregate Categories & Top Items
    const catCounts: Record<string, number> = {};
    const itemCounts: Record<string, { qty: number; revenue: number; uniqueCustomers: Set<string> }> = {};
    const cityCounts: Record<string, number> = {};
    const customerStats: Record<string, { revenue: number; orders: number }> = {};
    const subPlanDistribution: Record<string, number> = {};

    // Aggregate Monthly Revenue for MRR Chart (last 6 months)
    const monthlyRevMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleString('en-US', { month: 'short' });
      monthlyRevMap[mStr] = 0;
    }
    
    // Revenue Share over time (Stacked)
    const dailyVelocity: Record<string, { date: string; regular: number; subscription: number; group: number }> = {};

    filteredOrders.forEach(o => {
      // Categories
      const cat = o.kind === "personalized" ? "Health Plans" : (o.kind === "regular" ? "One-Time" : "Group Orders");
      catCounts[cat] = (catCounts[cat] || 0) + (o.total || 0);

      // Top Customers
      const cName = o.customer_name || "Guest";
      if (!customerStats[cName]) customerStats[cName] = { revenue: 0, orders: 0 };
      customerStats[cName].revenue += (o.total || 0);
      customerStats[cName].orders += 1;

      // Subscription Distribution
      if (o.kind === 'personalized' && o.status !== 'delivered') {
        const planName = o.delivery_details?.plan_name || "General Plan";
        subPlanDistribution[planName] = (subPlanDistribution[planName] || 0) + 1;
      }

      // Geographic (City/Area)
      const city = o.delivery_details?.city || o.delivery_details?.address?.split(',').pop()?.trim() || "Unknown";
      cityCounts[city] = (cityCounts[city] || 0) + (o.total || 0);

      // Items Performance (Revenue driven)
      (o.order_items || []).forEach((item: any) => {
        const name = item.item_name;
        if (!itemCounts[name]) itemCounts[name] = { qty: 0, revenue: 0, uniqueCustomers: new Set() };
        itemCounts[name].qty += (item.quantity || 1);
        itemCounts[name].revenue += (item.unit_price || 0) * (item.quantity || 1);
        if (o.customer_name) itemCounts[name].uniqueCustomers.add(o.customer_name);
      });

      // Daily Velocity for charts
      const dStr = new Date(o.created_at).toISOString().slice(5, 10); // MM-DD
      if (!dailyVelocity[dStr]) dailyVelocity[dStr] = { date: dStr, regular: 0, subscription: 0, group: 0 };
      if (o.kind === 'regular') dailyVelocity[dStr].regular += (o.total || 0);
      else if (o.kind === 'personalized') dailyVelocity[dStr].subscription += (o.total || 0);
      else if (o.kind === 'group') dailyVelocity[dStr].group += (o.total || 0);

      // Monthly Revenue
      if (o.created_at) {
        const d = new Date(o.created_at);
        const mStr = d.toLocaleString('en-US', { month: 'short' });
        if (monthlyRevMap[mStr] !== undefined) {
          monthlyRevMap[mStr] += (o.total || 0);
        }
      }
    });

    const topCats = Object.entries(catCounts).sort((a,b) => b[1] - a[1]);
    const topItems = Object.entries(itemCounts)
      .map(([name, data]) => ({ name, ...data, uniqueCustCount: data.uniqueCustomers.size }))
      .sort((a,b) => b.revenue - a.revenue)
      .slice(0, 10);

    const topCustomers = Object.entries(customerStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a,b) => b.revenue - a.revenue)
      .slice(0, 10);

    const subDist = Object.entries(subPlanDistribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    const geoData = Object.entries(cityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5);

    const monthlyRev = Object.entries(monthlyRevMap).map(([name, total]) => ({ name, total }));
    const velocityData = Object.values(dailyVelocity).sort((a, b) => a.date.localeCompare(b.date));

    return { 
      totalRev, 
      previousRev,
      avgOrderValue,
      revenueGrowth,
      orderGrowth,
      taxCollected,
      activeSubs: realStats.activeSubs,
      totalOrders,
      topCats, 
      topItems, 
      topCustomers,
      subDist,
      monthlyRev,
      geoData,
      velocityData
    };
  }, [realStats]);

  // Menu Publishing Logic
  async function saveMenu() {
    await fetchMenu();
    showToast("Live catalog is synced with Database!");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <LuxuryLabel text={`Operator: ${user?.name || 'Staff'}`} />
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Command Center</h1>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }} 
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500" 
                />
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 leading-none">Live Sync</span>
              </div>
            </div>
          </div>
          <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05)] hover:shadow-md">
            ← Back to Home
          </button>
        </div>
        
        <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
          <div className="inline-flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200 shadow-sm whitespace-nowrap">
            {[
              { id: "catalog", label: "Catalog" },
              { id: "stock", label: "Stock" },
              { id: "subscriptions", label: "Subscriptions" },
              { id: "all_orders", label: "All Orders" },
              { id: "orders", label: "Regular Orders" },
              { id: "group_orders", label: "Group Orders" },
              { id: "sub_orders", label: "Sub Orders" },
              { id: "customers", label: "Customers" },
              { id: "staff", label: "Staff" },
              { id: "dispatch", label: "Dispatch 🛵" },
              { id: "analytics", label: "Analytics" },
              { id: "settings", label: "Settings" }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all select-none",
                  activeTab === t.id
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50 ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      <AnimatePresence mode="wait">
        {activeTab === "catalog" && (
          <motion.div key="cat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
             {/* Original Catalog Logic */}
             <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <Card className="h-full border-sky-100 bg-sky-50/10">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <SectionTitle icon={Sparkles} title="Global Publishing" subtitle="Your changes are saved automatically to the database." />
                      <Button onClick={saveMenu} className="bg-sky-600 hover:bg-sky-700 h-10 px-8">Refresh Live View</Button>
                    </CardHeader>
                  </Card>
                </div>
                <div className="lg:col-span-4">
                  <Card className="h-full border-amber-100">
                    <CardHeader><SectionTitle icon={CalendarDays} title="Snapshots" subtitle="Backup & Restore" /></CardHeader>
                    <CardContent>
                      <select className="w-full rounded-xl border border-slate-200 p-2 text-sm bg-white">
                        <option>Choose a version...</option>
                        {backups.map(b => <option key={b.id}>{formatDateTimeIndia(b.at)}</option>)}
                      </select>
                    </CardContent>
                  </Card>
                </div>
             </div>

             <Card>
                <CardHeader><SectionTitle icon={UtensilsCrossed} title="Catalog Editor" subtitle="Modify individual item payloads." /></CardHeader>
                <CardContent className="grid lg:grid-cols-3 gap-8">
                    <div className="space-y-4 flex flex-col h-full">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <Input 
                            value={simpleSearch} 
                            onChange={e => setSimpleSearch(e.target.value)} 
                            placeholder="Search..." 
                            className="pl-10 bg-white w-full" 
                          />
                        </div>
                        <Button
                           onClick={() => {
                             setSelectedId("");
                             setDraft({
                               id: `NEW-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                               name: "New Item",
                               category: "All-Day Kitchen",
                               calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, priceINR: 0,
                               description: "", image: "", available: true
                             } as any);
                           }}
                           className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                        >
                           <Plus size={16} />
                        </Button>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                        {menuLoading ? (
                           Array.from({ length: 6 }).map((_, i) => (
                             <div key={i} className="mb-2">
                               <SkeletonMenuCard />
                             </div>
                           ))
                        ) : parsedMenu.filter(x => !simpleSearch || x.name.toLowerCase().includes(simpleSearch.toLowerCase())).map(x => (
                           <button 
                             key={x.id} 
                             onClick={() => { setSelectedId(x.id); setDraft(toDraft(x)); }}
                             className={cn("w-full p-4 rounded-xl border text-left transition-all", selectedId === x.id ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200")}
                           >
                              <div className="text-sm font-bold text-slate-900">{x.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{x.category} • {x.id}</div>
                           </button>
                        ))}
                      </div>
                   </div>
                   <div className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-200">
                      <div className="space-y-4">
                        <div className="grid gap-3">
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Item Name</label>
                              <Input value={draft.name || ""} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Oatmeal & Berries" className="text-sm font-bold bg-white" />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description</label>
                              <Input value={draft.description || ""} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Short appetizing description..." className="text-sm bg-white" />
                           </div>
                            <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Image</label>
                               <div className="flex gap-3 items-start">
                                 {
                                   /* thumbnail preview */
                                   draft.image && (
                                   <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                                     <img src={draft.image} alt="preview" className="w-full h-full object-cover" />
                                   </div>
                                   )
                                 }
                                 <div className="flex-1 space-y-2">
                                   <label
                                     className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50 text-sm text-slate-600 font-medium transition-colors"
                                   >
                                     <ImageUp size={16} className="text-emerald-600" />
                                     <span>Upload Image</span>
                                     <input
                                       type="file"
                                       accept="image/*"
                                       className="hidden"
                                       onChange={async (e) => {
                                         const file = e.target.files?.[0];
                                         if (!file) return;
                                         const ext = file.name.split('.').pop();
                                         const path = `${draft.id || Date.now()}.${ext}`;
                                         const { error: upErr } = await supabase.storage
                                           .from('menu-images')
                                           .upload(path, file, { upsert: true });
                                         if (upErr) { showToast('Upload failed: ' + upErr.message); return; }
                                         const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path);
                                         setDraft({ ...draft, image: urlData.publicUrl });
                                       }}
                                     />
                                   </label>
                                   <Input
                                     value={draft.image || ""}
                                     onChange={e => setDraft({...draft, image: e.target.value})}
                                     placeholder="Or paste URL..."
                                     className="text-xs bg-white"
                                   />
                                 </div>
                               </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          {["calories", "protein", "carbs", "fat", "fiber", "priceINR"].map(f => (
                            <div key={f}>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 truncate">{f === "priceINR" ? "Price (₹)" : f}</label>
                              <Input type="number" value={(draft as any)[f] || 0} onChange={e => setDraft({...draft, [f]: parseInt(e.target.value) || 0} as any)} className="text-sm font-medium bg-white px-2" />
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                            <select 
                              value={draft.category || "All-Day Kitchen"} 
                              onChange={e => setDraft({...draft, category: e.target.value as any})}
                              className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg py-1 px-3"
                            >
                              <option value="All-Day Kitchen">All-Day Kitchen</option>
                              <option value="Midday-Midnight Kitchen">Midday-Midnight Kitchen</option>
                              <option value="Add-Ons">Add-Ons</option>
                            </select>
                          </div>
                          <div className="w-px h-6 bg-slate-200" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={draft.available !== false}
                              onChange={(e) => setDraft({...draft, available: e.target.checked})}
                              className="hidden"
                            />
                            <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${draft.available !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${draft.available !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                              {draft.available !== false ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </label>
                        </div>


                        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                           <Button onClick={async () => {
                             const item = fromDraft(draft);
                             const { error } = await supabase.from('menu_items').upsert({
                               id: item.id, category: item.category, name: item.name, description: item.description,
                               image_url: item.image, calories: item.calories, protein: item.protein, carbs: item.carbs,
                               fat: item.fat, fiber: item.fiber, price_inr: item.priceINR, available: item.available
                             });
                             if (error) { showToast("Error saving: " + error.message); return; }
                             await fetchMenu();
                             showToast(`Saved ${item.name} to live database!`);
                           }}>Commit to Live DB</Button>
                           <Button variant="ghost" className="text-rose-600" onClick={async () => {
                             if (!confirm("Delete this item permanently?")) return;
                             const { error } = await supabase.from('menu_items').delete().eq('id', selectedId);
                             if (error) { showToast("Error deleting: " + error.message); return; }
                             await fetchMenu();
                             setSelectedId("");
                           }}>Remove Item</Button>
                        </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </motion.div>
        )}

        {activeTab === "stock" && (
           <motion.div key="stock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                   <SectionTitle icon={Archive} title="Stock Management" subtitle="Quickly toggle inventory availability." />
                   <Button onClick={saveMenu} className="bg-sky-600 hover:bg-sky-700 h-10 px-8 shadow-md">Publish Changes to Live Site</Button>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                     <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <Input value={simpleSearch} onChange={e => setSimpleSearch(e.target.value)} placeholder="Filter items by name..." className="bg-white md:w-64 shrink-0" />
                        
                        <div className="flex flex-wrap gap-2">
                           {["All", "All-Day Kitchen", "Midday-Midnight Kitchen", "Add-Ons"].map(c => (
                              <button 
                                key={c} 
                                onClick={() => setStockCategoryFilter(c)}
                                className={cn("text-xs font-bold rounded-lg py-1.5 px-3 transition-colors border", stockCategoryFilter === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100")}
                              >
                                {c}
                              </button>
                           ))}
                        </div>

                        <div className="w-px h-8 bg-slate-300 hidden md:block" />

                        <div className="flex flex-wrap gap-2 flex-grow">
                           {["All", "In Stock", "Out of Stock"].map(a => (
                              <button 
                                key={a} 
                                onClick={() => setStockAvailabilityFilter(a)}
                                className={cn("text-xs font-bold rounded-lg py-1.5 px-3 transition-colors border", stockAvailabilityFilter === a ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100")}
                              >
                                {a}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {menuLoading ? (
                           Array.from({ length: 8 }).map((_, i) => (
                             <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                               <Skeleton className="h-4 w-3/4" />
                               <Skeleton className="h-3 w-1/4" />
                               <div className="flex justify-end"><Skeleton className="h-6 w-10 rounded-full" /></div>
                             </div>
                           ))
                        ) : parsedMenu
                          .filter(x => !simpleSearch || x.name.toLowerCase().includes(simpleSearch.toLowerCase()))
                          .filter(x => stockCategoryFilter === "All" || x.category === stockCategoryFilter)
                          .filter(x => stockAvailabilityFilter === "All" || (stockAvailabilityFilter === "In Stock" ? x.available !== false : x.available === false))
                          .map(item => (
                           <div key={item.id} className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${item.available !== false ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300 opacity-60'}`}>
                              <div className="flex-1 truncate pr-4">
                                <div className={`text-sm font-bold truncate ${item.available !== false ? 'text-slate-900' : 'text-slate-500 line-through'}`} title={item.name}>{item.name}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">{item.category} • {item.id}</div>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${item.available !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {item.available !== false ? 'IN' : 'OUT'}
                                </span>
                                <input 
                                  type="checkbox" 
                                  checked={item.available !== false}
                                  onChange={async (e) => {
                                    const nextAvail = e.target.checked;
                                    setParsedMenu(prev => prev.map(x => x.id === item.id ? { ...x, available: nextAvail } : x));
                                    const { error } = await supabase.from('menu_items').update({ available: nextAvail }).eq('id', item.id);
                                    if(error) { alert("Error updating stock"); fetchMenu(); }
                                  }}
                                  className="hidden"
                                />
                                <div className={`w-10 h-6 flex flex-shrink-0 items-center rounded-full p-1 transition-colors ${item.available !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${item.available !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                              </label>
                           </div>
                        ))}
                     </div>
                  </div>
                </CardContent>
             </Card>
           </motion.div>
        )}

        {activeTab === "subscriptions" && (
          <motion.div key="subscriptions-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Card className="border-emerald-100 shadow-xl shadow-emerald-900/5">
              <CardHeader className="bg-emerald-50/30 border-b border-emerald-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <SectionTitle icon={Users} title="Today's Deliveries" subtitle="Manage personalized member plans." />
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search name, phone, ID..." 
                      value={subSearchQuery}
                      onChange={(e: any) => setSubSearchQuery(e.target.value)}
                      className="pl-9 h-9 w-64 text-sm bg-white/50 border-emerald-100"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['active', 'expired', 'all'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setSubFilterType(f)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                          subFilterType === f 
                            ? 'bg-white text-emerald-600 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <Button size="sm" onClick={() => setManualSubOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1 h-9 rounded-xl">
                    <UserPlus size={14} className="mr-1" /> Create Manual
                  </Button>
                  <Button size="sm" onClick={() => { setFutureOrderOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-xs py-1 h-9 rounded-xl">
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
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {delivery.building} {delivery.street} {delivery.area}
                                </div>

                                {/* Schedule Preview */}
                                {sub.schedule?.length > 0 && (
                                  <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Schedule:</p>
                                    <div className="grid grid-cols-2 gap-1">
                                      {sub.schedule.slice(0, 4).map((line: any, idx: number) => (
                                        <div key={idx} className="text-[10px] text-slate-600 truncate">
                                          • {line.day}: {line.label}
                                        </div>
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
                                <div className="text-[9px] text-slate-400">
                                  {formatDateIndia(sub.start_date)} → {formatDateIndia(sub.end_date)}
                                </div>
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
                                <input
                                  type="number"
                                  defaultValue="7"
                                  id={`days-${sub.id}`}
                                  className="w-8 bg-transparent text-xs font-bold text-center focus:outline-none"
                                />
                                <button
                                  onClick={() => {
                                    const el = document.getElementById(`days-${sub.id}`) as HTMLInputElement;
                                    const val = parseInt(el.value) || 0;
                                    addBonusDays(sub.id, sub.duration_days, sub.end_date, val);
                                  }}
                                  className="p-1 text-emerald-600 hover:bg-white rounded-lg transition-all"
                                  title="Add / Subtract Days"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>

                              {/* Pause / Resume */}
                              <button
                                onClick={async () => {
                                  const newStatus = sub.status === 'paused' ? 'active' : 'paused';
                                  const { error } = await supabase.from('subscriptions').update({ status: newStatus }).eq('id', sub.id);
                                  if (!error) { showToast(`Subscription ${newStatus === 'paused' ? 'paused' : 'resumed'}.`); fetchSubscriptions(); }
                                  else showToast('Error: ' + error.message);
                                }}
                                className={`p-2 rounded-lg transition-all ${sub.status === 'paused' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                                title={sub.status === 'paused' ? 'Resume' : 'Pause'}
                              >
                                {sub.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                              </button>

                              <button
                                onClick={() => deleteOrder(sub.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Subscription"
                              >
                                <Archive size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                  {!subsLoading && subscriptions.length === 0 && (
                    <div className="text-center py-20 text-slate-400 italic">No subscriptions found.</div>
                  )}
                </div>
              </CardContent>

            </Card>
          </motion.div>
        )}

        {/* ── All Orders Tab ── */}
        {activeTab === "all_orders" && (
          <motion.div key="all-orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AllOrdersTab 
              orders={orders} 
              ordersLoading={ordersLoading} 
              fetchOrders={fetchOrders} 
              showToast={showToast} 
              showMode="all" 
            />
          </motion.div>
        )}

        {/* ── Regular Orders Tab ── */}
        {activeTab === "orders" && (
          <motion.div key="regular-orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AllOrdersTab 
              orders={orders} 
              ordersLoading={ordersLoading} 
              fetchOrders={fetchOrders} 
              showToast={showToast} 
              showMode="regular" 
            />
          </motion.div>
        )}

        {/* ── Group Orders Tab ── */}
        {activeTab === "group_orders" && (
          <motion.div key="group-orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AllOrdersTab 
              orders={orders} 
              ordersLoading={ordersLoading} 
              fetchOrders={fetchOrders} 
              showToast={showToast} 
              showMode="group" 
            />
          </motion.div>
        )}

        {/* ── Sub Orders Tab ── */}
        {activeTab === "sub_orders" && (
          <motion.div key="sub-orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AllOrdersTab 
              orders={orders} 
              ordersLoading={ordersLoading} 
              fetchOrders={fetchOrders} 
              showToast={showToast} 
              showMode="auto-generated" 
            />
          </motion.div>
        )}

        {/* ── Future Order Modal ── */}
        <AnimatePresence>
          {futureOrderOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setFutureOrderOpen(false)}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-8 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black">Create Future Order</h2>
                        <p className="text-indigo-200 text-xs mt-0.5">Schedule a one-time order for a customer on a specific future date</p>
                      </div>
                    </div>
                    <button onClick={() => setFutureOrderOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleFutureOrder} className="p-6 space-y-5">
                  {/* Customer Details */}
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Customer Details</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Full Name *</label>
                        <Input value={foName} onChange={(e: any) => setFoName(e.target.value)} placeholder="Customer name" required />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Email *</label>
                        <Input value={foEmail} onChange={(e: any) => setFoEmail(e.target.value)} placeholder="user@email.com" type="email" required />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Phone</label>
                        <Input value={foPhone} onChange={(e: any) => setFoPhone(e.target.value)} placeholder="+91 98765 43210" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Address</label>
                        <Input value={foAddress} onChange={(e: any) => setFoAddress(e.target.value)} placeholder="Building / Street / Area" />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Date + Note */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Delivery Date *</label>
                      <input
                        type="date"
                        value={foDate}
                        min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                        onChange={e => setFoDate(e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Admin Note (optional)</label>
                      <Input value={foNote} onChange={(e: any) => setFoNote(e.target.value)} placeholder="Internal note about this order" />
                    </div>
                  </div>

                  {/* Item Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menu Items</div>
                      <div className="text-xs text-slate-500">{foItems.length} item{foItems.length !== 1 ? 's' : ''} selected</div>
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
                            <div className="flex items-center gap-2 shrink-0">
                              {existing ? (
                                <>
                                  <button type="button"
                                    onClick={() => setFoItems(prev => {
                                      const next = prev.map(i => i.id === m.id ? { ...i, qty: i.qty - 1 } : i);
                                      return next.filter(i => i.qty > 0);
                                    })}
                                    className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-black">
                                    −
                                  </button>
                                  <span className="text-sm font-black text-slate-900 w-5 text-center">{existing.qty}</span>
                                  <button type="button"
                                    onClick={() => setFoItems(prev => prev.map(i => i.id === m.id ? { ...i, qty: i.qty + 1 } : i))}
                                    className="w-7 h-7 rounded-lg bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-700 font-black">
                                    +
                                  </button>
                                  <button type="button"
                                    onClick={() => setFoItems(prev => prev.filter(i => i.id !== m.id))}
                                    className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center">
                                    <X size={13} />
                                  </button>
                                </>
                              ) : (
                                <button type="button"
                                  onClick={() => setFoItems(prev => [...prev, { id: m.id, name: m.name, qty: 1, price: m.priceINR || 0, category: m.category }])}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                  + Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Order Summary */}
                  {foItems.length > 0 && (() => {
                    const sub = foItems.reduce((s, i) => s + i.price * i.qty, 0);
                    const gst = Math.round(sub * 0.05);
                    return (
                      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Order Summary</div>
                        <div className="space-y-1.5 mb-3">
                          {foItems.map(i => (
                            <div key={i.id} className="flex justify-between text-sm">
                              <span className="text-slate-700">{i.name} × {i.qty}</span>
                              <span className="font-bold text-slate-900">₹{(i.price * i.qty).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-indigo-200 pt-2 space-y-1">
                          <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>₹{sub.toLocaleString('en-IN')}</span></div>
                          <div className="flex justify-between text-xs text-slate-500"><span>GST (5%)</span><span>₹{gst.toLocaleString('en-IN')}</span></div>
                          <div className="flex justify-between text-sm font-black text-slate-900"><span>Total</span><span>₹{(sub + gst).toLocaleString('en-IN')}</span></div>
                        </div>
                      </div>
                    );
                  })()}

                  <Button type="submit" disabled={foLoading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-black text-base">
                    {foLoading ? 'Scheduling…' : '📅 Schedule Future Order'}
                  </Button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === "staff" && (
          <motion.div key="staff-tab" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}>
            <StaffTab showToast={showToast} />
          </motion.div>
        )}

        {activeTab === "dispatch" as any && (
          <motion.div key="dispatch-tab" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}>
             <DispatchTab showToast={showToast} />
          </motion.div>
        )}


        {activeTab === "customers" && (
          <motion.div key="customers-tab" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}>
            <CustomersTab showToast={showToast} />
          </motion.div>
        )}

        {activeTab === "analytics" && (
          <motion.div key="analytics-tab" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex flex-col gap-1">
                <SectionTitle icon={BarChart3} title="Intelligence Center" subtitle="Institutional-grade performance insights." />
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                  {(["today", "yesterday", "this_week", "last_week", "30d", "1m", "custom"] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setAnalyticsRange(r)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all",
                        analyticsRange === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {r === "today" ? "Today" : r === "yesterday" ? "Yesterday" : r === "this_week" ? "This Week" : r === "last_week" ? "Last Week" : r === "30d" ? "30 Days" : r === "1m" ? "1 Month" : "Custom"}
                    </button>
                  ))}
                </div>

                {analyticsRange === "custom" && (
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <input 
                      type="date" 
                      value={customRange.start} 
                      onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-transparent border-none text-[10px] font-bold outline-none px-2"
                    />
                    <span className="text-slate-400 text-[10px] font-bold">to</span>
                    <input 
                      type="date" 
                      value={customRange.end} 
                      onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                      className="bg-transparent border-none text-[10px] font-bold outline-none px-2"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={downloadCSV} 
                    variant="outline" 
                    className="h-10 border-slate-200 hover:bg-slate-50 font-bold text-xs"
                  >
                    <Package size={14} className="mr-2" /> Dataset
                  </Button>
                  <Button 
                    onClick={downloadFinanceReport} 
                    variant="primary" 
                    className="h-10 bg-slate-900 hover:bg-slate-800 text-white shadow-sm font-bold text-xs"
                  >
                    <BarChart3 size={14} className="mr-2" /> Finance Report
                  </Button>
                </div>
              </div>
            </div>

            {/* KPI Overview Grid */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-100/50 rounded-[2.5rem]">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <TrendingUp size={24} className="text-emerald-200/50" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Net Revenue</span>
                  </div>
                  {statsLoading ? <Skeleton className="h-10 w-32 bg-white/20" /> : (
                    <div className="flex flex-col">
                      <div className="text-3xl font-black">₹{stats.totalRev.toLocaleString('en-IN')}</div>
                      <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-bold", stats.revenueGrowth >= 0 ? "text-emerald-200" : "text-rose-200")}>
                        {stats.revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(stats.revenueGrowth).toFixed(1)}% vs Prev
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 bg-white rounded-[2.5rem] shadow-sm">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <Package size={24} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Volume</span>
                  </div>
                  {statsLoading ? <Skeleton className="h-10 w-20" /> : (
                    <div className="flex flex-col">
                      <div className="text-3xl font-black text-slate-900">{stats.totalOrders}</div>
                      <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-bold", stats.orderGrowth >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {stats.orderGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(stats.orderGrowth).toFixed(1)}% Active
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 bg-white rounded-[2.5rem] shadow-sm">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <Sparkles size={24} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg. Order Value</span>
                  </div>
                  {statsLoading ? <Skeleton className="h-10 w-20" /> : (
                    <div className="flex flex-col">
                      <div className="text-3xl font-black text-slate-900">₹{stats.avgOrderValue}</div>
                      <div className="mt-2 text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-300" /> Ticket Size
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-100 bg-slate-50 rounded-[2.5rem] shadow-sm">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <ShieldCheck size={24} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Summary</span>
                  </div>
                  {statsLoading ? <Skeleton className="h-10 w-20" /> : (
                    <div className="flex flex-col">
                      <div className="text-3xl font-black text-slate-600">₹{stats.taxCollected.toLocaleString('en-IN')}</div>
                      <div className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-400" /> 5% GST Est.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Visualizations */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 rounded-[2.5rem] shadow-sm border-slate-100">
                <CardHeader className="p-8 pb-0">
                  <SectionTitle icon={TrendingUp} title="Revenue Velocity" subtitle="Daily revenue trends by order type." />
                </CardHeader>
                <CardContent className="p-8">
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.velocityData}>
                        <defs>
                          <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorSub" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" name="Regular" dataKey="regular" stackId="1" stroke="#6366f1" strokeWidth={3} fill="url(#colorReg)" />
                        <Area type="monotone" name="Subscription" dataKey="subscription" stackId="1" stroke="#10b981" strokeWidth={3} fill="url(#colorSub)" />
                        <Area type="monotone" name="Group" dataKey="group" stackId="1" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} fill="#f59e0b" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[2.5rem] shadow-sm border-slate-100 overflow-hidden">
                  <CardHeader className="p-8 pb-0">
                    <SectionTitle icon={MapPin} title="Market Segments" subtitle="Geographic revenue hotspots." />
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.geoData}
                            cx="50%" cy="50%"
                            innerRadius={50} outerRadius={70}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {stats.geoData.map((_, i) => (
                              <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'][i % 5]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                       {stats.geoData.map((item, i) => (
                         <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'][i % 5] }} />
                             <span className="text-slate-600 truncate max-w-[100px]">{item.name}</span>
                           </div>
                           <span className="text-slate-900">₹{item.value.toLocaleString()}</span>
                         </div>
                       ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
                  <CardHeader className="p-8 pb-0">
                    <SectionTitle icon={Users} title="Top Consumers" subtitle="By total revenue generated." />
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                       {stats.topCustomers.length > 0 ? stats.topCustomers.slice(0, 5).map((cust, i) => (
                         <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">{i+1}</div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{cust.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{cust.orders} orders</span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-indigo-600">₹{cust.revenue.toLocaleString()}</span>
                         </div>
                       )) : (
                         <div className="text-center py-4 text-slate-400 text-xs italic">No customer data.</div>
                       )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
                  <CardHeader className="p-8 pb-0">
                    <SectionTitle icon={Clock} title="Subscription Mix" subtitle="Active plans by type." />
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-3">
                       {stats.subDist.length > 0 ? stats.subDist.slice(0, 5).map((plan, i) => (
                         <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-600 truncate">{plan.name}</span>
                              <span className="text-slate-900">{plan.value} keys</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }} 
                                 animate={{ width: `${(plan.value / (stats.subDist.reduce((a,b) => a + b.value, 0) || 1)) * 100}%` }}
                                 className="h-full bg-indigo-500" 
                               />
                            </div>
                         </div>
                       )) : (
                         <div className="text-center py-4 text-slate-400 text-xs italic">No active subscriptions.</div>
                       )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Bottom Performance Leaderboard */}
            <Card className="rounded-[2.5rem] shadow-sm border-slate-100">
              <CardHeader className="p-8">
                <SectionTitle icon={ChefHat} title="Menu Performance Leaderboard" subtitle="Top 10 items by generated revenue in this period." />
              </CardHeader>
              <CardContent className="p-8 pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {stats.topItems.map((item, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative overflow-hidden group hover:border-indigo-200 transition-all">
                      <div className="text-[40px] font-black text-slate-200/50 absolute -right-2 -bottom-4 select-none group-hover:text-indigo-100 transition-colors">{i+1}</div>
                      <div className="relative z-10">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-tighter mb-1 truncate">{item.name}</div>
                        <div className="text-xl font-black text-slate-900">₹{item.revenue.toLocaleString()}</div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-[10px] font-bold text-indigo-500">{item.qty} units</div>
                          <div className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.uniqueCustCount} fans</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {stats.topItems.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 font-medium italic">Data pending for this timeframe.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {activeTab === "settings" && (
          <motion.div key="settings" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center justify-between">
                <SectionTitle icon={Settings} title="Global Features" subtitle="Manage application-wide toggles and settings" />
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings || !draftSettings}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                >
                  {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  Save Settings
                </Button>
              </div>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Chef's Inbox Chat</h3>
                    <p className="text-sm text-slate-500 mt-1">Enable or disable the real-time chat feature for customers and kitchen staff.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, chatEnabled: !d.chatEnabled } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.chatEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.chatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Regular Orders</h3>
                    <p className="text-sm text-slate-500 mt-1">Toggle the ability for customers to place one-time regular meal orders.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableRegularOrders: !d.enableRegularOrders } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableRegularOrders ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableRegularOrders ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Standard Delivery</h3>
                    <p className="text-sm text-slate-500 mt-1">Allow customers to choose standard home/office delivery for their orders.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableDelivery: !d.enableDelivery } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableDelivery ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableDelivery ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Store Pickup</h3>
                    <p className="text-sm text-slate-500 mt-1">Allow customers to pick up their orders directly from the physical store.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enablePickup: !d.enablePickup } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePickup ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePickup ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Personalized Subscriptions</h3>
                    <p className="text-sm text-slate-500 mt-1">Toggle the personalized meal plan subscription system.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enablePersonalizedSubscriptions: !d.enablePersonalizedSubscriptions } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePersonalizedSubscriptions ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePersonalizedSubscriptions ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Group Meals</h3>
                    <p className="text-sm text-slate-500 mt-1">Toggle the group booking and bulk ordering feature.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableGroupMeals: !d.enableGroupMeals } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableGroupMeals ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableGroupMeals ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Kitchen Real-time Status</h3>
                    <p className="text-sm text-slate-500 mt-1">Enable live sync indicators and pulse dots on the kitchen dashboard.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, kitchenRealtimeEnabled: !d.kitchenRealtimeEnabled } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.kitchenRealtimeEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.kitchenRealtimeEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Kitchen Prep Aggregation</h3>
                    <p className="text-sm text-slate-500 mt-1">Automatically total up ingredients to prep for today's active orders in Kitchen view.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableKitchenPrepAggregation: !d.enableKitchenPrepAggregation } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableKitchenPrepAggregation ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableKitchenPrepAggregation ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Health Preferences</h3>
                    <p className="text-sm text-slate-500 mt-1">Enable health goal selection and macro targets on profiles and dashboards.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableHealthPreferences: !d.enableHealthPreferences } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableHealthPreferences ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableHealthPreferences ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Email Login</h3>
                    <p className="text-sm text-slate-500 mt-1">Allow customers to log in or sign up using an email address and OTP.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enableEmailAuth: !d.enableEmailAuth } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableEmailAuth ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableEmailAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-slate-900">Phone Login</h3>
                    <p className="text-sm text-slate-500 mt-1">Allow customers to log in or sign up using a mobile number and SMS OTP.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, enablePhoneAuth: !d.enablePhoneAuth } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePhoneAuth ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePhoneAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <h3 className="font-bold text-rose-900">Maintenance Mode</h3>
                    <p className="text-sm text-rose-500 mt-1">If enabled, customers will see a maintenance message and won't be able to access the site.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, maintenanceMode: !d.maintenanceMode } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.maintenanceMode ? 'bg-rose-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
                  <div>
                    <h3 className="font-bold text-slate-900">Maintenance Bypass Emails</h3>
                    <p className="text-sm text-slate-500 mt-1">Comma-separated emails that can bypass the maintenance screen (e.g. testers, owners).</p>
                  </div>
                  <div className="mt-4">
                    <textarea
                      value={draftSettings?.maintenanceBypassEmails ?? ""}
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, maintenanceBypassEmails: e.target.value } : null)}
                      className="w-full p-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-20"
                      placeholder="email1@example.com, email2@example.com"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-slate-900">Rewards Program</h3>
                       <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Active</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Enable or disable the generic rewards and points system.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, rewardsEnabled: !d.rewardsEnabled } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.rewardsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.rewardsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-slate-900">Refer & Earn</h3>
                       <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase">Promo</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Manage the visibility of the referral and affiliate incentives program.</p>
                  </div>
                  <button
                    onClick={() => setDraftSettings(d => d ? { ...d, referralEnabled: !d.referralEnabled } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.referralEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.referralEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Order Cutoff Time (24h)</h3>
                    <p className="text-sm text-slate-500 mt-1">The hour after which next-day orders are locked (Max 10 PM / 22:00).</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={draftSettings?.orderCutoffHour ?? 22} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, orderCutoffHour: Math.max(0, Math.min(22, Number(e.target.value) || 0)) } : null)}
                      className="w-24 font-bold text-lg bg-white"
                      min="0"
                      max="22"
                    />
                    <span className="text-slate-500 font-medium">: 00</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Personalized Plan Discount (%)</h3>
                    <p className="text-sm text-slate-500 mt-1">Global discount applied to all personalized meal plans.</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={draftSettings?.personalizedDiscount ?? 0} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, personalizedDiscount: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : null)}
                      className="w-24 font-bold text-lg bg-white"
                      min="0"
                      max="100"
                    />
                    <span className="text-slate-500 font-medium">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Group Order Discount (%)</h3>
                    <p className="text-sm text-slate-500 mt-1">Global discount applied to all bulk/group orders.</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={draftSettings?.groupDiscount ?? 0} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, groupDiscount: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : null)}
                      className="w-24 font-bold text-lg bg-white"
                      min="0"
                      max="100"
                    />
                    <span className="text-slate-500 font-medium">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Tax Percentage (GST %)</h3>
                    <p className="text-sm text-slate-500 mt-1">Global tax rate applied at checkout.</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={draftSettings?.taxPercentage ?? 5} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, taxPercentage: Math.max(0, Math.min(28, Number(e.target.value) || 0)) } : null)}
                      className="w-24 font-bold text-lg bg-white"
                      min="0"
                      max="28"
                    />
                    <span className="text-slate-500 font-medium">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Delivery Fee (₹)</h3>
                      <p className="text-sm text-slate-500 mt-1">Flat delivery charge applied to every order/subscription.</p>
                    </div>
                    <button
                      onClick={() => setDraftSettings(d => d ? { ...d, freeDeliveryEnabled: !d.freeDeliveryEnabled } : null)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.freeDeliveryEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      title="Toggle Free Delivery Offer"
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.freeDeliveryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {draftSettings?.freeDeliveryEnabled && (
                    <div className="mt-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg inline-flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-700">Free Delivery Offer is Active!</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-slate-500 font-medium">₹</span>
                    <Input 
                      type="number" 
                      value={draftSettings?.deliveryFee ?? 0} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, deliveryFee: Math.max(0, Number(e.target.value) || 0) } : null)}
                      className="w-24 font-bold text-lg bg-white"
                      min="0"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Support Phone Number</h3>
                    <p className="text-sm text-slate-500 mt-1">The phone number customers will call for support.</p>
                  </div>
                  <div className="mt-4">
                    <Input 
                      value={draftSettings?.supportPhone ?? ""} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, supportPhone: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                      placeholder="+91 8008880000"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Support WhatsApp Number</h3>
                    <p className="text-sm text-slate-500 mt-1">The WhatsApp number (include country code, no + or spaces).</p>
                  </div>
                  <div className="mt-4">
                    <Input 
                      value={draftSettings?.supportWhatsApp ?? ""} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, supportWhatsApp: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                      placeholder="918008880000"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
                  <div>
                    <h3 className="font-bold text-slate-900">Physical Store Address</h3>
                    <p className="text-sm text-slate-500 mt-1">Address shown to customers when they select Store Pickup.</p>
                  </div>
                  <div className="mt-4">
                    <textarea 
                      value={draftSettings?.storeAddress ?? ""} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeAddress: e.target.value } : null)}
                      className="w-full font-bold bg-white text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="123 Health Ave..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
                  <div>
                    <h3 className="font-bold text-slate-900">Store Map Link / Coordinates</h3>
                    <p className="text-sm text-slate-500 mt-1">Google Maps URL or precise link to open map directions for pickup.</p>
                  </div>
                  <div className="mt-4">
                    <Input 
                      value={draftSettings?.storeMapUrl ?? ""} 
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeMapUrl: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                      placeholder="https://maps.google.com/?q=..."
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
                  <h3 className="font-bold text-slate-900 mb-4">Store Operating Hours</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-wider">
                        <span>Weekdays (Mon-Fri)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Opening Time</label>
                          <Input 
                            type="time"
                            value={draftSettings?.storeOpenWeekday ?? "06:00"} 
                            onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeOpenWeekday: e.target.value } : null)}
                            className="w-full font-bold bg-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Closing Time</label>
                          <Input 
                            type="time"
                            value={draftSettings?.storeCloseWeekday ?? "21:00"} 
                            onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeCloseWeekday: e.target.value } : null)}
                            className="w-full font-bold bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-wider">
                        <span>Weekends (Sat-Sun)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Opening Time</label>
                          <Input 
                            type="time"
                            value={draftSettings?.storeOpenWeekend ?? "09:00"} 
                            onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeOpenWeekend: e.target.value } : null)}
                            className="w-full font-bold bg-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Closing Time</label>
                          <Input 
                            type="time"
                            value={draftSettings?.storeCloseWeekend ?? "21:00"} 
                            onChange={(e: any) => setDraftSettings(d => d ? { ...d, storeCloseWeekend: e.target.value } : null)}
                            className="w-full font-bold bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
                  <h3 className="font-bold text-slate-900 mb-2 text-rose-600">Google Maps Platform Configuration</h3>
                  <p className="text-xs text-slate-500 mb-4">Required for exact customer location detection and address pin drops.</p>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Google Maps API Key</label>
                  <Input 
                    type="password"
                    value={draftSettings?.googleMapsApiKey ?? ""} 
                    onChange={(e: any) => setDraftSettings(d => d ? { ...d, googleMapsApiKey: e.target.value } : null)}
                    className="w-full font-bold bg-white"
                    placeholder="Enter your API Key"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900">Chef's Daily Note</h3>
                      <p className="text-sm text-slate-500 mt-1">A personalized greeting displayed on the user dashboard.</p>
                    </div>
                    <button
                      onClick={() => setDraftSettings(d => d ? { ...d, chefNoteEnabled: !d.chefNoteEnabled } : null)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.chefNoteEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.chefNoteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {draftSettings?.chefNoteEnabled && (
                    <textarea
                      value={draftSettings?.chefNote ?? ""}
                      onChange={(e: any) => setDraftSettings(d => d ? { ...d, chefNote: e.target.value } : null)}
                      className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Write something inspiring for your customers..."
                    />
                  )}
                  {!draftSettings?.chefNoteEnabled && (
                    <div className="text-sm text-slate-400 italic px-1">Chef note is currently hidden from customers.</div>
                  )}
                </div>

                {/* ── Auto Order Scheduler Card ── */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 col-span-full">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-indigo-900">Auto Subscription Order Generator</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${draftSettings?.autoOrderEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {draftSettings?.autoOrderEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-sm text-indigo-700 mt-1">
                        Automatically creates today's delivery orders for all active subscriptions at the scheduled time (IST).
                        Runs via Supabase cron — no browser needed. Duplicate-safe: already-generated orders are skipped.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        {/* Time Picker */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Daily Run Time (IST)</label>
                          <input
                            type="time"
                            value={draftSettings?.autoOrderTime ?? "05:00"}
                            onChange={e => setDraftSettings(d => d ? { ...d, autoOrderTime: e.target.value } : null)}
                            className="h-10 px-4 rounded-xl border border-indigo-200 bg-white font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </div>
                        {/* Status label */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Schedule</label>
                          <div className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-indigo-100 text-sm font-medium text-slate-700">
                            {draftSettings?.autoOrderEnabled
                              ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" /> Daily at {draftSettings.autoOrderTime} IST</>
                              : <><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Schedule disabled</>
                            }
                          </div>
                        </div>
                      </div>
                      {/* Last run result */}
                      {runNowResult && (
                        <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 ${runNowResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                          {runNowResult.success ? '✅' : '❌'}
                          <span>{runNowResult.message}</span>
                          {runNowResult.success && <><span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-black">{runNowResult.created} created</span><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-black">{runNowResult.skipped} skipped</span></>}
                        </div>
                      )}
                    </div>
                    {/* Right-side controls */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {/* Enable toggle */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-indigo-700">Enable</span>
                        <button
                          onClick={() => setDraftSettings(d => d ? { ...d, autoOrderEnabled: !d.autoOrderEnabled } : null)}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.autoOrderEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        >
                          <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.autoOrderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      {/* Run Now */}
                      <button
                        onClick={handleRunNow}
                        disabled={runNowLoading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200"
                      >
                        {runNowLoading ? <><RefreshCw size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Run Now</>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Enable Store Timing Logic</h3>
                      <p className="text-sm text-slate-500 mt-1">If enabled, the store will show as "Closed" outside of operating hours.</p>
                    </div>
                    <button
                      onClick={() => setDraftSettings(d => d ? { ...d, enableStoreTimings: !d.enableStoreTimings } : null)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableStoreTimings ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableStoreTimings ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualSubOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setManualSubOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute right-4 top-4">
                <button onClick={() => setManualSubOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-1">Manual Subscription</h2>
                <p className="text-sm text-slate-500 mb-6">Gift or manually add a personalized meal plan to a user's account.</p>

                <form onSubmit={handleManualSub} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
                    <Input placeholder="e.g. John Doe" value={msName} onChange={(e: any) => setMsName(e.target.value)} className="w-full" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">User Email (Lookup)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="user@example.com" value={msEmail} onChange={(e: any) => setMsEmail(e.target.value)} type="email" className="w-full pl-10" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days)</label>
                    <select 
                      value={msDuration}
                      onChange={e => setMsDuration(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                    >
                      <option value={7}>7 Days</option>
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={60}>60 Days</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={msLoading} loading={msLoading}>
                    <Plus size={16} className="mr-2" /> Create Subscription
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

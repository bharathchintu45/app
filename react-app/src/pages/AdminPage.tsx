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
  Clock,
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
  PieChart, Pie, Cell, Legend 
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
  const [filter, setFilter]             = useState<"all" | "admin" | "kitchen" | "customer">("all");

  // Invite form state
  const [invEmail,    setInvEmail]    = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invName,     setInvName]     = useState("");
  const [invRole,     setInvRole]     = useState<"kitchen" | "admin">("kitchen");
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
        import.meta.env.VITE_SUPABASE_URL || 'https://ijnigtjlphdeafstnrxk.supabase.co',
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
    role === "admin"   ? "bg-rose-100 text-rose-700"
    : role === "kitchen" ? "bg-amber-100 text-amber-700"
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
            {(["all", "admin", "kitchen", "customer"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                  filter === f
                    ? f === "admin"   ? "bg-rose-600 text-white border-rose-600"
                      : f === "kitchen" ? "bg-amber-500 text-white border-amber-500"
                      : f === "all"     ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-600 text-white border-slate-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}>
                {f === "all" ? "All Users" : f === "admin" ? "⚙ Admins" : f === "kitchen" ? "🍳 Kitchen" : "👤 Customers"}
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
                              <option value="admin">Administrator</option>
                            </select>
                            {(p.role === "kitchen" || p.role === "admin") && (
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

type MenuDraft = { id: string; category: Cat; name: string; calories: string; protein: string; carbs: string; fat: string; fiber: string; priceINR: string; available: boolean; description?: string; image?: string; };
const emptyDraft = (id: string): MenuDraft => ({ id, category: "Breakfast", name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", priceINR: "", available: true, description: "", image: "" });
const toDraft = (it: MenuItem): MenuDraft => ({ id: it.id, category: it.category, name: it.name, calories: String(Math.round(it.calories||0)), protein: String(Math.round(it.protein||0)), carbs: String(Math.round(it.carbs||0)), fat: String(Math.round(it.fat||0)), fiber: String(Math.round(it.fiber||0)), priceINR: it.priceINR===undefined||it.priceINR===null?"":String(Math.round(it.priceINR)), available: it.available !== false, description: it.description || "", image: it.image || "" });
const fromDraft = (d: MenuDraft): MenuItem => { const n = (s: string) => Number(digitsOnly(s||"")||"0"); const p = d.priceINR.trim()===""?undefined:n(d.priceINR); return { id: d.id.trim(), category: d.category, name: d.name.trim(), calories: n(d.calories), protein: n(d.protein), carbs: n(d.carbs), fat: n(d.fat), fiber: n(d.fiber), priceINR: p, available: d.available, description: d.description?.trim() || undefined, image: d.image?.trim() || undefined }; };

// ─── All Orders Tab ─────────────────────────────────────────────────────────
function AllOrdersTab({
  orders,
  ordersLoading,
  fetchOrders,
  showToast,
  forcedKind,
}: {
  orders: OrderReceipt[];
  ordersLoading: boolean;
  fetchOrders: () => void;
  showToast: (msg: string) => void;
  forcedKind?: "regular" | "group";
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "regular" | "personalized" | "group">(forcedKind || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "delivered" | "cancelled">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = orders.filter(o => {
    // Exclude auto-generated subscription daily delivery rows
    if (o.meta?.is_auto_generated) return false;

    // Kind filter
    if (forcedKind) {
      if (o.kind !== forcedKind) return false;
    } else {
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
            {/* Kind filter */}
            {!forcedKind && (
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
                          <div className="text-sm font-black text-slate-900">#{o.id}</div>
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
  } | null>(null);

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Initialize draft when settings load
  useEffect(() => {
    if (!chatSetting.loading && !personalizedDiscount.loading && !groupDiscount.loading && !taxSetting.loading &&
        !enableRegularOrders.loading && !enablePersonalizedSubscriptions.loading && !enableGroupMeals.loading &&
        !maintenanceSetting.loading && !cutoffSetting.loading) {
      if (!draftSettings) {
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
        });
      }
    }
  }, [
    chatSetting.loading, personalizedDiscount.loading, groupDiscount.loading, taxSetting.loading,
    enableRegularOrders.loading, enablePersonalizedSubscriptions.loading, enableGroupMeals.loading,
    maintenanceSetting.loading, cutoffSetting.loading, chefNoteSetting.loading, chefNoteEnabledSetting.loading,
    rewardsEnabled.loading, referralEnabled.loading, deliveryFeeSetting.loading, freeDeliverySetting.loading
  ]);

  async function handleSaveSettings() {
    if (!draftSettings) return;
    setIsSavingSettings(true);
    try {
      if (draftSettings.chatEnabled !== chatSetting.value) await chatSetting.toggle();
      if (draftSettings.enableRegularOrders !== enableRegularOrders.value) await enableRegularOrders.toggle();
      if (draftSettings.enablePersonalizedSubscriptions !== enablePersonalizedSubscriptions.value) await enablePersonalizedSubscriptions.toggle();
      if (draftSettings.enableGroupMeals !== enableGroupMeals.value) await enableGroupMeals.toggle();
      if (draftSettings.maintenanceMode !== maintenanceSetting.value) await maintenanceSetting.toggle();
      if (draftSettings.rewardsEnabled !== rewardsEnabled.value) await rewardsEnabled.toggle();
      if (draftSettings.referralEnabled !== referralEnabled.value) await referralEnabled.toggle();
      if (draftSettings.chefNoteEnabled !== chefNoteEnabledSetting.value) await chefNoteEnabledSetting.toggle();
      
      await personalizedDiscount.update(draftSettings.personalizedDiscount);
      await groupDiscount.update(draftSettings.groupDiscount);
      await taxSetting.update(draftSettings.taxPercentage);
      await cutoffSetting.update(draftSettings.orderCutoffHour);
      await chefNoteSetting.update(draftSettings.chefNote);
      await bypassEmailsSetting.update(draftSettings.maintenanceBypassEmails);
      await deliveryFeeSetting.update(draftSettings.deliveryFee);
      if (draftSettings.freeDeliveryEnabled !== freeDeliverySetting.value) await freeDeliverySetting.toggle();
      showToast("Settings saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  const [activeTab, setActiveTab] = useState<"catalog" | "stock" | "subscriptions" | "orders" | "group_orders" | "staff" | "analytics" | "settings">("catalog");
  const [analyticsRange, setAnalyticsRange] = useState<"30d" | "1m" | "6m" | "1y">("30d");

  // Orders State
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  async function fetchOrders() {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items ( id, menu_item_id, item_name, quantity, unit_price )`)
      .order('created_at', { ascending: false });
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
      setOrders(mapped);
    }
    setOrdersLoading(false);
  }

  // ─── Subscriptions State (dedicated subscriptions table) ─────────────────────
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  async function fetchSubscriptions() {
    setSubsLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSubscriptions(data);
    else if (error) console.error('[Admin] fetchSubscriptions error:', error);
    setSubsLoading(false);
  }

  // Load subscriptions whenever the subscriptions tab becomes active


  // ─── Real Revenue Stats from DB ───────────────────────────────────────────
  const [realStats, setRealStats] = useState({ 
    totalRev: 0, 
    activeSubs: 0, 
    totalOrders: 0, 
    todayOrders: 0,
    filteredOrders: [] as any[]
  });
  const [statsLoading, setStatsLoading] = useState(true);

  async function fetchRealStats() {
    setStatsLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    let filterDate = new Date();
    if (analyticsRange === "30d") filterDate.setDate(today.getDate() - 30);
    else if (analyticsRange === "1m") filterDate.setMonth(today.getMonth() - 1);
    else if (analyticsRange === "6m") filterDate.setMonth(today.getMonth() - 6);
    else if (analyticsRange === "1y") filterDate.setFullYear(today.getFullYear() - 1);
    
    const filterDateStr = filterDate.toISOString().slice(0, 10);

    // Fetch all paid orders for the range with items and delivery details
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total, kind, payment_status, status, created_at, customer_name, delivery_date, delivery_details, order_items(item_name, quantity, unit_price)')
      .eq('payment_status', 'paid')
      .gte('created_at', filterDateStr)
      .order('created_at', { ascending: false });

    if (data) {
      const totalRev = data.reduce((sum, o) => sum + (o.total || 0), 0);
      const activeSubs = data.filter(o => o.kind === 'personalized' && o.status !== 'delivered').length;
      const totalOrders = data.length;
      const todayOrders = data.filter(o => (o.created_at || '').startsWith(todayStr)).length;
      setRealStats({ totalRev, activeSubs, totalOrders, todayOrders, filteredOrders: data });
    }
    setStatsLoading(false);
  }

  useEffect(() => {
    if (activeTab === "analytics") fetchRealStats();
    if (activeTab === "subscriptions") fetchSubscriptions();
  }, [activeTab, analyticsRange]);

  // Real-time notifications for new subscriptions
  useEffect(() => {
    const subChannel = supabase.channel('admin-sub-alerts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'subscriptions' 
      }, payload => {
        showToast(`New Subscription: ${payload.new.customer_name} (${payload.new.plan_name})`);
        // Refresh list if we are on the subscriptions tab
        if (activeTab === 'subscriptions') fetchSubscriptions();
      })
      .subscribe();

    return () => { supabase.removeChannel(subChannel); };
  }, [activeTab]);


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
      .eq('status', 'active')
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
      setParsedMenu(data.map((d: any) => ({
        id: d.id, category: d.category, name: d.name, description: d.description,
        image: d.image_url, calories: d.calories, protein: d.protein, carbs: d.carbs,
        fat: d.fat, fiber: d.fiber, priceINR: d.price_inr, available: d.available
      })) as MenuItem[]);
    }
    setMenuLoading(false);
  }
  useEffect(() => { fetchMenu(); fetchOrders(); fetchRealStats(); }, []);

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
    const totalRev = realStats.filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const activeSubs = realStats.filteredOrders.filter(o => o.kind === "personalized" && o.status !== "delivered").length;
    
    // Aggregate Categories
    const catCounts: Record<string, number> = {};
    // Aggregate Top Items
    const itemCounts: Record<string, number> = {};

    // Aggregate Monthly Revenue for MRR Chart (last 6 months)
    const monthlyRevMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleString('en-US', { month: 'short' });
      monthlyRevMap[mStr] = 0; // initialize
    }
    
    realStats.filteredOrders.forEach(o => {
      // Categories
      const cat = o.kind === "personalized" ? "Health Plans" : (o.kind === "regular" ? "One-Time" : "Group Orders");
      catCounts[cat] = (catCounts[cat] || 0) + 1;

      // Items
      (o.order_items || []).forEach((i: any) => {
        itemCounts[i.item_name] = (itemCounts[i.item_name] || 0) + (i.quantity || 1);
      });

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
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5); // Get top 5

    const monthlyRev = Object.entries(monthlyRevMap).map(([name, total]) => ({ name, total }));

    return { totalRev, activeSubs, topCats, topItems, monthlyRev };
  }, [realStats.filteredOrders]);

  // Menu Publishing Logic
  async function saveMenu() {
    await fetchMenu();
    showToast("Live catalog is synced with Database!");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <LuxuryLabel text={`Operator: ${user?.name || 'Staff'}`} />
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Command Center</h1>
        </div>
        
        <div className="flex flex-wrap gap-1 self-start">
          {[
            { id: "catalog", label: "Catalog" },
            { id: "stock", label: "Stock" },
            { id: "subscriptions", label: "Subscriptions" },
            { id: "orders", label: "Regular Orders" },
            { id: "group_orders", label: "Group Orders" },
            { id: "staff", label: "Staff" },
            { id: "analytics", label: "Analytics" },
            { id: "settings", label: "Settings" }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                activeTab === t.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button variant="outline" onClick={onBack} className="bg-white">Exit Console</Button>
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
                               category: "Breakfast",
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
                              value={draft.category || "Breakfast"} 
                              onChange={e => setDraft({...draft, category: e.target.value as any})}
                              className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg py-1 px-3"
                            >
                              <option value="Breakfast">Breakfast</option>
                              <option value="Lunch">Lunch</option>
                              <option value="Dinner">Dinner</option>
                              <option value="Snack">Snack</option>
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
                           {["All", "Breakfast", "Lunch", "Dinner", "Snack"].map(c => (
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

        {/* ── Regular Orders Tab ── */}
        {activeTab === "orders" && (
          <motion.div key="regular-orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AllOrdersTab 
              orders={orders} 
              ordersLoading={ordersLoading} 
              fetchOrders={fetchOrders} 
              showToast={showToast} 
              forcedKind="regular" 
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
              forcedKind="group" 
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

        {activeTab === "analytics" && (
          <motion.div key="analytics-tab" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex flex-col gap-1">
                <SectionTitle icon={BarChart3} title="Sales Analytics" subtitle="Financial performance and order trends." />
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                  {(["30d", "1m", "6m", "1y"] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setAnalyticsRange(r)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        analyticsRange === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {r === "30d" ? "30 Days" : r === "1m" ? "1 Month" : r === "6m" ? "6 Months" : "1 Year"}
                    </button>
                  ))}
                </div>
                <Button 
                  onClick={downloadCSV} 
                  variant="outline" 
                  className="h-10 border-slate-200 hover:bg-slate-50 font-bold text-xs"
                >
                  <Package size={14} className="mr-2" /> Download Report (.csv)
                </Button>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200 rounded-[2rem]">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <TrendingUp size={24} className="text-emerald-200" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Revenue (Selected Period)</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-10 w-32 bg-emerald-400/30" />
                  ) : (
                    <div className="text-4xl font-black">₹{realStats.totalRev.toLocaleString('en-IN')}</div>
                  )}
                  <div className="mt-4 text-sm font-medium text-emerald-100 flex items-center gap-2">
                    <Check size={14} /> {realStats.totalOrders} paid orders lifetime
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-sky-100 bg-sky-50/30">
                <CardContent className="p-8">
                   <div className="flex items-center justify-between mb-4">
                    <Clock size={24} className="text-sky-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-800/50">Active Subs</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <div className="text-4xl font-black text-sky-900">{realStats.activeSubs}</div>
                  )}
                  <div className="mt-4 text-sm font-medium text-sky-600 flex items-center gap-2">
                    <Users size={14} /> Ongoing meal plans
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-100 bg-indigo-50/30">
                <CardContent className="p-8">
                   <div className="flex items-center justify-between mb-4">
                    <Package size={24} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800/50">Today's Orders</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <div className="text-3xl font-black text-indigo-900">{realStats.todayOrders}</div>
                  )}
                  <div className="mt-4 text-sm font-medium text-indigo-600 flex items-center gap-2">
                    <BarChart3 size={14} /> Placed today
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
               <Card className="col-span-full">
                 <CardHeader><SectionTitle icon={TrendingUp} title="Monthly Recurring Revenue (MRR)" subtitle="Revenue trends over the last 6 months." /></CardHeader>
                 <CardContent>
                    <div className="h-[300px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.monthlyRev}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            tickFormatter={(value) => `₹${value / 1000}k`}
                            dx={-10}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                          />
                          <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader><SectionTitle icon={PieChart} title="Category Distribution" subtitle="Orders by subscription type." /></CardHeader>
                 <CardContent>
                    <div className="h-[250px] w-full mt-4 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.topCats.map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {stats.topCats.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader><SectionTitle icon={Sparkles} title="Most Sold Items" subtitle="Trending choices in the current period." /></CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                       {stats.topItems.length > 0 ? stats.topItems.map(([name, count], i) => (
                         <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{i+1}</div>
                              <div className="text-sm font-bold text-slate-900">{name}</div>
                           </div>
                           <div className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{count} Sold</div>
                         </div>
                       )) : (
                         <div className="text-center py-10 text-slate-400 italic">No item data found for this range.</div>
                       )}
                    </div>
                 </CardContent>
               </Card>
            </div>
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

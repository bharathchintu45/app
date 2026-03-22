import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, 
  UserPlus, 
  ShieldCheck, 
  ChefHat, 
  Mail, 
  UserX, 
  EyeOff, 
  Eye, 
  KeyRound, 
  X 
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { SkeletonTableRow } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { UserRole } from "../../types";

interface StaffProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

interface StaffTabProps {
  showToast: (msg: string) => void;
}

export default function StaffTab({ showToast }: StaffTabProps) {
  const [profiles, setProfiles]         = useState<StaffProfile[]>([]);
  const [loading, setLoading]           = useState(false);
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [filter, setFilter]             = useState<"all" | "admin" | "manager" | "kitchen" | "delivery" | "customer">("all");

  // Invite form state
  const [invEmail,    setInvEmail]    = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invName,     setInvName]     = useState("");
  const [invRole,     setInvRole]     = useState<"kitchen" | "admin" | "delivery" | "manager">("kitchen");
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
    const { error } = await api.v1.manageStaff({
      action: 'update_role',
      userId: userId,
      role: newRole
    });
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
      const { error } = await api.v1.manageStaff({
        action: 'create',
        email: invEmail,
        password: invPassword,
        name: invName.trim(),
        role: invRole
      });

      if (error) throw new Error(error.message || "Failed to create staff account.");

      setInvSuccess(`✅ ${invName} added as ${invRole}. They can now log in with the provided credentials.`);
      setInvEmail(""); setInvPassword(""); setInvName("");
      await fetchProfiles();
    } catch (err: any) {
      setInvError(err.message || "Failed to create staff account.");
    }
    setInvLoading(false);
  }

  function resetInvite() {
    setInviteOpen(false); setInvEmail(""); setInvPassword(""); setInvName(""); setInvError(""); setInvSuccess(""); setShowPw(false);
  }
  
  function setInvOpenInternal(v: boolean) { 
    setInviteOpen(v); 
    if (!v) { setInvError(""); setInvSuccess(""); } 
  }

  const filtered = profiles.filter(p => filter === "all" || p.role === filter);

  const roleBadge = (role: UserRole) => cn(
    "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
    role === "admin"    ? "bg-rose-100 text-rose-700"
    : role === "manager"  ? "bg-indigo-100 text-indigo-700"
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
            <Button onClick={() => setInvOpenInternal(true)} className="h-9 bg-emerald-600 hover:bg-emerald-700">
              <UserPlus size={14} className="mr-2" /> Invite Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "admin", "manager", "kitchen", "delivery", "customer"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                  filter === f
                    ? f === "admin"    ? "bg-rose-600 text-white border-rose-600"
                      : f === "manager"  ? "bg-indigo-600 text-white border-indigo-600"
                      : f === "kitchen"  ? "bg-amber-500 text-white border-amber-500"
                      : f === "delivery" ? "bg-emerald-600 text-white border-emerald-600"
                      : f === "all"      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-600 text-white border-slate-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}>
                {f === "all" ? "All Users" : f === "admin" ? "⚙ Admins" : f === "manager" ? "💼 Managers" : f === "kitchen" ? "🍳 Kitchen" : f === "delivery" ? "🛵 Delivery" : "👤 Customers"}
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
                                <option value="manager">Ops Manager</option>
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
              onClick={() => setInvOpenInternal(false)}
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
                    <Button className="mt-6 w-full" onClick={() => { setInvSuccess(""); setInvOpenInternal(true); }}>
                      Add Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-4">
                    {/* Role selector */}
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                      {(["kitchen", "manager", "admin"] as const).map(r => (
                        <button key={r} type="button" onClick={() => setInvRole(r)}
                          className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                            invRole === r
                              ? r === "kitchen" ? "bg-amber-500 text-white shadow-sm" : r === "manager" ? "bg-indigo-600 text-white shadow-sm" : "bg-rose-600 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}>
                          {r === "kitchen" ? <ChefHat size={14} /> : <ShieldCheck size={14} />}
                          {r === "kitchen" ? "Kitchen" : r === "manager" ? "Manager" : "Admin"}
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

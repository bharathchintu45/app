import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Search, RefreshCw, Image as ImageIcon } from "lucide-react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { SectionTitle } from "../ui/Typography";
import { SkeletonTableRow } from "../ui/Skeleton";
import { formatDateIndia } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { OrderReceipt } from "../../types";

interface AllOrdersTabProps {
  showToast: (msg: string) => void;
  showMode?: "all" | "regular" | "group" | "auto-generated";
}

export default function AllOrdersTab({
  showToast,
  showMode,
}: AllOrdersTabProps) {
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "regular" | "personalized" | "group">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "delivered" | "cancelled">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
       showToast("Error fetching orders: " + error.message);
    } else if (data) {
       // Map to OrderReceipt structure if necessary, though the structure seems similar
       const mapped: OrderReceipt[] = data.map((o: any) => ({
         id: o.id,
         dbId: o.id,
         orderNumber: o.order_number,
         createdAt: o.created_at,
         deliveryAtLabel: o.delivery_date,
         kind: o.kind,
         status: o.status,
         payment: o.payment_status,
         customer: o.delivery_details,
         meta: o.meta,
         headline: o.meta?.headline || "",
         priceSummary: {
           subtotal: o.subtotal || 0,
           gst: o.gst_amount || 0,
           gstRate: 0.05,
           deliveryFee: 0,
           total: o.total || 0
         },
         lines: (o.order_items || []).map((i: any) => ({
           label: i.item_name,
           qty: i.quantity,
           unitPriceAtOrder: i.unit_price
         }))
       }));
       setOrders(mapped);
    }
    setOrdersLoading(false);
  }


  const filtered = orders.filter(o => {
    // 1. Handle auto-generated logic based on showMode
    if (showMode === "all") {
      // Show everything, do not filter out is_auto_generated
    } else if (showMode === "auto-generated") {
      if (!o.meta?.is_auto_generated) return false;
    } else if (showMode !== undefined) {
      // Strict behavior for "regular", "group"
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
      const sub = orders.find(o => o.id === dbId) || ({} as any);
      const [_, subId, _slot, dateStr] = dbId.split("-");
      
      const { error } = await api.v1.updateOrder({
        orderId: dbId,
        action: 'solidify',
        data: {
          subId,
          dateStr,
          userId: sub.meta?.user_id,
          customer: sub.customer,
          lines: sub.lines,
          orderNumber: sub.orderNumber || sub.meta?.orderNumber || `SUB-${subId.slice(-6).toUpperCase()}`
        }
      });

      if (error) {
        showToast("Error creating delivery order: " + error.message);
      } else {
        showToast("Order status updated to " + newStatus);
        fetchOrders();
      }
      return;
    }

    const { error } = await api.v1.updateOrder({ orderId: dbId, action: 'update_status', data: { status: newStatus } });
    if (error) showToast("Error: " + error.message);
    else { showToast("Status updated to " + newStatus); fetchOrders(); }
  }

  async function updatePaymentStatus(dbId: string, newPaymentStatus: string) {
    const { error } = await api.v1.updateOrder({ orderId: dbId, action: 'update_payment', data: { status: newPaymentStatus } });
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
                    <React.Fragment key={o.id}>
                      <tr className="bg-white hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
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
                        <tr className="bg-slate-50/60 border-b border-slate-100">
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
                              {/* Proof */}
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Proof of Delivery</div>
                                {o.meta?.proof_image_url ? (
                                  <div className="relative group">
                                    <div className="aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm transition-transform group-hover:scale-[1.05] cursor-zoom-in">
                                      <img 
                                        src={o.meta.proof_image_url} 
                                        alt="Proof of Delivery"
                                        className="w-full h-full object-cover"
                                        onClick={() => window.open(o.meta.proof_image_url, '_blank')}
                                      />
                                    </div>
                                    <div className="mt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                      <span>✅ Verified</span>
                                      {o.meta.delivered_at_iso && <span className="text-slate-400 font-medium">· {new Date(o.meta.delivered_at_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-24 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                                    <ImageIcon size={20} className="mb-1" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">No Proof</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

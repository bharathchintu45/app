import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { X, Save, User, Phone, MapPin, FileText, Calendar, Package, CheckCircle2, Clock } from "lucide-react";
import { formatDateIndia } from "../../lib/format";
import type { OrderReceipt } from "../../types";

const STATUS_OPTIONS = [
  { value: "pending", label: "New", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "preparing", label: "Preparing", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "ready", label: "Ready", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "out_for_delivery", label: "Out for Delivery", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "delivered", label: "Delivered", color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-rose-100 text-rose-600 border-rose-200" },
];

function statusToDb(uiStatus: string): string {
  if (uiStatus === "New") return "pending";
  if (uiStatus === "Out for delivery") return "out_for_delivery";
  return uiStatus.toLowerCase();
}

export function OrderEditModal({
  order,
  onClose,
  onSaved,
}: {
  order: OrderReceipt;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [customerName, setCustomerName] = useState(order.customer?.receiverName || "");
  const [customerPhone, setCustomerPhone] = useState(order.customer?.receiverPhone || "");
  const [building, setBuilding] = useState(order.customer?.building || "");
  const [area, setArea] = useState(order.customer?.area || "");
  const [street, setStreet] = useState(order.customer?.street || "");
  const [locationType, setLocationType] = useState(order.customer?.locationType || "Home");
  const [instructions, setInstructions] = useState(order.customer?.instructions || "");
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryAtLabel || "");
  // Format existing timestamp to HH:mm for the time input if it exists
  const initialEta = order.estimatedArrival 
    ? new Date(order.estimatedArrival).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : "";
  const [estimatedArrival, setEstimatedArrival] = useState(initialEta);
  const [status, setStatus] = useState(statusToDb(order.status || "New"));

  async function handleSave() {
    setSaving(true);
    const deliveryDetails = {
      receiverName: customerName,
      receiverPhone: customerPhone,
      building,
      area,
      street,
      locationType,
      instructions,
    };

    let etaTimestamp = null;
    if (estimatedArrival && deliveryDate) {
      // Create a local Date object combining the date and time, then convert to ISO
      const dt = new Date(`${deliveryDate}T${estimatedArrival}:00`);
      etaTimestamp = dt.toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update({
        customer_name: customerName,
        delivery_details: deliveryDetails,
        delivery_date: deliveryDate || undefined,
        status,
        estimated_arrival: etaTimestamp
      })
      .eq("id", order.id);

    setSaving(false);
    if (error) {
      alert("Error saving: " + error.message);
    } else {
      setSaved(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 600);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-3xl">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Edit Order</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              #{order.orderNumber || order.id.slice(0, 8)} · {order.kind}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Order Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 transition-all ${
                    status === opt.value
                      ? opt.color + " ring-2 ring-offset-1 ring-slate-300 scale-105"
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Customer Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Delivery Address
            </div>

            <div className="flex gap-2 mb-2">
              {(["Home", "Office", "Other"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLocationType(t as any)}
                  className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-lg border transition-all ${
                    locationType === t
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Building / Flat</label>
                <input
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Street</label>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Area / Landmark</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
          </div>

          {/* Notes + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" /> Delivery Notes
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none"
                placeholder="Special instructions..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5" /> Delivery Date
              </label>
              <div 
                className="relative cursor-pointer" 
                onClick={() => {
                  const el = document.getElementById("edit-date-picker");
                  if (el && 'showPicker' in el) (el as any).showPicker();
                  else el?.click();
                }}
              >
                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                  {formatDateIndia(deliveryDate)}
                </div>
                <input
                  id="edit-date-picker"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" /> ETA (Estimated Arrival)
              </label>
              <input
                type="time"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
          </div>

          {/* Items (Read-only) */}
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Package className="w-3.5 h-3.5" /> Order Items ({order.lines.length})
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-[150px] overflow-y-auto">
              {order.lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-black text-slate-900 w-7 text-right shrink-0">×{l.qty}</span>
                  <span className="font-semibold text-slate-700">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex gap-3 rounded-b-2xl sm:rounded-b-3xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm ${
              saved
                ? "bg-emerald-500 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            ) : saving ? (
              "Saving..."
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

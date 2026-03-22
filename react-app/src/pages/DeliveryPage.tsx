import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../types";
import { MapPin, Navigation, X, AlertTriangle, MessageCircle, CheckCircle, Package, Truck, Phone } from "lucide-react";
import { useAppSettingString } from "../hooks/useAppSettings";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { formatTimeIndia } from "../lib/format";

export function DeliveryPage({ user, onBack, showToast }: { user: AppUser | null, onBack: () => void, showToast: (msg: string) => void }) {
  const supportPhoneRes = useAppSettingString("support_phone", "08500929080");

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
  
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [verifyingAssignment, setVerifyingAssignment] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Failure Modal State
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failingAssignment, setFailingAssignment] = useState<any>(null);
  const [failReason, setFailReason] = useState("");
  const [isFailing, setIsFailing] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData(true);

    const channel = supabase.channel('delivery-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData(false))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function fetchData(isInitial = false) {
    if (isInitial) setLoading(true);
    
    const { data: bData } = await supabase.from('delivery_boys').select('*').eq('profile_id', user?.id).single();
    if (bData) setDeliveryBoy(bData);

    const boyId = bData?.id;
    if (boyId) {
      const { data: aData } = await supabase
        .from('delivery_assignments')
        .select(`
          id, status, assigned_at, order_id, delivery_notes, delivered_at,
          orders ( order_number, customer_name, delivery_details, status, id, meta, kind, order_items ( item_name, quantity ) )
        `)
        .eq('delivery_boy_id', boyId)
        .order('assigned_at', { ascending: false })
        .limit(50);

      if (aData) setAssignments(aData);
    }
    setLoading(false);
  }

  async function updateStatusCore(assignmentId: string, newStatus: string) {
    const { error: aError } = await supabase.from('delivery_assignments').update({ status: newStatus }).eq('id', assignmentId);
    if (aError) {
      showToast('Error updating status: ' + aError.message);
      return false;
    }
    fetchData();
    return true;
  }

  async function updateStatus(assignmentId: string, newStatus: string) {
    let metaUpdate: Record<string, any> = {};
    if (newStatus === 'picked_up') {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (assignment?.order_id) {
        const { data: order } = await supabase.from('orders').select('meta').eq('id', assignment.order_id).single();
        const currentMeta = order?.meta || {};
        
        // Only generate OTP if one doesn't already exist
        const generatedOtp = currentMeta.delivery_otp || Math.floor(1000 + Math.random() * 9000).toString();
        metaUpdate = { delivery_otp: generatedOtp };
        
        await supabase.from('orders').update({ 
          meta: { ...currentMeta, ...metaUpdate },
          status: 'out_for_delivery'
        }).eq('id', assignment.order_id);
      }
      showToast(`✅ Order marked as Picked Up.`);
    }
    await updateStatusCore(assignmentId, newStatus);
  }

  async function handleDeliverClick(assignment: any) {
    setVerifyingAssignment(assignment);
    setOtpValue("");
    setOtpModalOpen(true);
    setTimeout(() => otpInputRef.current?.focus(), 150);
  }

  async function confirmDelivery() {
    if (!verifyingAssignment) return;
    setIsVerifying(true);

    const orderId = verifyingAssignment.order_id;
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    
    const correctOtp = order?.meta?.delivery_otp;
    
    if (otpValue === correctOtp) {
      await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
      const ok = await updateStatusCore(verifyingAssignment.id, 'delivered');
      if (ok) {
        setOtpModalOpen(false);
        showToast("✅ Delivery successful!");
      }
    } else {
      showToast("❌ Incorrect PIN. Please try again.");
    }
    setIsVerifying(false);
  }

  function handleFailedClick(assignment: any) {
    setFailingAssignment(assignment);
    setFailReason("");
    setFailModalOpen(true);
  }

  async function confirmFailure() {
    if (!failingAssignment) return;
    setIsFailing(true);

    const orderId = failingAssignment.order_id;
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    const newMeta = { ...(order?.meta || {}), cancellation_reason: failReason || "No reason provided", cancelled_by: 'delivery' };

    await supabase.from('orders').update({ status: 'cancelled', meta: newMeta }).eq('id', orderId);
    
    // We intentionally don't update delivery_assignments status to 'cancelled' to avoid DB constraint issues
    // The active/delivered lists will filter out cancelled orders automatically
    fetchData(); 
    
    setFailModalOpen(false);
    showToast("⚠️ Delivery marked as failed.");
    setIsFailing(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse"></div>
               <div className="space-y-2">
                 <div className="w-24 h-4 rounded bg-slate-200 animate-pulse"></div>
                 <div className="w-16 h-3 rounded bg-slate-200 animate-pulse"></div>
               </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse"></div>
          </div>
        </div>
        <div className="max-w-xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-3 mb-8">
             <div className="bg-white h-24 rounded-2xl border border-gray-100 animate-pulse"></div>
             <div className="bg-white h-24 rounded-2xl border border-gray-100 animate-pulse"></div>
             <div className="bg-white h-24 rounded-2xl border border-gray-100 animate-pulse"></div>
          </div>
          <div className="space-y-4 w-full mt-6">
             <div className="w-1/3 h-5 bg-slate-200 rounded animate-pulse mb-4"></div>
             <div className="bg-white p-5 rounded-3xl border border-slate-100 h-48 animate-pulse shadow-sm"></div>
             <div className="bg-white p-5 rounded-3xl border border-slate-100 h-48 animate-pulse shadow-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!deliveryBoy) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Not Linked</h2>
        <p className="text-gray-600 mb-6 max-w-sm">Your delivery partner account has not been fully set up. Please contact the administrator.</p>
        <Button onClick={onBack} variant="outline">Return Home</Button>
      </div>
    );
  }

  const active = assignments.filter(a => {
    const order = Array.isArray(a.orders) ? a.orders[0] : a.orders;
    if (order?.status === 'cancelled') return false;
    return a.status === 'assigned' || a.status === 'picked_up' || a.status === 'out_for_delivery';
  });

  const delivered = assignments.filter(a => {
    const order = Array.isArray(a.orders) ? a.orders[0] : a.orders;
    if (order?.status === 'cancelled') return false;
    return a.status === 'delivered';
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
               <Truck size={20} />
             </div>
             <div>
               <h1 className="text-lg font-bold leading-tight">Delivery Hub</h1>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                 <span className="text-xs font-medium text-gray-500">Online & Active</span>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`tel:${supportPhoneRes.value}`} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors text-xs font-bold uppercase tracking-widest">
              <Phone size={14} /> Support
            </a>
            <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
           <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
              <span className="text-gray-500 text-xs font-medium mb-1">Today's Earnings</span>
              <span className="text-lg font-bold text-gray-900">₹940</span>
           </div>
           <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
              <span className="text-gray-500 text-xs font-medium mb-1">Delivered</span>
              <span className="text-lg font-bold text-gray-900">{delivered.length}</span>
           </div>
           <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
              <span className="text-gray-500 text-xs font-medium mb-1">Rating</span>
              <span className="text-lg font-bold text-gray-900">4.9</span>
           </div>
        </div>

        {/* Active Assignments */}
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Active Orders ({active.length})</h2>

        {active.length === 0 ? (
           <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Package size={28} />
             </div>
             <h3 className="text-gray-900 font-semibold mb-1">No pending orders</h3>
             <p className="text-gray-500 text-sm">You'll receive a notification when a new order is assigned to you.</p>
           </div>
        ) : (
           <div className="space-y-4">
             {active.map(a => {
                const order = Array.isArray(a.orders) ? a.orders[0] : a.orders;
                const details = order?.delivery_details || {};
                const isPickedUp = a.status === 'picked_up' || a.status === 'out_for_delivery';
                const mapUri = details.lat ? `https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([details.building, details.street, details.area].filter(Boolean).join(", ") || "")}`;

                return (
                  <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                       <span className="font-semibold text-gray-900">Order #{order?.order_number || order?.id?.slice(0,6)}</span>
                       <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                         {isPickedUp ? 'Out for Delivery' : 'Assigned'}
                       </span>
                    </div>

                    <div className="p-5">
                       {/* Pickup Details */}
                       <div className="flex gap-4 mb-6 relative">
                         {/* Connecting line */}
                         <div className="absolute left-[11px] top-6 bottom-[-30px] w-0.5 bg-gray-200"></div>
                         
                         <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10", isPickedUp ? "bg-gray-200 text-gray-500" : "bg-emerald-500 text-white")}>
                           <Package size={14} />
                         </div>
                         <div>
                           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pickup From</p>
                           <p className="font-semibold text-gray-900">The Fit Bowls Hub</p>
                           <p className="text-sm text-gray-600">Kitchen HQ · Sector 44</p>
                         </div>
                       </div>

                       {/* Delivery Details */}
                       <div className="flex gap-4">
                         <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10", isPickedUp ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500")}>
                           <MapPin size={14} />
                         </div>
                         <div className="flex-1">
                           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deliver To</p>
                           <p className="font-semibold text-gray-900">{order?.customer_name || "Customer"}</p>
                           <p className="text-sm text-gray-800 font-medium mb-1">{details.receiverPhone || "No phone provided"}</p>
                           <p className="text-sm text-gray-600 line-clamp-2">
                             {details.locationType && <span className="inline-block bg-gray-200 text-gray-800 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mr-1.5">{details.locationType}</span>}
                             {details.building}, {details.street ? details.street + ', ' : ''}{details.area}
                           </p>
                           
                           {isPickedUp && (
                             <div className="flex gap-2 mt-4">
                               <a href={mapUri} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl text-sm font-semibold transition-colors">
                                 <Navigation size={16} className="text-blue-600" /> Map
                               </a>
                               <a href={`https://wa.me/${(details.receiverPhone || "").replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl text-sm font-semibold transition-colors">
                                 <MessageCircle size={16} className="text-emerald-600" /> WhatsApp
                               </a>
                             </div>
                           )}
                         </div>
                       </div>

                       {/* Order Items */}
                       <div className="mt-5 pt-4 border-t border-gray-100">
                         <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Items</p>
                         <ul className="space-y-1.5">
                           {(order?.order_items || []).map((item: any, idx: number) => (
                             <li key={idx} className="text-sm flex justify-between items-start gap-4">
                               <span className="text-gray-900">{item.item_name || 'Unknown Item'}</span>
                               <span className="text-gray-500 font-medium whitespace-nowrap">x{item.quantity}</span>
                             </li>
                           ))}
                           {(!order?.order_items || order.order_items.length === 0) && order?.meta?.cart && Object.entries(order.meta.cart).map(([key, qty], idx) => (
                             <li key={idx} className="text-sm flex justify-between items-start gap-4">
                               <span className="text-gray-900">{key}</span>
                               <span className="text-gray-500 font-medium whitespace-nowrap">x{qty as number}</span>
                             </li>
                           ))}
                           {(!order?.order_items || order.order_items.length === 0) && (!order?.meta?.cart) && order?.meta?.scheduleLines && order.meta.scheduleLines.filter((l: any) => l.qty > 0).map((l: any, idx: number) => (
                             <li key={idx} className="text-sm flex justify-between items-start gap-4">
                               <span className="text-gray-900">{l.label || l.itemId}</span>
                               <span className="text-gray-500 font-medium whitespace-nowrap">x{l.qty}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                      {!isPickedUp ? (
                         <Button 
                           onClick={() => updateStatus(a.id, 'picked_up')} 
                           className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold"
                         >
                           Mark as Picked Up
                         </Button>
                      ) : (
                         <div className="flex gap-2">
                           <Button 
                             onClick={() => handleFailedClick(a)} 
                             variant="outline"
                             className="w-1/3 bg-white hover:bg-rose-50 border-gray-200 text-rose-600 rounded-xl h-12 text-sm font-semibold"
                           >
                             Report Issue
                           </Button>
                           <Button 
                             onClick={() => handleDeliverClick(a)} 
                             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 text-base font-semibold"
                           >
                             Deliver Order
                           </Button>
                         </div>
                      )}
                    </div>
                  </div>
                )
             })}
           </div>
        )}

        {/* past deliveries */}
        {delivered.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Completed Deliveries</h2>
            <div className="space-y-4">
          {delivered.map(d => {
            const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
            return (
              <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                       <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Order #{order?.order_number || order?.id?.slice(0,6)}</p>
                      <p className="text-xs text-gray-500">{formatTimeIndia(d.delivered_at || d.assigned_at)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">Delivered</span>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>

      {/* OTP Modal */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-[2rem] sm:rounded-3xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                   <CheckCircle size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Confirm Delivery</h3>
                <p className="text-gray-500 text-sm">Ask the customer for their 4-digit PIN to complete the delivery.</p>
              </div>

              {/* OTP Input display & Native Keyboard Trigger */}
              <div className="relative flex justify-center gap-3 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn(
                    "relative w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold border-2 transition-all overflow-hidden",
                    otpValue.length === i ? "border-blue-500 bg-blue-50 text-blue-700" :
                    otpValue.length > i ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-gray-50 text-gray-300"
                  )}>
                    {otpValue[i] || ""}
                    {otpValue.length === i && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-6 bg-blue-500 animate-pulse" />
                    )}
                  </div>
                ))}
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                  className="absolute inset-0 w-full h-full opacity-0 text-transparent bg-transparent cursor-text outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                 <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setOtpModalOpen(false)}>Cancel</Button>
                 <Button 
                   className="flex-1 rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
                   disabled={otpValue.length < 4 || isVerifying}
                   onClick={confirmDelivery}
                 >
                   {isVerifying ? "Verifying..." : "Confirm"}
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* Fail Modal */}
      {failModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-[2rem] sm:rounded-3xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                   <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Report Issue</h3>
                <p className="text-gray-500 text-sm">Cancel the delivery and return items to kitchen.</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason</label>
                <textarea
                  className="w-full h-24 p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                  placeholder="e.g. Customer unreachable, address incorrect..."
                  value={failReason}
                  onChange={e => setFailReason(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3">
                 <Button 
                   className="w-full rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white text-base font-semibold border-none"
                   disabled={isFailing}
                   onClick={confirmFailure}
                 >
                   {isFailing ? "Cancelling..." : "Confirm Return"}
                 </Button>
                 <Button variant="outline" className="w-full rounded-xl h-12 border-gray-200 text-gray-600" onClick={() => setFailModalOpen(false)}>Back</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

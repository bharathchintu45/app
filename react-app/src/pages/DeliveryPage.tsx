import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../types";
import { Package, MapPin, CheckCircle2, Navigation, X, Lock, Map, Zap, Delete, AlertTriangle, Clock, ShieldOff, ShieldAlert, MessageCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatTimeIndia } from "../lib/format";

import confetti from 'canvas-confetti';

export function DeliveryPage({ user, onBack, showToast }: { user: AppUser | null, onBack: () => void, showToast: (msg: string) => void }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
  
  // OTP Verification State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [verifyingAssignment, setVerifyingAssignment] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Override state
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData(true);

    const channel = supabase.channel('delivery-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData(false))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function fetchData(isInitial = false) {
    if (isInitial) setLoading(true);
    
    const { data: bData } = await supabase.from('delivery_boys').select('*').eq('profile_id', user?.id).single();
    if (bData) setDeliveryBoy(bData);

    const boyId = bData?.id;
    if (boyId) {
      const { data: aData } = await supabase
        .from('delivery_assignments')
        .select(`
          id, status, assigned_at, order_id, delivery_notes,
          orders ( order_number, customer_name, delivery_details, status, id, meta, kind )
        `)
        .eq('delivery_boy_id', boyId)
        .order('assigned_at', { ascending: false });

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
        
        // Only generate OTP if one doesn't already exist (it's now generated at checkout)
        const generatedOtp = currentMeta.delivery_otp || Math.floor(1000 + Math.random() * 9000).toString();
        metaUpdate = { delivery_otp: generatedOtp };
        
        await supabase.from('orders').update({ 
          meta: { ...currentMeta, ...metaUpdate },
          status: 'out_for_delivery'
        }).eq('id', assignment.order_id);
      }
      showToast(`✅ Picked up! OTP ${metaUpdate.delivery_otp ? 'confirmed' : 'generated'} for delivery.`);
    }
    await updateStatusCore(assignmentId, newStatus);
  }

  async function handleDeliverClick(assignment: any) {
    setVerifyingAssignment(assignment);
    setOtpValue("");
    setOtpError(false);
    setDeliverySuccess(false);
    setShowOverrideConfirm(false);
    setOtpModalOpen(true);
    // Focus with a slight delay to ensure modal is rendered
    setTimeout(() => otpInputRef.current?.focus(), 150);
  }

  function closeModal() {
    if (deliverySuccess) {
      // Just close after showing success
      setOtpModalOpen(false);
      setDeliverySuccess(false);
    } else {
      setOtpModalOpen(false);
    }
  }

  async function confirmDelivery() {
    if (!verifyingAssignment) return;
    setIsVerifying(true);
    setOtpError(false);

    const orderId = verifyingAssignment.order_id;
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    
    const correctOtp = order?.meta?.delivery_otp;
    
    if (otpValue === correctOtp) {
      // Success effect
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b']
      });

      // Mark order as delivered
      await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
      const ok = await updateStatusCore(verifyingAssignment.id, 'delivered');
      if (ok) {
        setDeliverySuccess(true);
        // Auto-close after success animation
        setTimeout(() => {
          setOtpModalOpen(false);
          setDeliverySuccess(false);
        }, 2500);
      }
    } else {
      setOtpError(true);
      showToast("❌ Incorrect PIN. Please ask the customer for the correct 4-digit code.");
    }
    setIsVerifying(false);
  }

  async function handleOverride() {
    if (!verifyingAssignment) return;
    setIsOverriding(true);

    const orderId = verifyingAssignment.order_id;
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    const currentMeta = order?.meta || {};

    // Mark with override flag
    await supabase.from('orders').update({ 
      meta: { ...currentMeta, delivery_override: true, override_at: new Date().toISOString() },
      status: 'delivered'
    }).eq('id', orderId);

    const ok = await updateStatusCore(verifyingAssignment.id, 'delivered');
    if (ok) {
      setDeliverySuccess(true);
      setTimeout(() => {
        setOtpModalOpen(false);
        setDeliverySuccess(false);
      }, 2500);
    }
    setIsOverriding(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 pb-32 animate-pulse space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
             <div className="w-24 h-4 bg-slate-200 rounded-full"></div>
             <div className="w-48 h-8 bg-slate-200 rounded-lg"></div>
             <div className="w-32 h-4 bg-slate-200 rounded-full"></div>
          </div>
          <div className="flex gap-3">
             <div className="w-24 h-20 bg-slate-100 rounded-xl"></div>
             <div className="w-24 h-20 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="w-48 h-6 bg-slate-200 rounded-md"></div>
          <div className="w-full h-48 bg-slate-100 rounded-3xl"></div>
          <div className="w-full h-48 bg-slate-100 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (!deliveryBoy) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center mt-20 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm">
        <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-rose-900 mb-2">Unlinked Account</h2>
        <p className="text-rose-700 font-medium">Your account is a Delivery Partner role, but hasn't been linked to a specific vehicle profile in the system. Please ask your Admin to link your account or add you via the Team Manager.</p>
        <Button onClick={onBack} className="mt-6 bg-slate-900 text-white">Return Home</Button>
      </div>
    );
  }

  const active = assignments.filter(a => a.status === 'assigned' || a.status === 'picked_up' || a.status === 'out_for_delivery');
  const delivered = assignments.filter(a => a.status === 'delivered');

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, damping: 20 } }
  };

  return (
    <div className="mx-auto max-w-lg min-h-screen bg-slate-50 text-slate-900 pb-40 transition-all duration-700" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Velocity Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl px-6 py-5 flex items-center justify-between border-b border-slate-200/50">
        <div className="flex flex-col">
           <h1 className="text-xl font-black tracking-tight text-slate-900">Velocity::Logistics</h1>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Agent::Active</span>
           </div>
        </div>
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 transition-all">
          <X size={18} />
        </button>
      </div>

      <div className="px-6 pt-8 space-y-10">
        {/* Kinetic Metrics */}
        <div className="grid grid-cols-3 gap-3">
           <div className="p-4 rounded-3xl bg-white shadow-sm border border-slate-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Earnings</span>
              <span className="text-lg font-black text-slate-900">₹940</span>
           </div>
           <div className="p-4 rounded-3xl bg-white shadow-sm border border-slate-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Deliveries</span>
              <span className="text-lg font-black text-slate-900">{delivered.length}</span>
           </div>
           <div className="p-4 rounded-3xl bg-white shadow-sm border border-slate-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Rating</span>
              <span className="text-lg font-black text-slate-900">4.9</span>
           </div>
        </div>

        {active.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-24 text-center">
             <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
               <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                 <Zap size={32} strokeWidth={1.5} />
               </motion.div>
             </div>
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Awaiting Assignments</h3>
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 pb-20">
            <AnimatePresence mode="popLayout">
              {active.map(a => {
                const order = a.orders;
                const details = order?.delivery_details || {};
                const isPickedUp = a.status === 'picked_up';
                const mapUri = details.lat ? `https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.address || "")}`;

                return (
                  <motion.div key={a.id} variants={item} layout
                    className="relative p-8 rounded-[3.5rem] bg-white border border-slate-100 shadow-[0_40px_80px_rgba(15,23,42,0.08)] overflow-hidden group"
                  >
                    <div className="flex items-center justify-between mb-10">
                       <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                         <div className="text-[10px] font-black text-slate-900 tracking-[0.2em] uppercase">
                           Mission::{order?.order_number || order?.id?.slice(0,6)}
                         </div>
                       </div>
                       <div className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-[8px] font-black uppercase tracking-[0.2em]">
                         High Priority
                       </div>
                    </div>

                    {/* Premium Liquid Timeline */}
                    <div className="relative pl-14">
                      <div className="absolute left-[27px] top-8 bottom-12 w-1.5 bg-slate-50 rounded-full overflow-hidden backdrop-blur-sm">
                         <motion.div 
                           initial={{ height: 0 }} 
                           animate={{ height: isPickedUp ? '100%' : '50%' }} 
                           className="w-full bg-gradient-to-bottom from-slate-900 via-slate-800 to-slate-900" 
                         />
                      </div>
                      
                      {/* Node: Pickup */}
                      <div className={cn("relative mb-14 transition-all duration-700", isPickedUp ? "opacity-20 scale-95" : "opacity-100")}>
                        <div className={cn(
                          "absolute -left-[54px] top-1 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-700 shadow-xl",
                          !isPickedUp ? "bg-slate-900 text-white shadow-slate-900/30" : "bg-slate-50 text-slate-300"
                        )}>
                          <Package size={20} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Origin Point</h4>
                        <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">The Fit Bowls Hub</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-2">Kitchen HQ · Sector 44</p>
                      </div>

                      {/* Node: Delivery */}
                      <div className={cn("relative transition-all duration-700", !isPickedUp ? "opacity-20 translate-y-4" : "opacity-100 translate-y-0")}>
                        <div className={cn(
                          "absolute -left-[54px] top-1 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl",
                          isPickedUp ? "bg-orange-500 text-white shadow-[0_15px_30px_rgba(249,115,22,0.4)]" : "bg-slate-50 text-slate-300"
                        )}>
                          <MapPin size={20} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1.5">Target Point</h4>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{order?.customer_name || "Valued Client"}</p>
                        <p className="text-[13px] font-bold text-slate-500 mt-3 leading-snug max-w-[200px]">
                          {details.building}, {details.area}
                        </p>
                        
                        {isPickedUp && (
                          <div className="mt-10">
                            {/* Split-Pill action bar */}
                            <div className="flex overflow-hidden rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
                              <a href={mapUri} target="_blank" rel="noopener noreferrer" className="flex-1 h-16 flex items-center justify-center gap-3 bg-slate-900 text-white hover:bg-black transition-all text-[11px] font-black uppercase tracking-widest active:scale-95">
                                <Navigation size={14} fill="white" className="rotate-45" /> Navigate
                              </a>
                              <div className="w-[1px] bg-slate-200" />
                              <a 
                                href={`https://wa.me/${(details.receiverPhone || "").replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="w-20 h-16 flex items-center justify-center bg-white text-slate-900 hover:bg-slate-50 transition-all active:scale-95"
                              >
                                <MessageCircle size={20} />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Premium Action Block */}
                    <div className="mt-14 pt-10 border-t border-slate-50">
                      {!isPickedUp ? (
                         <motion.button 
                           whileTap={{ scale: 0.96 }}
                           onClick={() => updateStatus(a.id, 'picked_up')} 
                           className="w-full h-16 rounded-full bg-slate-900 text-white font-black text-xs uppercase tracking-[0.25em] shadow-[0_20px_40px_rgba(15,23,42,0.2)] hover:bg-black transition-all flex items-center justify-center gap-3"
                         >
                           Initiate Mission <Zap size={14} />
                         </motion.button>
                      ) : (
                         <div className="w-full space-y-6">
                            <motion.button 
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleDeliverClick(a)} 
                              className="group relative w-full h-24 rounded-[2.5rem] bg-gradient-to-r from-orange-500 to-orange-400 text-white overflow-hidden shadow-[0_25px_50px_-12px_rgba(249,115,22,0.5)] active:shadow-none transition-all"
                            >
                               <div className="relative z-10 flex flex-col items-center justify-center gap-1">
                                 <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Protocol::Handover</span>
                                 <span className="text-sm font-black uppercase tracking-[0.2em]">Complete Delivery</span>
                               </div>
                               <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.button>
                            <div className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">
                               <div className="h-[1px] w-4 bg-slate-100" />
                               <ShieldAlert size={14} className="text-slate-200" /> 
                               <span>Verified Authentication</span>
                               <div className="h-[1px] w-4 bg-slate-100" />
                            </div>
                         </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Archives */}
      {delivered.length > 0 && (
        <div className="px-6 mt-16 pb-20">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mission History</h3>
              <div className="h-px flex-1 mx-4 bg-slate-200" />
           </div>
           <div className="space-y-4">
              {delivered.map(d => (
                <div key={d.id} className="p-5 rounded-[2.5rem] bg-white border border-slate-100 flex items-center justify-between shadow-sm">
                   <div className="flex flex-col gap-1">
                      <span className="text-slate-900 font-black text-sm">ORDER::{d.orders?.order_number || d.orders?.id?.slice(0,6)}</span>
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Successful Completion</span>
                   </div>
                   <div className="text-slate-900 font-black text-xs px-4 py-2 bg-slate-50 rounded-full">{formatTimeIndia(d.delivered_at || d.assigned_at)}</div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Velocity OTP Modal */}
      <AnimatePresence>
        {otpModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white p-10 rounded-t-[4rem] shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-10" />
              
              <div className="text-center mb-10">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verify Delivery</h2>
                <p className="text-slate-400 text-xs font-bold mt-2">Enter the 4-digit protocol code</p>
              </div>

              {/* Kinetic OTP Input */}
              <div className="flex justify-center gap-4 mb-12">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn(
                    "w-16 h-20 rounded-3xl flex items-center justify-center text-3xl font-black border-4 transition-all duration-200",
                    otpValue.length > i ? "border-slate-900 text-slate-900 bg-slate-50" : "border-slate-50 text-slate-200 bg-transparent"
                  )}>
                    {otpValue[i] || "•"}
                  </div>
                ))}
              </div>

              {/* Grid Keypad */}
              <div className="grid grid-cols-3 gap-4 mb-10">
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <button key={num} onClick={() => otpValue.length < 4 && setOtpValue(prev => prev + num)} className="h-16 rounded-3xl bg-slate-50 text-xl font-black text-slate-900 hover:bg-slate-100 active:scale-95 transition-all outline-none">
                    {num}
                  </button>
                ))}
                <button onClick={() => setOtpValue("")} className="h-16 rounded-3xl bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest active:scale-95 transition-all outline-none">Reset</button>
                <button onClick={() => otpValue.length < 4 && setOtpValue(prev => prev + "0")} className="h-16 rounded-3xl bg-slate-50 text-xl font-black text-slate-900 active:scale-95 transition-all outline-none">0</button>
                <button onClick={() => setOtpValue(prev => prev.slice(0, -1))} className="h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-95 transition-all outline-none">
                  <Delete size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                 <button 
                  disabled={otpValue.length < 4 || isVerifying}
                  onClick={confirmDelivery}
                  className="w-full h-16 rounded-3xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-20 disabled:shadow-none transition-all active:scale-95"
                 >
                   {isVerifying ? "Verifying..." : "Confirm Protocol"}
                 </button>
                 <button onClick={() => setOtpModalOpen(false)} className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kinetic Success Overlay */}
      <AnimatePresence>
        {deliverySuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center text-center p-10"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-32 h-32 rounded-[3.5rem] bg-orange-500 flex items-center justify-center mb-8 shadow-[0_20px_40px_rgba(249,115,22,0.4)]"
            >
              <CheckCircle2 size={64} className="text-white" />
            </motion.div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Protocol Verified</h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Mission Accomplished</p>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={otpInputRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={otpValue}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '');
          setOtpValue(val);
          setOtpError(false);
        }}
        className="sr-only"
        autoFocus
        id="otp-hidden-input-velocity"
      />
    </div>
  )
}

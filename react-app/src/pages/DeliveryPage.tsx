import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../types";
import { MapPin, Navigation, X, AlertTriangle, MessageCircle, CheckCircle, Package, Truck, Phone, Camera, Upload, ChevronDown } from "lucide-react";
import { useAppSettingString } from "../hooks/useAppSettings";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { formatTimeIndia } from "../lib/format";

const safeParse = (val: any) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return val; }
  }
  return val;
};

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

  // New: Proof of Delivery State
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality targeting ~150KB
        };
      };
    });
  };

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
        const rawId = assignment.order_id.replace('-today', '');
        const { data: order } = await supabase.from('orders').select('meta').eq('id', rawId).single();
        const currentMeta = safeParse(order?.meta) || {};
        
        // Only generate OTP if one doesn't already exist
        const generatedOtp = currentMeta.delivery_otp || Math.floor(1000 + Math.random() * 9000).toString();
        metaUpdate = { delivery_otp: generatedOtp };
        
        await supabase.from('orders').update({ 
          meta: { ...currentMeta, ...metaUpdate },
          status: 'out_for_delivery'
        }).eq('id', rawId);
      }
      showToast(`✅ Order marked as Picked Up.`);
    }
    await updateStatusCore(assignmentId, newStatus);
  }


  const startCamera = async () => {
    setProofImage(null);
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied. Please use the upload option.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setProofImage(dataUrl);
      stopCamera();
    }
  };

  useEffect(() => {
    if (!otpModalOpen) {
      stopCamera();
    }
  }, [otpModalOpen]);

  async function handleDeliverClick(assignment: any) {
    setVerifyingAssignment(assignment);
    setOtpValue("");
    setProofImage(null);
    setOtpModalOpen(true);
    startCamera();
    setTimeout(() => otpInputRef.current?.focus(), 150);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const base64 = await compressImage(file);
      setProofImage(base64);
    } catch (err) {
      showToast("Error processing image.");
    }
    setIsUploading(false);
  }

  async function confirmDelivery() {
    if (!verifyingAssignment) return;
    if (!proofImage) {
      showToast("📸 Please capture a photo first.");
      return;
    }
    setIsVerifying(true);

    // 1. Aggressively use pre-fetched data (which we know exists because it's in the list)
    const joinedOrder = Array.isArray(verifyingAssignment.orders) ? verifyingAssignment.orders[0] : verifyingAssignment.orders;
    
    // 2. ONLY re-fetch from DB if joinedOrder is missing for some reason
    let order = joinedOrder;
    if (!order) {
      const { data: freshA } = await supabase
        .from('delivery_assignments')
        .select('order_id, orders ( id, meta )')
        .eq('id', verifyingAssignment.id)
        .maybeSingle();
      order = Array.isArray(freshA?.orders) ? freshA.orders[0] : freshA?.orders;
    }

    if (!order) {
      showToast(`❌ System Error: Order record not found (AID: ${verifyingAssignment.id}, OID: ${verifyingAssignment.order_id}).`);
      setIsVerifying(false);
      return;
    }
    
    const resOrderId = order.id || verifyingAssignment.order_id;
    // Use safeParse to handle cases where meta might be returned as a JSON string
    const meta = safeParse(order.meta);
    const correctOtp = String(meta?.delivery_otp || "").trim();
    const enteredOtp = String(otpValue || "").trim();
    
    if (enteredOtp === correctOtp && correctOtp !== "") {
      // 1. Upload Base64 to Storage
      // Convert base64 back to blob for storage
      const res = await fetch(proofImage);
      const blob = await res.blob();
      const path = `proofs/${resOrderId}_${Date.now()}.jpg`;
      
      const { error: upErr } = await supabase.storage.from('delivery-proofs').upload(path, blob, { upsert: true });
      
      if (upErr) {
        showToast("Upload failed: " + upErr.message);
        setIsVerifying(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('delivery-proofs').getPublicUrl(path);

      // 2. Update Order Meta
      const newMeta = { 
        ...(order?.meta || {}), 
        proof_image_url: urlData.publicUrl,
        delivered_at_iso: new Date().toISOString()
      };

      await supabase.from('orders').update({ 
        status: 'delivered', 
        meta: newMeta 
      }).eq('id', resOrderId);

      const ok = await updateStatusCore(verifyingAssignment.id, 'delivered');
      if (ok) {
        setOtpModalOpen(false);
        showToast("✅ Delivery successful!");
      }
    } else {
      if (!correctOtp) {
         showToast("❌ PIN mismatch: No PIN found for this order. Try re-opening the task.");
      } else {
         showToast("❌ Incorrect PIN. Please try again.");
      }
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
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
               <Truck size={24} />
             </div>
             <div>
               <h1 className="text-xl font-black tracking-tighter leading-none">Fleet Manager</h1>
               <div className="flex items-center gap-2 mt-1.5">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live & Synchronized</span>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`tel:${supportPhoneRes.value}`} className="p-2.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-all">
              <Phone size={20} />
            </a>
            <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-2xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
           <div className="bg-white p-5 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Earnings</span>
              <span className="text-xl font-black text-slate-900 tracking-tighter">₹940</span>
           </div>
           <div className="bg-white p-5 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Orders</span>
              <span className="text-xl font-black text-slate-900 tracking-tighter">{delivered.length}</span>
           </div>
           <div className="bg-white p-5 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Score</span>
              <span className="text-xl font-black text-slate-900 tracking-tighter">4.9</span>
           </div>
        </div>

        {/* Active Assignments */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Pending Tasks ({active.length})</h2>
          <div className="h-px bg-slate-100 flex-1 ml-6" />
        </div>

        {active.length === 0 ? (
           <div className="bg-slate-50 rounded-[3rem] p-12 text-center border-2 border-dashed border-slate-200">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 shadow-inner">
                <Package size={32} />
             </div>
             <h3 className="text-slate-900 font-black tracking-tight text-xl mb-2">Rest & Recharge</h3>
             <p className="text-slate-500 text-sm font-medium leading-relaxed">No pending assignments at the moment.<br/>We'll alert you when a package is ready.</p>
           </div>
        ) : (
           <div className="space-y-4">
             {active.map(a => {
                const order = Array.isArray(a.orders) ? a.orders[0] : a.orders;
                const details = order?.delivery_details || {};
                const isPickedUp = a.status === 'picked_up' || a.status === 'out_for_delivery';
                const mapUri = details.lat ? `https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([details.building, details.street, details.area].filter(Boolean).join(", ") || "")}`;

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={a.id} 
                    className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-50 overflow-hidden mb-6"
                  >
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black text-slate-900 tracking-tighter text-lg">Order #{order?.order_number || order?.id?.slice(0,6)}</span>
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                         isPickedUp ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-emerald-100 text-emerald-700"
                       )}>
                         {isPickedUp ? 'En Route' : 'Assigned'}
                       </span>
                    </div>

                    <div className="p-8">
                       {/* Connection Line & Stops */}
                       <div className="space-y-10 relative">
                         <div className="absolute left-[13px] top-4 bottom-4 w-px bg-slate-100" />
                         
                         {/* Pickup */}
                         <div className="flex gap-6 relative">
                           <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 z-10 shadow-sm transition-all", isPickedUp ? "bg-slate-100 text-slate-400" : "bg-emerald-500 text-white")}>
                             <Package size={16} />
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Collection Point</p>
                             <p className="font-black text-slate-900 tracking-tight">The Fit Bowls Hub</p>
                             <p className="text-xs text-slate-500 font-medium">Kitchen HQ · Sector 44</p>
                           </div>
                         </div>
 
                         {/* Delivery */}
                         <div className="flex gap-6 relative">
                           <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 z-10 shadow-sm transition-all", isPickedUp ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>
                             <MapPin size={16} />
                           </div>
                           <div className="flex-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Destination</p>
                             <p className="font-black text-slate-900 tracking-tight text-lg">{order?.customer_name || "Customer"}</p>
                             <p className="text-sm text-slate-400 font-bold mb-3">{details.receiverPhone || "No phone provided"}</p>
                             
                             <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4">
                               <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                 {details.locationType && <span className="inline-block bg-white text-slate-900 text-[10px] uppercase font-black px-2 py-0.5 rounded-lg border border-slate-200 mr-2 shadow-sm">{details.locationType}</span>}
                                 {details.building}, {details.street ? details.street + ', ' : ''}{details.area}
                               </p>
                             </div>
                             
                             {isPickedUp && (
                               <div className="flex gap-3 mt-6">
                                 <a href={mapUri} target="_blank" rel="noopener noreferrer" className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200">
                                   <Navigation size={18} /> GPS Map
                                 </a>
                                 <a href={`https://wa.me/${(details.receiverPhone || "").replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="h-12 w-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 transition-all hover:bg-emerald-100">
                                   <MessageCircle size={20} />
                                 </a>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>

                       {/* Order Items Section - Minimalist */}
                       <details className="mt-8 pt-6 border-t border-slate-50 group">
                         <summary className="flex items-center justify-between cursor-pointer list-none">
                           <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">View Manifest</span>
                           <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center transition-transform group-open:rotate-180">
                             <ChevronDown size={14} className="text-slate-400" />
                           </div>
                         </summary>
                         <ul className="mt-4 space-y-3 px-1">
                           {(order?.order_items || []).map((item: any, idx: number) => (
                             <li key={idx} className="text-sm flex justify-between items-center group/item">
                               <span className="text-slate-700 font-medium">{item.item_name || 'Unknown Item'}</span>
                               <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-900 border border-slate-100">x{item.quantity}</span>
                             </li>
                           ))}
                         </ul>
                       </details>
                    </div>

                    <div className="p-6 bg-slate-50/50">
                      {!isPickedUp ? (
                         <Button 
                           onClick={() => updateStatus(a.id, 'picked_up')} 
                           className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02] shadow-xl shadow-emerald-100"
                         >
                           <Truck size={18} className="mr-3" /> Pickup Complete
                         </Button>
                      ) : (
                         <div className="flex gap-3">
                           <Button 
                             onClick={() => handleFailedClick(a)} 
                             variant="outline"
                             className="w-14 h-14 rounded-2xl border-slate-200 text-rose-600 p-0 flex items-center justify-center bg-white hover:bg-rose-50"
                           >
                             <AlertTriangle size={20} />
                           </Button>
                           <Button 
                             onClick={() => handleDeliverClick(a)} 
                             className="flex-1 bg-slate-900 border-none text-white rounded-2xl h-14 text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-slate-300"
                           >
                             Complete Delivery
                           </Button>
                         </div>
                      )}
                    </div>
                  </motion.div>
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
       {/* Delivery Confirmation (Photo + PIN) Modal */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-24 duration-500">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Proof of Delivery</h3>
                <p className="text-slate-400 text-sm font-medium">Verify handover with a photo and the customer's PIN.</p>
              </div>

              {/* Step 1: Photo Capture */}
              <div className="mb-10">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 text-center">Step 1: Capture Photo</div>
                
                <div className={cn(
                  "aspect-video rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative group",
                  proofImage ? "border-emerald-500/50 bg-emerald-50/30" : 
                  stream ? "border-blue-500/30 bg-black" :
                  "border-slate-100 bg-slate-50"
                )}>
                  {isUploading ? (
                    <div className="animate-pulse text-blue-500 font-bold">Processing...</div>
                  ) : proofImage ? (
                    <div className="relative w-full h-full">
                      <img src={proofImage} className="w-full h-full object-cover" alt="Proof" />
                      <button 
                        onClick={() => { setProofImage(null); startCamera(); }}
                        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-slate-200"
                      >
                        Retake
                      </button>
                    </div>
                  ) : stream ? (
                    <div className="relative w-full h-full">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 pointer-events-none border-[12px] border-white/5 opacity-20" />
                      <button 
                        onClick={capturePhoto}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white">
                          <Camera size={20} />
                        </div>
                      </button>
                    </div>
                  ) : cameraError ? (
                    <div className="p-6 text-center">
                      <p className="text-[10px] text-rose-500 font-black uppercase mb-4">{cameraError}</p>
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="rounded-xl h-10 text-[10px] font-black uppercase tracking-widest"
                      >
                        <Upload size={14} className="mr-2" /> Select File
                      </Button>
                    </div>
                  ) : (
                    <button 
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center w-full h-full hover:bg-blue-50/30 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white shadow-xl shadow-slate-200 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 transition-transform group-hover:scale-110">
                        <Camera size={26} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Initialize Camera</span>
                    </button>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>

              {/* Step 2: PIN Verification */}
              <div className={cn("transition-all duration-500", !proofImage && "opacity-20 pointer-events-none")}>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 text-center">Step 2: Enter PIN</div>
                <div className="relative flex justify-center gap-3 mb-10">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={cn(
                      "w-14 h-18 rounded-2xl flex items-center justify-center text-3xl font-black border-2 transition-all",
                      otpValue.length === i ? "border-slate-900 bg-white ring-4 ring-slate-100 scale-105" :
                      otpValue.length > i ? "border-slate-900 bg-slate-900 text-white" : "border-slate-50 bg-slate-50 text-slate-200"
                    )}>
                      {otpValue[i] || ""}
                      {otpValue.length === i && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900/10 rounded-full animate-ping" />
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
              </div>

              <div className="flex flex-col gap-4">
                 <Button 
                   className="w-full rounded-[1.5rem] h-16 bg-slate-900 hover:bg-black text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-slate-300 transition-all active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
                   disabled={otpValue.length < 4 || isVerifying || !proofImage}
                   onClick={confirmDelivery}
                 >
                   {isVerifying ? "Verifying..." : "Confirm Delivery"}
                 </Button>
                 <button 
                   className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                   onClick={() => setOtpModalOpen(false)}
                 >
                   Discard & Back
                 </button>
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
              </div>
           </div>
        </div>
      )}
    </div>
  </div>
);
}

import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";

const safeParse = (val: any) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return val; }
  }
  return val;
};

interface PickupPinModalProps {
  isOpen: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  showToast: (msg: string) => void;
}

export function PickupPinModal({ isOpen, orderId, onClose, onSuccess, showToast }: PickupPinModalProps) {
  const [pickupPinValue, setPickupPinValue] = useState("");
  const [pickupPinError, setPickupPinError] = useState(false);
  const [pickupPinVerifying, setPickupPinVerifying] = useState(false);
  const [pickupPinSuccess, setPickupPinSuccess] = useState(false);
  const [pickupShowOverride, setPickupShowOverride] = useState(false);
  const [pickupOverriding, setPickupOverriding] = useState(false);
  const pickupPinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => pickupPinInputRef.current?.focus(), 150);
  }, []);

  async function verifyPickupPin() {
    setPickupPinVerifying(true);
    setPickupPinError(false);
    
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    
    const meta = safeParse(order?.meta);
    const correctOtp = String(meta?.delivery_otp || "").trim();
    const enteredOtp = String(pickupPinValue || "").trim();
    
    if (enteredOtp === correctOtp && correctOtp !== "") {
      onSuccess(orderId);
      setPickupPinSuccess(true);
      setTimeout(() => { onClose(); setPickupPinSuccess(false); }, 2000);
    } else {
      setPickupPinError(true);
      if (!correctOtp) {
        showToast("❌ PIN mismatch: No PIN found for this order. Customer should refresh their tracking page.");
      } else {
        showToast("❌ Incorrect PIN. Ask the customer for the correct 4-digit code.");
      }
    }
    setPickupPinVerifying(false);
  }

  async function overridePickupPin() {
    setPickupOverriding(true);
    const { data: order } = await supabase.from('orders').select('meta').eq('id', orderId).single();
    const currentMeta = safeParse(order?.meta) || {};
    
    await supabase.from('orders').update({
      meta: { ...currentMeta, pickup_override: true, override_at: new Date().toISOString() }
    }).eq('id', orderId);

    onSuccess(orderId);
    setPickupPinSuccess(true);
    setTimeout(() => { onClose(); setPickupPinSuccess(false); }, 2000);
    setPickupOverriding(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!pickupPinSuccess) onClose(); }} />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
        {pickupPinSuccess ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-black text-slate-900">Pickup Verified!</h3>
            <p className="text-slate-500 font-medium mt-1">Order handed over successfully.</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">Pickup PIN Verification</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Ask the customer for their 4-digit pickup PIN</p>
            </div>

            <div className="flex justify-center gap-3 cursor-pointer" onClick={() => pickupPinInputRef.current?.focus()}>
              {[0,1,2,3].map(i => (
                <div key={i} className={cn(
                  "w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all duration-200",
                  pickupPinValue[i] ? "border-slate-950 bg-slate-950 text-white scale-105 shadow-xl" :
                  pickupPinError ? "border-rose-500 bg-rose-50 text-rose-500" :
                  "border-slate-200 bg-slate-50 text-slate-300"
                )}>
                  {pickupPinValue[i] || "•"}
                </div>
              ))}
            </div>

            <input
              ref={pickupPinInputRef}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pickupPinValue}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPickupPinValue(val);
                setPickupPinError(false);
              }}
              className="opacity-0 absolute w-0 h-0"
              autoFocus
            />

            {pickupPinError && (
              <p className="text-center text-rose-600 font-bold text-sm">❌ Incorrect PIN. Try again.</p>
            )}

            <button
              onClick={verifyPickupPin}
              disabled={pickupPinValue.length < 4 || pickupPinVerifying}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg"
            >
              {pickupPinVerifying ? "Verifying..." : "Verify & Hand Over"}
            </button>

            {!pickupShowOverride ? (
              <button
                onClick={() => setPickupShowOverride(true)}
                className="w-full text-slate-400 hover:text-rose-500 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors"
              >
                Customer can't provide PIN?
              </button>
            ) : (
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-3">
                <p className="text-xs font-bold text-rose-700">⚠️ Override will be logged for accountability. Only use if the customer cannot provide their PIN.</p>
                <button
                  onClick={overridePickupPin}
                  disabled={pickupOverriding}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all"
                >
                  {pickupOverriding ? "Processing..." : "Override & Hand Over"}
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full text-slate-400 hover:text-slate-600 text-xs font-bold py-2 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

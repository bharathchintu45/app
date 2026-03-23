import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Zap } from "lucide-react";
import type { MenuItem } from "../../types";

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  oldItem?: MenuItem | null;
  newItem: MenuItem;
  isLoading?: boolean;
}

export function SwapConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  oldItem, 
  newItem,
  isLoading 
}: SwapConfirmationModalProps) {
  if (!isOpen) return null;

  const oldPrice = oldItem?.priceINR || 0;
  const newPrice = newItem.priceINR || 0;
  const diff = newPrice - oldPrice;
  const isUpgrade = diff > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isUpgrade ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isUpgrade ? <Zap size={24} fill="currentColor" /> : <Zap size={24} />}
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
              {isUpgrade ? "Premium Upgrade" : "Confirm Swap"}
            </h3>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              {isUpgrade 
                ? "You're upgrading to a premium meal. Please pay the price difference to confirm."
                : "Are you sure you want to swap your current meal for this one?"}
            </p>

            <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">New</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate mb-0.5">{oldItem?.name || "Standard Meal"}</div>
                  <div className="text-lg font-black text-slate-400">₹{oldPrice}</div>
                </div>
                <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100 shrink-0">
                  <ArrowRight size={14} className="text-slate-300" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-sm font-bold text-slate-900 truncate mb-0.5">{newItem.name}</div>
                  <div className="text-lg font-black text-emerald-600">₹{newPrice}</div>
                </div>
              </div>

              {isUpgrade && (
                <div className="mt-6 pt-6 border-t border-slate-200/60 flex justify-between items-center">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upgrade Fee</div>
                  <div className="text-2xl font-black text-orange-600">₹{diff}</div>
                </div>
              )}
            </div>

            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                isUpgrade 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95" 
                  : "bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-95"
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isUpgrade ? "Proceed to Checkout" : "Confirm Swap"
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full mt-3 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

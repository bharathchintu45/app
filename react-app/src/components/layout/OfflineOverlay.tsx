import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, AlertCircle } from "lucide-react";

interface OfflineOverlayProps {
  isOffline: boolean;
}

export function OfflineOverlay({ isOffline }: OfflineOverlayProps) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="max-w-md w-full bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-slate-100 p-8 md:p-12 text-center relative overflow-hidden"
          >
            {/* Animated Background Pulse */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-50 rounded-full blur-3xl -z-10" 
            />

            <div className="relative mb-8">
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto"
              >
                <WifiOff className="text-rose-500 w-10 h-10" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  y: [0, -5, 0],
                  opacity: [1, 0.5, 1]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-slate-50"
              >
                <AlertCircle size={16} className="text-amber-500" />
              </motion.div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
              Connection Lost
            </h2>
            
            <p className="text-slate-500 font-medium leading-relaxed mb-8">
              Your internet is a little wonky. Try switching to a different connection or reset your internet to proceed.
            </p>

            <div className="space-y-4">
              <button 
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-200"
              >
                <RefreshCw size={18} className="animate-spin-slow" />
                Retry Connection
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Waiting for signal...
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

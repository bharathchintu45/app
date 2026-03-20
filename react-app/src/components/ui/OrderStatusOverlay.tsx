import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface OrderStatusOverlayProps {
  status: "success" | "failure" | "none";
  onClose?: () => void;
}

export function OrderStatusOverlay({ status, onClose }: OrderStatusOverlayProps) {
  if (status === "none") return null;

  const isSuccess = status === "success";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-white/60 backdrop-blur-3xl overflow-hidden"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "relative w-full max-w-sm rounded-[3rem] p-10 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border-2",
            isSuccess 
              ? "bg-emerald-50 border-emerald-100 text-emerald-900" 
              : "bg-rose-50 border-rose-100 text-rose-900"
          )}
        >
          {/* Decorative Elements */}
          <div className={cn(
            "absolute -top-12 -left-12 w-32 h-32 rounded-full opacity-20 blur-3xl",
            isSuccess ? "bg-emerald-400" : "bg-rose-400"
          )} />
          <div className={cn(
            "absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl",
            isSuccess ? "bg-emerald-400" : "bg-rose-400"
          )} />

          <div className="flex flex-col items-center gap-6 relative z-10">
            <motion.div
              initial={isSuccess ? { scale: 0, rotate: -30 } : { x: -10 }}
              animate={isSuccess ? { scale: 1, rotate: 0 } : { x: [0, -10, 10, -10, 10, 0] }}
              transition={isSuccess 
                ? { type: "spring", damping: 15, stiffness: 200, delay: 0.1 } 
                : { duration: 0.4, delay: 0.1 }
              }
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center shadow-lg",
                isSuccess ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
              )}
            >
              {isSuccess ? <CheckCircle2 size={48} strokeWidth={3} /> : <XCircle size={48} strokeWidth={3} />}
            </motion.div>

            <div className="space-y-2">
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black tracking-tight"
              >
                {isSuccess ? "Order Successful!" : "Order Failed"}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "text-sm font-bold opacity-70",
                  isSuccess ? "text-emerald-800" : "text-rose-800"
                )}
              >
                {isSuccess 
                  ? "Your healthy bowl is on the way!" 
                  : "Something went wrong. Please check your payment and try again."
                }
              </motion.p>
            </div>

            {!isSuccess && onClose && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={onClose}
                className="mt-4 px-8 py-3 rounded-full bg-rose-600 text-white font-black text-sm shadow-xl shadow-rose-600/20 active:scale-95 transition-transform"
              >
                Try Again
              </motion.button>
            )}
            
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mt-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Redirecting you now...
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { motion } from "framer-motion";
import { Home, Search, Ghost } from "lucide-react";

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full relative">
        {/* Floating background elements */}
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-10 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -10, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-20 -right-10 w-40 h-40 bg-rose-50/50 rounded-full blur-3xl pointer-events-none" 
        />

        {/* Icon / Illustration area */}
        <div className="relative mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="w-32 h-32 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-slate-200"
          >
            <Ghost className="text-white w-16 h-16" />
          </motion.div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full border-4 border-white flex items-center justify-center shadow-lg"
          >
            <Search size={14} className="text-slate-900" />
          </motion.div>
        </div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-6xl font-black text-slate-900 mb-2">404</h1>
          <h2 className="text-2xl font-bold text-slate-800 mb-4 tracking-tight">Oops! Page disappeared.</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-8 px-4">
            It seems the page you're looking for has gone on a little vacation. 
            Let's get you back to something delicious!
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200"
          >
            <Home size={18} />
            Go back Home
          </button>
        </motion.div>
        
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1 }}
          onClick={onBack}
          className="mt-10 text-sm font-semibold text-slate-400 hover:text-slate-900 transition-colors"
        >
          ← Back to safety
        </motion.button>
      </div>
    </div>
  );
}

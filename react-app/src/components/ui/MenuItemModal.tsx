import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Beef, Wheat, Droplets, Leaf } from "lucide-react";
import type { MenuItem } from "../../types";

interface MenuItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  actionButton?: React.ReactNode;
}

export function MenuItemModal({ item, onClose, actionButton }: MenuItemModalProps) {
  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [item]);

  if (!item) return null;

  const macros = [
    { label: "Calories",  value: item.calories, unit: "kcal", icon: Flame,   color: "text-orange-500",  bg: "bg-orange-50", bar: "bg-orange-400" },
    { label: "Protein",   value: item.protein,   unit: "g",    icon: Beef,    color: "text-red-500",     bg: "bg-red-50",    bar: "bg-red-400" },
    { label: "Carbs",     value: item.carbs,     unit: "g",    icon: Wheat,   color: "text-amber-500",   bg: "bg-amber-50",  bar: "bg-amber-400" },
    { label: "Fat",       value: item.fat,       unit: "g",    icon: Droplets,color: "text-sky-500",     bg: "bg-sky-50",    bar: "bg-sky-400" },
    { label: "Fiber",     value: item.fiber,     unit: "g",    icon: Leaf,    color: "text-slate-900", bg: "bg-slate-100",bar: "bg-slate-900" },
  ];

  const maxCals = 800;
  const macroMax: Record<string, number> = { Calories: maxCals, Protein: 60, Carbs: 120, Fat: 40, Fiber: 15 };

  const catColor: Record<string, string> = {
    Breakfast: "bg-orange-100 text-orange-700",
    Lunch:     "bg-slate-100 text-slate-700",
    Dinner:    "bg-indigo-100 text-indigo-700",
    Snack:     "bg-amber-100 text-amber-700",
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          {/* Hero image */}
          <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-50">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80'; }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">🥗</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {/* Badges */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${catColor[item.category] || "bg-slate-100 text-slate-700"}`}>
                {item.category}
              </span>
              {item.available === false && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                  Unavailable
                </span>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-all shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">{item.name}</h2>
                {item.description && (
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{item.description}</p>
                )}
              </div>
              {item.priceINR && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-black text-slate-900">₹{item.priceINR}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">per serving</div>
                </div>
              )}
            </div>

            {/* Macro grid */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Nutritional Breakdown</div>
              <div className="space-y-3">
                {macros.map(({ label, value, unit, icon: Icon, color, bg, bar }) => {
                  const max = macroMax[label] || 100;
                  const pct = Math.min(100, Math.round((value / max) * 100));
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                        <Icon size={15} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-bold text-slate-700">{label}</span>
                          <span className="text-xs font-black text-slate-900">{value}<span className="text-slate-400 font-normal ml-0.5">{unit}</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white px-3 py-1.5 rounded-xl">
                🌿 Chef Crafted
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 px-3 py-1.5 rounded-xl">
                ❄️ Fresh Daily
              </span>
              {item.fiber >= 7 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 px-3 py-1.5 rounded-xl">
                  💪 High Fiber
                </span>
              )}
              {item.protein >= 20 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-3 py-1.5 rounded-xl">
                  🥩 High Protein
                </span>
              )}
              {item.calories <= 300 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl">
                  ⚡ Low Calorie
                </span>
              )}
            </div>

            {/* Optional Action Button Container */}
            {actionButton && (
              <div className="pt-2">
                {actionButton}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

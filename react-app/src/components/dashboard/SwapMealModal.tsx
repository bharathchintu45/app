import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import type { MenuItem, Slot, Cat } from "../../types";

interface SwapMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: Slot;
  menu: MenuItem[];
  onSwap: (item: MenuItem) => void;
}

export function SwapMealModal({ isOpen, onClose, slot, menu, onSwap }: SwapMealModalProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Cat>("Breakfast");

  if (!isOpen) return null;

  const filtered = menu
    .filter(m => m.category === tab)
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Swap Meal for {slot}</h2>
              <p className="text-sm text-slate-500">Pick a new item to be delivered instead.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 hidden sm:block">
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl overflow-x-auto hide-scrollbar">
              {(["Breakfast", "Lunch", "Snack", "Dinner"] as Cat[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setTab(c)}
                  className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                    tab === c ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {filtered.map(item => (
                <div key={item.id} className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors cursor-pointer" onClick={() => onSwap(item)}>
                  <div className="w-20 h-20 rounded-lg bg-slate-200 shrink-0 overflow-hidden">
                    <img src={item.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80'} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="font-bold text-slate-900 truncate mb-1">{item.name}</div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-500 whitespace-nowrap">{item.calories} kcal</span>
                       <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-500 whitespace-nowrap">P {item.protein}g</span>
                    </div>
                    <button className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 self-start px-3 py-1 rounded-lg">Select</button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-500">
                  No items found matching your search.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

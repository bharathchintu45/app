import React from 'react';
import { Coffee, Sun, Moon, Lock, ArrowRight, Sparkles, Check } from "lucide-react";
import { formatDateIndia, slotLabel } from "../../lib/format";
import type { MenuItem, Slot } from "../../types";
import { cn } from "../../lib/utils";

interface DashboardMealCardProps {
  slot: Slot;
  item: MenuItem | null;
  isSelectedRollover: boolean;
  isMealHeld: boolean;
  locked: boolean;
  getSlotStatus: (slot: Slot) => string | null;
  selectedDate: string;
  rescheduledTo?: string;
  onHoldToggle: (date: string, slot: Slot) => void;
  onSwapMeal?: (slot: Slot, date: string) => void;
  isDayHold: boolean;
  addons?: Array<{ item: MenuItem; qty: number }>;
}

const SlotIconComponent = ({ slot, size, className }: { slot: Slot; size: number; className?: string }) => {
  if (slot === "Slot1") return <Coffee size={size} className={className} />;
  if (slot === "Slot2") return <Sun size={size} className={className} />;
  return <Moon size={size} className={className} />;
};

export const DashboardMealCard = React.memo(({
  slot,
  item,
  isSelectedRollover,
  isMealHeld,
  locked,
  getSlotStatus,
  selectedDate,
  rescheduledTo,
  onHoldToggle,
  onSwapMeal,
  isDayHold,
  addons = []
}: DashboardMealCardProps) => {
  const status = getSlotStatus(slot);
  const isDelivered = status === 'delivered';

  return (
    <div className={cn(
      "relative rounded-[1.5rem] border transition-all duration-300 overflow-hidden",
      locked 
        ? "bg-slate-50/50 border-slate-100/60 opacity-90" 
        : "bg-white/80 backdrop-blur-xl border-white/60 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-1 hover:border-slate-200/60",
      isMealHeld && "bg-rose-50/50 border-rose-100/50 shadow-inner",
      isSelectedRollover && item && "border-purple-200/60 shadow-[0_10px_30px_-15px_rgba(168,85,247,0.2)]",
      !item && !isMealHeld && "bg-slate-50/30 border-dashed border-slate-200"
    )}>
      {/* Premium Glass Highlights */}
      {!locked && <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-white/10 to-transparent pointer-events-none" />}

      {/* Card Top: image + info */}
      <div className="relative flex items-center gap-4 sm:gap-5 p-4 md:p-5">
        {item ? (
          <div className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-xl md:rounded-[1.25rem] shrink-0 overflow-hidden shadow-sm relative group",
            isMealHeld && "grayscale opacity-50"
          )}>
            <img 
              src={item.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80'} 
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            {/* Elegant gradient overlay for image */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            
            {isDelivered && (
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white/95 rounded-full p-2 shadow-lg border border-emerald-100/50 scale-110">
                  <Check size={16} strokeWidth={4} className="text-emerald-500" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-xl md:rounded-[1.25rem] shrink-0 bg-slate-100/80 border border-slate-200/50 flex items-center justify-center">
            <SlotIconComponent slot={slot} size={28} className="text-slate-300 md:w-10 md:h-10" />
          </div>
        )}

        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-1.5 mb-1.5">
             <div className="p-1 rounded-md bg-slate-100/80 text-slate-500 shrink-0">
               <SlotIconComponent slot={slot} size={10} className="sm:w-3 sm:h-3" />
             </div>
             <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 truncate">{slotLabel(slot)}</span>
          </div>
          
          {isMealHeld ? (
            <>
              <h4 className="text-sm md:text-xl font-black tracking-tight truncate text-rose-900/40">
                Meal On Hold
              </h4>
              {rescheduledTo && (
                <div className="flex items-center gap-1.5 mt-2 text-[10px] sm:text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg w-fit border border-rose-100/50">
                  <ArrowRight size={12} /> Moved to {formatDateIndia(rescheduledTo)}
                </div>
              )}
            </>
          ) : item ? (
            <>
              <h4 className="text-[15px] sm:text-base md:text-xl font-black tracking-tight text-slate-900 leading-snug line-clamp-2">
                {item.name}
              </h4>
              {isSelectedRollover && (
                <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-purple-100/80 text-purple-700 text-[9px] font-black uppercase tracking-widest border border-purple-200/50">
                  🎁 Rescheduled Meal
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-full border border-slate-200/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" /> {item.calories || 0} kcal
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-full border border-slate-200/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> P {item.protein || 0}g
                </span>
              </div>
            </>
          ) : (
            <>
              <h4 className="text-[15px] sm:text-base md:text-lg font-bold tracking-tight text-slate-400 italic">
                No items selected
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1">
                No meal was chosen for this slot
              </p>
            </>
          )}

          {/* Premium Add-ons Section */}
          {addons.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100/50 space-y-2">
              <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                <Sparkles size={10} className="text-amber-500" /> Extras
              </div>
              <div className="flex flex-wrap gap-2">
                {addons.map((addon, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-100/50 pr-2 pl-1 py-1 rounded-lg">
                    <span className="text-[10px] font-black text-amber-700 bg-white px-1.5 py-0.5 rounded-md shadow-sm">
                      {addon.qty}x
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">
                      {addon.item.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Bottom: Premium Action Buttons */}
      {!locked && !isSelectedRollover && (
        <div className="relative flex flex-col sm:flex-row gap-2 px-4 pb-4 md:px-5 md:pb-5">
          {/* Select Meal button for empty slots */}
          {!item && !isMealHeld && onSwapMeal && (
            <button
              onClick={() => onSwapMeal(slot, selectedDate)}
              className="w-full py-3 rounded-[1rem] bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-emerald-500/25"
            >
              Select Meal
            </button>
          )}
          {/* Hold/Unhold and Swap for assigned slots */}
          {item && !isDayHold && (
            <div className="flex w-full gap-2">
              {onSwapMeal && (
                <button
                  onClick={() => onSwapMeal(slot, selectedDate)}
                  className="flex-1 py-3 rounded-[1rem] bg-slate-950 hover:bg-slate-800 active:scale-[0.98] text-white text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-slate-900/20"
                >
                  Swap
                </button>
              )}
              <button
                onClick={() => onHoldToggle(selectedDate, slot)}
                className={cn(
                  "flex-1 py-3 rounded-[1rem] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-sm",
                  isMealHeld 
                    ? "bg-rose-100/80 text-rose-600 hover:bg-rose-200 border border-rose-200/50" 
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
                )}
              >
                {isMealHeld ? "Unhold" : "Hold"}
              </button>
            </div>
          )}
        </div>
      )}
      {locked && (
        <div className="relative flex items-center gap-2 px-4 pb-4 md:px-5 md:pb-5">
          {isDelivered ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100/50 w-full justify-center">
              <div className="bg-emerald-500 text-white rounded-full p-0.5 shrink-0 shadow-sm shadow-emerald-200">
                 <Check size={12} strokeWidth={4} />
               </div>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Delivered</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/50 border border-slate-200/50 w-full justify-center">
              <Lock size={12} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Locked for Prep</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DashboardMealCard.displayName = 'DashboardMealCard';

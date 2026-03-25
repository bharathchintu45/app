import React from 'react';
import { Coffee, Sun, Moon, Lock, ArrowRight, Sparkles } from "lucide-react";
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
      "rounded-2xl border transition-all overflow-hidden",
      locked ? "bg-slate-50/30 border-slate-100 opacity-80" : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-lg",
      isMealHeld && "bg-rose-50/30 border-rose-100 shadow-inner",
      isSelectedRollover && item && "border-purple-200 shadow-sm shadow-purple-900/5",
      !item && !isMealHeld && "bg-slate-50/50 border-dashed border-slate-200"
    )}>
      {/* Card Top: image + info */}
      <div className="flex items-center gap-2 sm:gap-3 p-3 md:p-6">
        {item ? (
          <div className={cn(
            "w-12 h-12 sm:w-14 sm:h-14 md:w-24 md:h-24 rounded-lg md:rounded-2xl shrink-0 overflow-hidden shadow-md relative",
            isMealHeld && "grayscale opacity-50"
          )}>
            <img 
              src={item.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80'} 
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {isDelivered && (
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-white/90 rounded-full p-1.5 shadow-lg border border-emerald-100">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-24 md:h-24 rounded-lg md:rounded-2xl shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center">
            <SlotIconComponent slot={slot} size={20} className="text-slate-300 sm:w-6 sm:h-6 md:w-8 md:h-8" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
             <div className="p-0.5 sm:p-1 rounded-md bg-slate-100 text-slate-500 shrink-0">
               <SlotIconComponent slot={slot} size={10} className="sm:w-3 sm:h-3" />
             </div>
             <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 truncate">{slotLabel(slot)}</span>
          </div>
          {isMealHeld ? (
            <>
              <h4 className="text-sm md:text-lg font-black tracking-tight truncate text-rose-900/40">
                Meal On Hold
              </h4>
              {rescheduledTo && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-rose-600 italic bg-rose-50 px-2 py-0.5 rounded-lg w-fit border border-rose-100/50">
                  <ArrowRight size={10} /> Moved to {formatDateIndia(rescheduledTo)}
                </div>
              )}
            </>
          ) : item ? (
            <>
              <h4 className="text-sm md:text-lg font-black tracking-tight truncate text-slate-900">
                {item.name}
              </h4>
              {isSelectedRollover && (
                <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[9px] font-black uppercase tracking-widest">
                  🎁 Rescheduled Meal
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {item.calories || 0} kcal
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> P {item.protein || 0}g
                </span>
              </div>
            </>
          ) : (
            <>
              <h4 className="text-sm md:text-base font-bold tracking-tight text-slate-400 italic">
                No items selected
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                No meal was chosen for this slot
              </p>
            </>
          )}

          {/* Render Add-ons if any */}
          {addons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100/50 space-y-1.5">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                <Sparkles size={8} className="text-amber-500" /> Selected Add-ons
              </div>
              {addons.map((addon, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-amber-50/50 border border-amber-100/30 px-2 py-1.5 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md shadow-sm">
                      {addon.qty}x
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 truncate">
                      {addon.item.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => window.location.hash = "#dashboard"} // Or whatever opens the addon tray
                    className="text-[9px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Bottom: action buttons */}
      {!locked && !isSelectedRollover && (
        <div className="flex flex-col gap-2 px-3 pb-3 md:px-6 md:pb-6 border-t border-slate-100 pt-2.5">
          {/* Select Meal button for empty slots */}
          {!item && !isMealHeld && onSwapMeal && (
            <button
              onClick={() => onSwapMeal(slot, selectedDate)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest transition-all"
            >
              Select Meal
            </button>
          )}
          {/* Hold/Unhold and Swap for assigned slots */}
          {item && !isDayHold && (
            <button
              onClick={() => onHoldToggle(selectedDate, slot)}
              className={cn(
                "w-full py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest transition-all",
                isMealHeld ? "bg-rose-100 text-rose-600 hover:bg-rose-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {isMealHeld ? "Unhold Meal" : "Hold Meal"}
            </button>
          )}
          {item && !isMealHeld && onSwapMeal && (
            <button
              onClick={() => onSwapMeal(slot, selectedDate)}
              className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest transition-all"
            >
              Swap Meal
            </button>
          )}
        </div>
      )}
      {locked && (
        <div className="flex items-center gap-2 px-3 pb-3 md:px-6 md:pb-6 border-t border-slate-100 pt-2.5">
          {isDelivered ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 w-full justify-center">
              <div className="bg-emerald-500 text-white rounded-full p-0.5 shrink-0 shadow-sm shadow-emerald-200">
                 <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                 </svg>
               </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Meal Delivered</span>
            </div>
          ) : (
            <>
              <Lock size={12} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Locked for Preparation</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

DashboardMealCard.displayName = 'DashboardMealCard';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarDays, ArrowRight, ArrowRightLeft, Clock } from "lucide-react";
import { formatDateIndia, dayKey, addDays, parseDateKeyToDate } from "../../lib/format";
import type { Slot, MenuItem } from "../../types";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetDate: string, targetSlot?: Slot) => void;
  originalDate: string;
  endDate: string;
  isFullDay: boolean;
  slot?: Slot;
  itemsToMove: { slot: Slot, item: MenuItem }[];
  allowedSlots?: Slot[];
  isLoading?: boolean;
}

export function RescheduleModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  originalDate, 
  endDate,
  isFullDay,
  slot,
  itemsToMove,
  allowedSlots,
  isLoading = false 
}: RescheduleModalProps) {
  // Generate the 3 buffer days immediately following the end date
  const baseEndDate = parseDateKeyToDate(endDate);
  const options = [
    dayKey(addDays(baseEndDate, 1)),
    dayKey(addDays(baseEndDate, 2)),
    dayKey(addDays(baseEndDate, 3)),
  ];

  const [selectedDate, setSelectedDate] = useState<string>(options[0]);
  const [targetSlot, setTargetSlot] = useState<Slot | undefined>(slot);

  const originalSlot = !isFullDay && itemsToMove.length === 1 ? itemsToMove[0].slot : undefined;
  const isInvalidSlotMove = originalSlot && targetSlot && allowedSlots
    ? allowedSlots.indexOf(targetSlot) < allowedSlots.indexOf(originalSlot)
    : false;

  if (!isOpen) return null;

  const title = isFullDay ? "Reschedule Entire Day" : "Reschedule Meal";
  const subtitle = isFullDay 
    ? `Move all your meals from ${formatDateIndia(originalDate)} to a new delivery day.` 
    : `Move your ${slot ? slot.replace('Slot1', 'Breakfast').replace('Slot2', 'Lunch').replace('Slot3', 'Dinner') : 'meal'} from ${formatDateIndia(originalDate)} to a new delivery day.`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
          onClick={!isLoading ? onClose : undefined} 
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[420px] bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-white/50"
        >
          {/* Header - Glassmorphic */}
          <div className="p-6 pb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/10 via-transparent to-slate-500/5 -z-10" />
            <div className="flex items-start justify-between">
              <div>
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4"
                >
                  <CalendarDays size={24} strokeWidth={2.5} />
                </motion.div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">{title}</h2>
                <p className="text-sm font-medium text-slate-500 leading-relaxed pr-4">{subtitle}</p>
              </div>
              <button 
                onClick={!isLoading ? onClose : undefined} 
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 disabled:opacity-50 shrink-0"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="px-6 py-2 space-y-7">
            {/* Horizontal Date Picker */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Select Rollover Date
                </label>
              </div>
              <div className="flex gap-2">
                {options.map((date) => {
                  const isSelected = selectedDate === date;
                  const dateObj = parseDateKeyToDate(date);
                  const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "short" });
                  const dayNum = dateObj.getDate();

                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      disabled={isLoading}
                      className={`flex-1 relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl transition-all disabled:opacity-50 overflow-hidden ${
                        isSelected 
                          ? "bg-slate-900 border border-slate-900 text-white shadow-xl shadow-slate-900/20" 
                          : "bg-slate-50 border border-slate-100/80 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isSelected ? "text-slate-400" : "text-slate-400"}`}>{dayName}</span>
                      <span className={`text-2xl font-black leading-none ${isSelected ? "text-white" : "text-slate-800"}`}>{dayNum}</span>
                      {isSelected && (
                         <motion.div layoutId="date-indicator" className="absolute bottom-1 w-8 h-1 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Slot Segmented Control */}
            {!isFullDay && allowedSlots && itemsToMove.length === 1 && (
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <ArrowRightLeft size={14} className="text-slate-400" />
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Delivery Shift</label>
                   </div>
                   {isInvalidSlotMove && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 animate-pulse">Wait, invalid shift</span>
                   )}
                 </div>
                 
                 <div className="relative flex bg-slate-100/80 backdrop-blur border border-slate-200/50 p-1.5 rounded-2xl">
                   {allowedSlots.map(s => {
                     const isSelected = targetSlot === s;
                     return (
                       <button
                         key={s}
                         onClick={() => setTargetSlot(s)}
                         className={`relative flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all z-10 ${
                           isSelected ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                         }`}
                       >
                         {s.replace('Slot1', 'Breakfast').replace('Slot2', 'Lunch').replace('Slot3', 'Dinner')}
                         {isSelected && (
                            <motion.div 
                              layoutId="slot-active" 
                              className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/50 -z-10" 
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                         )}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}

            {/* Warning Alert inside Body */}
            <AnimatePresence>
              {isInvalidSlotMove && originalSlot && targetSlot && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100/50 flex gap-3 text-left">
                      <span className="text-rose-500 text-lg leading-none mt-0.5">⚠️</span>
                      <p className="text-[11px] text-rose-800 font-medium leading-relaxed">
                        A <strong>{originalSlot.replace('Slot1', 'Breakfast').replace('Slot2', 'Lunch').replace('Slot3', 'Dinner')}</strong> item cannot be served for <strong>{targetSlot.replace('Slot1', 'Breakfast').replace('Slot2', 'Lunch').replace('Slot3', 'Dinner')}</strong>. The kitchen does not prepare this menu type during the earlier shift.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Receipt Summary */}
            <div className="rounded-2xl bg-slate-50 p-1">
              <div className="bg-white rounded-[14px] p-4 border border-slate-100 shadow-sm space-y-4">
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Meals Being Moved</div>
                  {itemsToMove.map(m => (
                    <div key={m.slot} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
                        {m.item.image ? <img src={m.item.image} className="w-full h-full object-cover" /> : <CalendarDays size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center bg-slate-100 text-slate-600 font-black uppercase leading-none tracking-widest">
                            {m.slot.replace('Slot1', 'B').replace('Slot2', 'L').replace('Slot3', 'D')}
                          </span>
                          {(!isFullDay && targetSlot && targetSlot !== m.slot) && (
                            <>
                              <ArrowRight size={10} className="text-emerald-500" strokeWidth={3} />
                              <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center bg-emerald-100 text-emerald-700 font-black uppercase leading-none tracking-widest">
                                {targetSlot.replace('Slot1', 'B').replace('Slot2', 'L').replace('Slot3', 'D')}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-sm font-black text-slate-900 truncate">{m.item.name}</div>
                      </div>
                    </div>
                  ))}
                  {itemsToMove.length === 0 && (
                     <div className="text-xs font-medium text-slate-400 italic">No meals selected</div>
                  )}
                </div>

                <div className="h-px w-full bg-slate-100" />

                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase tracking-widest text-[10px]">From</span>
                  <span className="text-slate-600">{formatDateIndia(originalDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-2 pb-8 sm:pb-6">
            <button
              onClick={() => onConfirm(selectedDate, targetSlot)}
              disabled={isLoading || isInvalidSlotMove}
              className="group relative w-full overflow-hidden rounded-2xl bg-slate-900 text-white font-black text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed border border-slate-800"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center gap-2 py-4 px-6">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Confirm Reschedule 
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

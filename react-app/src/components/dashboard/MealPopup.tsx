import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { X, Check, Coffee, Sun, Utensils, AlertTriangle } from "lucide-react";
import type { MenuItem, Slot } from "../../types";
import { slotLabel } from "../../lib/format";

const SLOT_ICONS: Record<Slot, React.ElementType> = {
  Slot1: Coffee,
  Slot2: Sun,
  Slot3: Utensils,
};

interface MealPopupProps {
  popup: MenuItem | null;
  allowedSlots: Slot[];
  selectedDayPlan: Partial<Record<Slot, MenuItem | null>>;
  maxMeals: number;
  upsertMeal: (slot: Slot, item: MenuItem) => void;
  removeMeal: (slot: Slot) => void;
  close: () => void;
}

export function MealPopup({
  popup,
  allowedSlots,
  selectedDayPlan,
  maxMeals,
  upsertMeal,
  removeMeal,
  close,
}: MealPopupProps) {
  const [warning, setWarning] = useState<string | null>(null);

  if (!popup) return null;

  const filledCount = allowedSlots.filter((s) => !!selectedDayPlan[s]).length;

  function handleAdd(slot: Slot) {
    if (!popup) return;
    const slotAlreadyFilled = !!selectedDayPlan[slot];
    if (!slotAlreadyFilled && filledCount >= maxMeals) {
      setWarning(
        `Your plan allows ${maxMeals} meal${maxMeals > 1 ? "s" : ""} per day. Remove a meal first or upgrade your plan.`
      );
      return;
    }
    setWarning(null);
    upsertMeal(slot, popup);
  }

  function handleRemove(slot: Slot) {
    setWarning(null);
    removeMeal(slot);
  }

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-lg font-black text-slate-900">Add item to a meal</div>
              <div className="mt-0.5 text-sm font-medium text-slate-500">{popup.name}</div>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Macros pill */}
          <div className="flex items-center gap-2 mt-3 mb-5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
              {popup.calories} kcal
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
              P{popup.protein}g
            </span>
          </div>

          {/* Warning Banner */}
          <AnimatePresence>
            {warning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm font-semibold text-amber-800 leading-snug">{warning}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Slot options */}
          <div className="space-y-2.5">
            {allowedSlots.map((slot) => {
              const currentItem = selectedDayPlan[slot];
              const SlotIcon = SLOT_ICONS[slot] || Utensils;
              const isCurrentlyThisItem = currentItem?.id === popup.id;
              
              const isTimeRestricted = slot === "Slot1" && popup.category === "Midday-Midnight Kitchen";
              const isMaxMealsReached = !currentItem && !isCurrentlyThisItem && filledCount >= maxMeals;
              const isDisabled = isMaxMealsReached || isTimeRestricted;

              return (
                <div
                  key={slot}
                  className={cn(
                    "rounded-2xl border p-4 transition-all",
                    isCurrentlyThisItem
                      ? "border-emerald-200 bg-emerald-50/50"
                      : isDisabled
                      ? "border-slate-100 bg-slate-50/30 opacity-60"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "p-2 rounded-xl",
                        isCurrentlyThisItem ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                      )}>
                        <SlotIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900">{slotLabel(slot)}</div>
                        <div className={cn("text-xs truncate", isTimeRestricted ? "text-amber-600 font-semibold" : "text-slate-500")}>
                          {isTimeRestricted 
                            ? "Available 11 AM – Midnight only"
                            : currentItem?.name
                            ? `Current: ${currentItem.name}`
                            : "Currently empty"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {isCurrentlyThisItem ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                          <Check size={12} /> Active
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => { if (!isTimeRestricted) handleAdd(slot); }}
                          disabled={isTimeRestricted}
                          className={cn(
                            "h-8 px-4 text-[10px] font-black uppercase tracking-wider",
                            isDisabled
                              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                              : "bg-slate-900 text-white hover:bg-black"
                          )}
                        >
                          {currentItem && !isTimeRestricted ? "Update" : "Add"}
                        </Button>
                      )}
                      {currentItem && !isTimeRestricted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemove(slot)}
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-wider"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={close}
              className="h-9 px-5 text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default MealPopup;

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { X, Plus, Minus, Coffee, Sun, Utensils } from "lucide-react";
import type { MenuItem, Slot } from "../../types";
import { slotLabel } from "../../lib/format";

export interface AddonEntry {
  item: MenuItem;
  qty: number;
}

export type SlotAddons = Record<Slot, AddonEntry[]>;

const SLOT_ICONS: Record<Slot, React.ElementType> = {
  Slot1: Coffee,
  Slot2: Sun,
  Slot3: Utensils,
};

interface AddonPopupProps {
  popup: MenuItem | null;
  allowedSlots: Slot[];
  slotAddons: SlotAddons;
  attachAddon: (slot: Slot, item: MenuItem) => void;
  removeAddon: (slot: Slot, item: MenuItem) => void;
  close: () => void;
}

export function AddonPopup({
  popup,
  allowedSlots,
  slotAddons,
  attachAddon,
  removeAddon,
  close,
}: AddonPopupProps) {
  if (!popup) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={close}
      >
        <motion.div
          key={popup.id}
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
              <div className="text-lg font-black text-slate-900">Attach add-on to a meal</div>
              <div className="mt-0.5 text-sm font-medium text-slate-500">{popup.name}</div>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Macros */}
          <div className="flex items-center gap-2 mt-3 mb-5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
              {popup.calories} kcal
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
              P{popup.protein}g
            </span>
          </div>

          {/* Slot options */}
          <div className="space-y-2.5">
            {allowedSlots.map((slot) => {
              const addonsForSlot = slotAddons[slot] || [];
              const current = addonsForSlot.find((a) => a.item.id === popup.id);
              const otherAddons = addonsForSlot.filter((a) => a.item.id !== popup.id);
              const SlotIcon = SLOT_ICONS[slot] || Utensils;

              return (
                <div
                  key={slot}
                  className={cn(
                    "rounded-2xl border p-4 transition-all",
                    current
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "p-2 rounded-xl",
                        current ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                      )}>
                        <SlotIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900">{slotLabel(slot)}</div>
                        <div className="text-xs text-slate-500">
                          {current ? `This item: ×${current.qty}` : "Not attached yet"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {current && (
                        <button
                          onClick={() => removeAddon(slot, popup)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                      )}
                      {current && (
                        <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">
                          {current.qty}
                        </span>
                      )}
                      <button
                        onClick={() => attachAddon(slot, popup)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          current
                            ? "hover:bg-amber-200 bg-amber-100 text-amber-700"
                            : "hover:bg-slate-200 bg-slate-100 text-slate-600"
                        )}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Show other add-ons already attached to this slot */}
                  {otherAddons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Already attached</div>
                      <div className="flex flex-wrap gap-1.5">
                        {otherAddons.map((a) => (
                          <span
                            key={a.item.id}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700"
                          >
                            {a.item.name} ×{a.qty}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Remove all qty of this addon from this slot
                                for (let i = 0; i < a.qty; i++) removeAddon(slot, a.item);
                              }}
                              className="ml-0.5 p-0.5 rounded-full hover:bg-red-200 text-red-400 hover:text-red-600 transition-colors"
                              title={`Remove ${a.item.name}`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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

export default AddonPopup;

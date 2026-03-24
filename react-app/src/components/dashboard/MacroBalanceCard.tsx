import React, { useMemo } from "react";
import { cn } from "../../lib/utils";
import { sumMacros } from "../../data/menu";
import type { Slot, MenuItem, MenuItem as MenuItemType } from "../../types";

interface MacroBalanceCardProps {
  plan: any;
  subscription: any;
  selectedDayPlan: Partial<Record<Slot, MenuItemType | null>>;
  selectedDayHold: { day: boolean; slots: Record<Slot, boolean> };
  slotAddons?: any;
}

export const MacroBalanceCard = React.memo(({ 
  plan, 
  subscription, 
  selectedDayPlan, 
  selectedDayHold,
  slotAddons
}: MacroBalanceCardProps) => {
  const { values, targets, calPct, calBarPct, isCalExtreme } = useMemo(() => {
    // We show the "Planned" macros for the day, even if it's on hold, 
    // so the user can see what they are aiming for or moving around.
    const plannedMeals = (plan.allowedSlots as Slot[])
      .map((s) => selectedDayPlan[s])
      .filter(Boolean) as MenuItem[];
    
    const v = sumMacros(plannedMeals);
    
    // Add Addons if passed from parent
    if (slotAddons) {
      for (const slot of (plan.allowedSlots as Slot[])) {
        const addons = slotAddons[slot] || [];
        for (const a of addons) {
          v.calories += (a.item.calories || 0) * a.qty;
          v.protein += (a.item.protein || 0) * a.qty;
          v.carbs += (a.item.carbs || 0) * a.qty;
          v.fat += (a.item.fat || 0) * a.qty;
        }
      }
    }

    const t = subscription?.meta?.targets || { calories: 2000, protein: 150, carbs: 200, fat: 70 };
    const cp = Math.round((v.calories / t.calories) * 100);
    
    return {
      values: v,
      targets: t,
      calPct: cp,
      calBarPct: Math.min(100, cp),
      isCalExtreme: cp >= 110
    };
  }, [plan.allowedSlots, selectedDayPlan, slotAddons, subscription?.meta?.targets]);

  return (
    <div className="w-full sm:w-[300px] lg:w-[320px] flex flex-col items-center gap-4 sm:gap-5 p-6 sm:p-7 md:p-9 rounded-[2.5rem] md:rounded-[3rem] bg-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/40">
      <div className="space-y-4 sm:space-y-6 text-center w-full">
        <div className="space-y-2">
          <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-[0.2em] text-slate-500">Selected Day Macros</div>
          
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Calories Progress */}
            <div className="space-y-2">
              <div className="text-xl sm:text-2xl md:text-5xl font-black text-white leading-none transition-all duration-300">
                {values.calories}<span className={cn("text-[10px] sm:text-sm ml-1 tracking-tight font-bold", isCalExtreme ? "text-rose-500" : "text-emerald-400")}>kcal / {targets.calories}</span>
              </div>
              <div className="relative w-full h-2 sm:h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full",
                    isCalExtreme ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]" : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  )}
                  style={{ width: `${calBarPct}%` }}
                />
                {calPct > 100 && (
                  <div className="absolute inset-y-0 left-0 bg-white/20 animate-pulse" style={{ width: `${calBarPct}%` }} />
                )}
              </div>
              <div className={cn("text-[9px] font-black uppercase tracking-widest", isCalExtreme ? "text-rose-400" : "text-slate-500")}>
                {calPct}% of daily goal
              </div>
            </div>

            {/* Macro Grid */}
            <div className="flex gap-4 sm:gap-8 items-end justify-center">
              {[
                { label: 'Protein', short: 'P', val: values.protein, target: targets.protein, color: 'emerald', glow: 'rgba(16,185,129,0.5)' },
                { label: 'Carbs',   short: 'C', val: values.carbs,   target: targets.carbs,   color: 'sky',     glow: 'rgba(14,165,233,0.5)' },
                { label: 'Fat',     short: 'F', val: values.fat,     target: targets.fat,     color: 'amber',   glow: 'rgba(245,158,11,0.5)' }
              ].map((m) => {
                const pct = m.target > 0 ? Math.round((m.val / m.target) * 100) : 0;
                const barPct = Math.min(100, pct);
                const extreme = pct >= 120;
                
                return (
                  <div key={m.short} className="flex flex-col items-center gap-2 group transition-transform hover:scale-105">
                    <div className={cn("text-[9px] font-black transition-colors duration-300", extreme ? "text-rose-400" : "text-emerald-400/80")}>{pct}%</div>
                    <div className="w-2 sm:w-3.5 h-12 sm:h-20 md:h-28 bg-white/5 rounded-full relative overflow-hidden ring-1 ring-white/10">
                      <div 
                        className={cn(
                          "absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out",
                          extreme ? "bg-rose-500" : `bg-${m.color}-500`
                        )}
                        style={{ height: `${barPct}%`, boxShadow: extreme ? `0 0 15px rgba(244,63,94,0.6)` : `0 0 15px ${m.glow}` }} 
                      />
                    </div>
                    <div className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-tighter">{m.short}</div>
                    <div className={cn("text-[8px] font-bold whitespace-nowrap", extreme ? "text-rose-400" : "text-slate-400")}>
                      {m.val}<span className="opacity-40 font-medium">/{m.target}g</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="pt-2 sm:pt-4 border-t border-white/5 w-full">
          <div className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-normal sm:tracking-widest">Macro Balance Performance</div>
        </div>
      </div>
    </div>
  );
});

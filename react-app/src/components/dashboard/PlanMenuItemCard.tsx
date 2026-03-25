import React from 'react';
import { Button } from '../ui/Button';
import type { MenuItem } from '../../types';
import { cn } from '../../lib/utils';

interface PlanMenuItemCardProps {
  item: MenuItem;
  onOpenModal: (item: MenuItem) => void;
  onAction: (item: MenuItem) => void;
  isAddon?: boolean;
  personalizedDiscount: number;
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-normal sm:tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>
);

const getItemImage = (it: MenuItem) => it.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80';

export const PlanMenuItemCard = React.memo(({ 
  item: it, 
  onOpenModal, 
  onAction, 
  isAddon = false,
  personalizedDiscount
}: PlanMenuItemCardProps) => {
  const price = typeof it.priceINR === "number" 
    ? Math.round(it.priceINR * (1 - personalizedDiscount / 100)) 
    : null;

  return (
    <div className="w-full rounded-xl border border-slate-100 bg-white p-2.5 text-left transition-all hover:border-slate-200 hover:shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto cursor-pointer" onClick={() => onOpenModal(it)}>
          <div className="relative shrink-0">
            <img src={getItemImage(it)} alt={it.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" loading="lazy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-slate-900 leading-tight mb-0.5">{it.name}</div>
            {it.description && <div className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium mb-2">{it.description}</div>}
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
              <Pill>{it.calories} kcal</Pill>
              <Pill>P{it.protein}g</Pill>
              {price !== null && (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                  ₹{price}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end sm:w-auto shrink-0 pt-2 border-t border-slate-50 sm:border-0 sm:pt-0">
          <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
            <Pill>{it.calories} kcal</Pill>
            <Pill>P{it.protein}g</Pill>
            {price !== null && (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                ₹{price}
              </span>
            )}
          </div>
          <Button 
            size="sm" 
            className={cn(
              "h-8 px-4 text-[10px] font-black uppercase tracking-wider shadow-sm",
              isAddon ? "bg-amber-500 text-white hover:bg-amber-600 border-amber-600" : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
            onClick={() => onAction(it)}
            disabled={it.available === false}
          >
            {isAddon ? "Attach Add-On" : "Choose Meal"}
          </Button>
        </div>
      </div>
    </div>
  );
});

PlanMenuItemCard.displayName = 'PlanMenuItemCard';

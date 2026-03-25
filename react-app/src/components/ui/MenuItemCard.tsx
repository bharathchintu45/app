import React from 'react';
import type { MenuItem } from '../../types';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface MenuItemCardProps {
  item: MenuItem;
  qty: number;
  onAdd: (item: MenuItem, delta: number) => void;
  onOpenModal: (item: MenuItem) => void;
  getItemImage: (item: MenuItem) => string;
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>
);

export const MenuItemCard = React.memo(({ 
  item: it, 
  qty, 
  onAdd, 
  onOpenModal, 
  getItemImage 
}: MenuItemCardProps) => {
  const isMiddayMidnight = it.category === "Midday-Midnight Kitchen";
  const isBefore11AM = new Date().getHours() < 11;
  const isUnavailable = it.available === false || (isMiddayMidnight && isBefore11AM);

  return (
    <div className={cn("group rounded-xl border border-black/8 p-3 transition-colors", qty > 0 && "border-black/20 bg-black/2")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <img 
            onClick={() => onOpenModal(it)} 
            src={getItemImage(it)} 
            alt={it.name} 
            className="w-20 h-20 rounded-xl object-cover shrink-0 cursor-pointer shadow-sm hover:opacity-80 transition-opacity" 
            loading="lazy" 
          />
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenModal(it)}>
            <div className="font-bold text-sm leading-tight text-slate-900 group-hover:text-emerald-600 transition-colors mb-0.5">{it.name}</div>
            {it.description && <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{it.description}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
              <Pill>{it.calories} kcal</Pill>
              <Pill>P {it.protein}g</Pill>
              <Pill>C {it.carbs}g</Pill>
              <Pill>F {it.fat}g</Pill>
              {it.available === false && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Unavailable</span>
              )}
              {it.available !== false && isMiddayMidnight && isBefore11AM && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 self-center ml-1">Available from 11 AM</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-end self-stretch sm:self-center shrink-0 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
          {typeof it.priceINR === "number" && (
            <span className="text-sm font-black text-slate-900 bg-slate-50 px-2.5 py-1 rounded shadow-sm border border-slate-100 sm:mb-2">₹{it.priceINR}</span>
          )}
          <div>
            {qty === 0 ? (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-sm font-bold shadow-sm border-emerald-500 disabled:opacity-50 disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed"
                onClick={(e) => { e.stopPropagation(); onAdd(it, 1); }}
                disabled={isUnavailable}
              >
                Add
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg border border-emerald-200 p-1 shadow-sm h-8">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" 
                  onClick={(e) => { e.stopPropagation(); onAdd(it, -1); }}
                >
                  −
                </Button>
                <div className="w-5 text-center text-xs font-black text-emerald-800">{qty}</div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={(e) => { e.stopPropagation(); onAdd(it, +1); }} 
                  disabled={isUnavailable}
                >
                  +
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MenuItemCard.displayName = 'MenuItemCard';

import React, { useMemo } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/Typography";
import { UtensilsCrossed, ArrowRight, Search } from "lucide-react";
import { useAppSettingNumber } from "../../hooks/useAppSettings";
import { clamp, digitsOnly, formatDateIndia } from "../../lib/format";
import { SkeletonMenuCard } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { GroupOrderDraft, GroupCart, MenuItem } from "../../types";

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-normal sm:tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>;
}

function getItemImage(it: MenuItem) {
  return it.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80';
}

interface GroupOrderViewProps {
  menu: MenuItem[];
  isLoading?: boolean;
  groupDraft: GroupOrderDraft;
  setGroupDraft: React.Dispatch<React.SetStateAction<GroupOrderDraft>>;
  groupCart: GroupCart;
  setGroupCart: React.Dispatch<React.SetStateAction<GroupCart>>;
  setRoute: (r: any) => void;
  setModalItem: (item: MenuItem | null) => void;
  showToast: (msg: string) => void;
}

export function GroupOrderView({
  menu,
  isLoading,
  groupDraft,
  setGroupDraft,
  groupCart,
  setGroupCart,
  setRoute,
  setModalItem,
  showToast,
}: GroupOrderViewProps) {
  const groupDiscount = useAppSettingNumber("group_discount_pct", 0);
  const [groupCat, setGroupCat] = React.useState<import("../../types").Cat>("Lunch");
  const [groupSearch, setGroupSearch] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    menu.filter((m) => m.category === groupCat).forEach(m => {
      m.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [menu, groupCat]);

  const groupFilteredMenu = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return menu
      .filter((m) => m.category === groupCat)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .filter((m) => !selectedTag || m.tags?.includes(selectedTag));
  }, [menu, groupCat, groupSearch, selectedTag]);

  // Reset tag when category changes
  React.useEffect(() => {
    setSelectedTag(null);
  }, [groupCat]);

  const groupCartItems = useMemo(() => {
    return Object.entries(groupCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: menu.find((m) => m.id === id), qty }))
      .filter((x) => !!x.item) as { item: MenuItem; qty: number }[];
  }, [groupCart, menu]);

  function addToGroup(item: MenuItem, delta: number) {
    const isAvailable = item.available !== false;
    if (!isAvailable && delta > 0) return;
    setGroupCart((prev) => {
      const next = { ...prev };
      const cur = next[item.id] || 0;
      const newQty = clamp(cur + delta, 0, 999);
      if (newQty <= 0) delete next[item.id];
      else next[item.id] = newQty;
      return next;
    });
  }

  const groupLeadOk = useMemo(() => {
    if (!groupDraft.deliveryAt) return false;
    const now = new Date();
    const delivery = new Date(groupDraft.deliveryAt);
    const hours = (delivery.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (groupDraft.people >= 61) return hours >= 24;
    if (groupDraft.people >= 31) return hours >= 6;
    return hours >= 1;
  }, [groupDraft.deliveryAt, groupDraft.people]);

  function goGroupCheckout() {
    if (groupDraft.people < 2 || groupDraft.people > 100) { showToast("Group meals: people must be between 2 and 100."); return; }
    if (!groupLeadOk) { showToast("Group meals: delivery time must follow strict notice (≤30 items: 1–3 hrs, 31–60 items: 6 hrs, 61+ items: 24 hrs)."); return; }
    if (!groupCartItems.length) { showToast("Please add at least one item for the group order."); return; }
    setRoute("checkout-group");
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <SectionTitle icon={UtensilsCrossed} title="Group Meals builder" subtitle="No macro totals; choose items + quantities." />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 p-3">
            <div className="text-sm font-semibold">Headcount</div>
            <div className="mt-2 flex items-center gap-3">
              <Input
                value={String(groupDraft.people)}
                onChange={(e) => setGroupDraft((p) => ({ ...p, people: clamp(Number(digitsOnly(e.target.value) || "0"), 0, 100) }))}
                inputMode="numeric"
                className="max-w-[120px]"
              />
              <span className="text-sm text-black/55">guests (2–100)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-3">
            <div className="text-sm font-semibold">Delivery date & time</div>
            <div className="mt-2 space-y-2">
              <Input type="datetime-local" value={groupDraft.deliveryAt} onChange={(e) => setGroupDraft((p) => ({ ...p, deliveryAt: e.target.value }))} className="w-full" />
              <div className="text-xs text-black/55">
                Selected: {groupDraft.deliveryAt ? formatDateIndia(groupDraft.deliveryAt.split('T')[0]) + ' ' + (groupDraft.deliveryAt.split('T')[1] || '') : "Not set"}
              </div>
              <div className={cn("text-xs font-medium", groupLeadOk ? "text-slate-600" : "text-amber-700")}>
                Notice required: {groupDraft.people >= 61 ? "24 hrs (61+ items)" : groupDraft.people >= 31 ? "6 hrs (31-60 items)" : "1–3 hrs (≤30 items)"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-sm font-semibold">Notes (optional)</div>
          <div className="mt-2">
            <Textarea value={groupDraft.notes} onChange={(e) => setGroupDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g., mild spice, extra napkins" />
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-3">
            <div className="flex flex-wrap gap-2">
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
                <Button key={c} size="sm" variant={groupCat === c ? "secondary" : "outline"} onClick={() => setGroupCat(c as any)}>
                  {c}
                </Button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                value={groupSearch} 
                onChange={(e: any) => setGroupSearch(e.target.value)} 
                placeholder="Search items…" 
                className="pl-10 bg-white border-slate-200 h-8 text-sm w-full" 
              />
            </div>
          </div>

          {/* Tag Filter Row */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
              <button
                onClick={() => setSelectedTag(null)}
                className={cn(
                  "whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                  !selectedTag 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-black/60 border-black/10 hover:border-black/20"
                )}
              >
                All
              </button>
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1.5",
                    selectedTag === tag
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : "bg-white text-black/60 border-black/10 hover:border-black/20"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="text-sm font-semibold mb-3">Add items</div>
          <div className="grid gap-2 md:grid-cols-2 max-h-[500px] overflow-y-auto pr-2 pb-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonMenuCard key={i} />
              ))
            ) : (
              groupFilteredMenu.map((it) => {
                const qty = groupCart[it.id] || 0;
                return (
                  <div key={it.id} className="rounded-2xl border border-black/10 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <img onClick={() => setModalItem(it)} src={getItemImage(it)} alt={it.name} className="w-20 h-20 rounded-xl object-cover shrink-0 cursor-pointer shadow-sm" loading="lazy" />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModalItem(it)}>
                          <div className="font-bold text-sm leading-tight text-slate-900 hover:text-emerald-600 transition-colors mb-0.5">{it.name}</div>
                          {it.description && <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{it.description}</div>}
                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                            <Pill>{it.calories} kcal</Pill>
                            <Pill>P {it.protein}g</Pill>
                            {typeof it.priceINR === "number" && (
                              <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-[10px] line-through text-slate-400">₹{it.priceINR}</span>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm">
                                  ₹{Math.round(it.priceINR * (1 - groupDiscount.value/100))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end sm:flex-col sm:items-end self-stretch sm:self-center shrink-0 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
                        {qty === 0 ? (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-sm font-bold shadow-sm border-emerald-500"
                            onClick={(e) => { e.stopPropagation(); addToGroup(it, 1); }}
                            disabled={it.available === false}
                          >
                            Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg border border-emerald-200 p-1 shadow-sm h-8">
                            <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToGroup(it, -1); }}>−</Button>
                            <div className="w-5 text-center text-xs font-black text-emerald-800">{qty}</div>
                            <Button size="sm" variant="ghost" className="h-[22px] w-[22px] p-0 hover:bg-emerald-100 text-emerald-700 rounded-md" onClick={(e) => { e.stopPropagation(); addToGroup(it, +1); }} disabled={it.available === false}>+</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Group cart</div>
              <div className="text-xs text-black/55">Checkout when ready.</div>
            </div>
            <Button onClick={goGroupCheckout}>
              Checkout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {groupCartItems.length ? (
              groupCartItems.map(({ item, qty }) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-black/55">×{qty}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-black/55">Cart is empty.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

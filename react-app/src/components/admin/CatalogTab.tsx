import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  CalendarDays,
  UtensilsCrossed, 
  Plus,
  Archive,
  ImageUp,
  Search
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { SectionTitle } from "../ui/Typography";
import { Skeleton, SkeletonMenuCard } from "../ui/Skeleton";
import { formatDateTimeIndia, digitsOnly } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { Cat, MenuItem } from "../../types";

type MenuDraft = { 
  id: string; 
  category: Cat; 
  name: string; 
  calories: string; 
  protein: string; 
  carbs: string; 
  fat: string; 
  fiber: string; 
  priceINR: string; 
  available: boolean; 
  description?: string; 
  image?: string; 
};

const emptyDraft = (id: string): MenuDraft => ({ 
  id, 
  category: "All-Day Kitchen", 
  name: "", 
  calories: "", 
  protein: "", 
  carbs: "", 
  fat: "", 
  fiber: "", 
  priceINR: "", 
  available: true, 
  description: "", 
  image: "" 
});

const toDraft = (it: MenuItem): MenuDraft => ({ 
  id: it.id, 
  category: it.category, 
  name: it.name, 
  calories: String(Math.round(it.calories || 0)), 
  protein: String(Math.round(it.protein || 0)), 
  carbs: String(Math.round(it.carbs || 0)), 
  fat: String(Math.round(it.fat || 0)), 
  fiber: String(Math.round(it.fiber || 0)), 
  priceINR: it.priceINR === undefined || it.priceINR === null ? "" : String(Math.round(it.priceINR)), 
  available: it.available !== false, 
  description: it.description || "", 
  image: it.image || "" 
});

const fromDraft = (d: MenuDraft): MenuItem => { 
  const n = (s: string) => Number(digitsOnly(s || "") || "0"); 
  const p = d.priceINR.trim() === "" ? undefined : n(d.priceINR); 
  return { 
    id: d.id.trim(), 
    category: d.category, 
    name: d.name.trim(), 
    calories: n(d.calories), 
    protein: n(d.protein), 
    carbs: n(d.carbs), 
    fat: n(d.fat), 
    fiber: n(d.fiber), 
    priceINR: p, 
    available: d.available, 
    description: d.description?.trim() || undefined, 
    image: d.image?.trim() || undefined 
  }; 
};

interface CatalogTabProps {
  showToast: (msg: string) => void;
  mode: "catalog" | "stock";
}

export default function CatalogTab({ showToast, mode }: CatalogTabProps) {
  const [parsedMenu, setParsedMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [simpleSearch, setSimpleSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<MenuDraft>(() => emptyDraft(""));
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("All");
  const [stockAvailabilityFilter, setStockAvailabilityFilter] = useState<string>("All");

  const BACKUPS_KEY = "tfb_menu_backups_v2";
  const [backups] = useState<any[]>(() => {
    try { 
      const raw = window.localStorage.getItem(BACKUPS_KEY); 
      if (!raw) return []; 
      const p = JSON.parse(raw); 
      return Array.isArray(p) ? p : []; 
    } catch { 
      return []; 
    }
  });

  useEffect(() => {
    fetchMenu();
  }, []);

  async function fetchMenu() {
    setMenuLoading(true);
    const { data } = await supabase.from('menu_items').select('*').order('id');
    if (data) {
      setParsedMenu(data.map((d: any) => {
        const rawCat = d.category || '';
        let mappedCat = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) : 'Add-Ons';
        // Map legacy DB categories
        if (mappedCat === 'Breakfast') mappedCat = 'All-Day Kitchen';
        else if (mappedCat === 'Lunch' || mappedCat === 'Dinner') mappedCat = 'Midday-Midnight Kitchen';
        else if (mappedCat === 'Snack') mappedCat = 'Add-Ons';

        return {
          id: d.id, 
          category: mappedCat as Cat, 
          name: d.name, 
          description: d.description,
          image: d.image_url, 
          calories: d.calories, 
          protein: d.protein, 
          carbs: d.carbs,
          fat: d.fat, 
          fiber: d.fiber, 
          priceINR: d.price_inr, 
          available: d.available
        };
      }) as MenuItem[]);
    }
    setMenuLoading(false);
  }

  async function syncLiveView() {
    await fetchMenu();
    showToast("Live catalog is synced with Database!");
  }

  if (mode === "catalog") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Card className="h-full border-sky-100 bg-sky-50/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <SectionTitle icon={Sparkles} title="Global Publishing" subtitle="Your changes are saved automatically to the database." />
                <Button onClick={syncLiveView} className="bg-sky-600 hover:bg-sky-700 h-10 px-8">Refresh Live View</Button>
              </CardHeader>
            </Card>
          </div>
          <div className="lg:col-span-4">
            <Card className="h-full border-amber-100">
              <CardHeader><SectionTitle icon={CalendarDays} title="Snapshots" subtitle="Backup & Restore" /></CardHeader>
              <CardContent>
                <select className="w-full rounded-xl border border-slate-200 p-2 text-sm bg-white">
                  <option>Choose a version...</option>
                  {backups.map(b => <option key={b.id}>{formatDateTimeIndia(b.at)}</option>)}
                </select>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader><SectionTitle icon={UtensilsCrossed} title="Catalog Editor" subtitle="Modify individual item payloads." /></CardHeader>
          <CardContent className="grid lg:grid-cols-3 gap-8">
            <div className="space-y-4 flex flex-col h-full">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    value={simpleSearch} 
                    onChange={e => setSimpleSearch(e.target.value)} 
                    placeholder="Search..." 
                    className="pl-10 bg-white w-full" 
                  />
                </div>
                <Button
                  onClick={() => {
                    setSelectedId("");
                    setDraft({
                      id: `NEW-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                      name: "New Item",
                      category: "All-Day Kitchen",
                      calories: "0", protein: "0", carbs: "0", fat: "0", fiber: "0", priceINR: "0",
                      description: "", image: "", available: true
                    } as any);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  <Plus size={16} />
                </Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                {menuLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="mb-2">
                      <SkeletonMenuCard />
                    </div>
                  ))
                ) : parsedMenu.filter(x => !simpleSearch || x.name.toLowerCase().includes(simpleSearch.toLowerCase())).map(x => (
                  <button 
                    key={x.id} 
                    onClick={() => { setSelectedId(x.id); setDraft(toDraft(x)); }}
                    className={cn("w-full p-4 rounded-xl border text-left transition-all", selectedId === x.id ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200")}
                  >
                    <div className="text-sm font-bold text-slate-900">{x.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{x.category} • {x.id}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Item Name</label>
                    <Input value={draft.name || ""} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Oatmeal & Berries" className="text-sm font-bold bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description</label>
                    <Input value={draft.description || ""} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Short appetizing description..." className="text-sm bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Image</label>
                    <div className="flex gap-3 items-start">
                      {draft.image && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                          <img src={draft.image} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50 text-sm text-slate-600 font-medium transition-colors">
                          <ImageUp size={16} className="text-emerald-600" />
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > 2 * 1024 * 1024) {
                                showToast('File too large (Max 2MB)');
                                return;
                              }

                              const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                              if (!allowedTypes.includes(file.type)) {
                                showToast('Unsupported file type. Use JPEG, PNG, or WebP.');
                                return;
                              }

                              const ext = file.name.split('.').pop();
                              const path = `${draft.id || Date.now()}.${ext}`;
                              const { error: upErr } = await supabase.storage
                                .from('menu-images')
                                .upload(path, file, { upsert: true });
                              
                              if (upErr) { showToast('Upload failed: ' + upErr.message); return; }
                              const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path);
                              setDraft({ ...draft, image: urlData.publicUrl });
                            }}
                          />
                        </label>
                        <Input
                          value={draft.image || ""}
                          onChange={e => setDraft({...draft, image: e.target.value})}
                          placeholder="Or paste URL..."
                          className="text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {["calories", "protein", "carbs", "fat", "fiber", "priceINR"].map(f => (
                    <div key={f}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 truncate">{f === "priceINR" ? "Price (₹)" : f}</label>
                      <Input 
                        type="number" 
                        value={(draft as any)[f] || 0} 
                        onChange={e => setDraft({...draft, [f]: e.target.value} as any)} 
                        className="text-sm font-medium bg-white px-2" 
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                    <select 
                      value={draft.category} 
                      onChange={e => setDraft({...draft, category: e.target.value as Cat})}
                      className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg py-1 px-3"
                    >
                      <option value="All-Day Kitchen">All-Day Kitchen</option>
                      <option value="Midday-Midnight Kitchen">Midday-Midnight Kitchen</option>
                      <option value="Add-Ons">Add-Ons</option>
                    </select>
                  </div>
                  <div className="w-px h-6 bg-slate-200" />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={draft.available !== false}
                      onChange={(e) => setDraft({...draft, available: e.target.checked})}
                      className="hidden"
                    />
                    <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${draft.available !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${draft.available !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      {draft.available !== false ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </label>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <Button onClick={async () => {
                    const item = fromDraft(draft);
                    const { error } = await api.v1.updateCatalog({
                      item: {
                        id: item.id, 
                        category: item.category, 
                        name: item.name, 
                        description: item.description,
                        image_url: item.image, 
                        calories: item.calories, 
                        protein: item.protein, 
                        carbs: item.carbs,
                        fat: item.fat, 
                        fiber: item.fiber, 
                        price_inr: item.priceINR, 
                        available: item.available
                      }
                    });
                    if (error) { showToast("Error saving: " + error.message); return; }
                    await fetchMenu();
                    showToast(`Saved ${item.name} to live database!`);
                  }}>Commit to Live DB</Button>
                  <Button variant="ghost" className="text-rose-600" onClick={async () => {
                    if (!confirm("Delete this item permanently?")) return;
                    const { error } = await api.v1.updateCatalog({
                      action: 'delete',
                      itemId: selectedId
                    });
                    if (error) { showToast("Error deleting: " + error.message); return; }
                    await fetchMenu();
                    setSelectedId("");
                    setDraft(emptyDraft(""));
                  }}>Remove Item</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Stock Management Mode
  return (
    <motion.div key="stock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <SectionTitle icon={Archive} title="Stock Management" subtitle="Quickly toggle inventory availability." />
          <Button onClick={syncLiveView} className="bg-sky-600 hover:bg-sky-700 h-10 px-8 shadow-md">Publish Changes to Live Site</Button>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative md:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={simpleSearch} onChange={e => setSimpleSearch(e.target.value)} placeholder="Filter items by name..." className="pl-9 bg-white w-full" />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {["All", "All-Day Kitchen", "Midday-Midnight Kitchen", "Add-Ons"].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setStockCategoryFilter(c)}
                    className={cn("text-xs font-bold rounded-lg py-1.5 px-3 transition-colors border", stockCategoryFilter === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100")}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-slate-300 hidden md:block" />

              <div className="flex flex-wrap gap-2 flex-grow">
                {["All", "In Stock", "Out of Stock"].map(a => (
                  <button 
                    key={a} 
                    onClick={() => setStockAvailabilityFilter(a)}
                    className={cn("text-xs font-bold rounded-lg py-1.5 px-3 transition-colors border", stockAvailabilityFilter === a ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100")}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {menuLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                    <div className="flex justify-end"><Skeleton className="h-6 w-10 rounded-full" /></div>
                  </div>
                ))
              ) : parsedMenu
                .filter(x => !simpleSearch || x.name.toLowerCase().includes(simpleSearch.toLowerCase()))
                .filter(x => stockCategoryFilter === "All" || x.category === stockCategoryFilter)
                .filter(x => stockAvailabilityFilter === "All" || (stockAvailabilityFilter === "In Stock" ? x.available !== false : x.available === false))
                .map(item => (
                  <div key={item.id} className={cn("p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all", item.available !== false ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300 opacity-60')}>
                    <div className="flex-1 truncate pr-4">
                      <div className={cn("text-sm font-bold truncate", item.available !== false ? 'text-slate-900' : 'text-slate-500 line-through')} title={item.name}>{item.name}</div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">{item.category} • {item.id}</div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", item.available !== false ? 'text-emerald-600' : 'text-slate-400')}>
                        {item.available !== false ? 'IN' : 'OUT'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={item.available !== false}
                        onChange={async (e) => {
                          const nextAvail = e.target.checked;
                          setParsedMenu(prev => prev.map(x => x.id === item.id ? { ...x, available: nextAvail } : x));
                          const { error } = await api.v1.updateCatalog({
                            item: { id: item.id, available: nextAvail }
                          });
                          if(error) { showToast("Error updating stock"); fetchMenu(); }
                        }}
                        className="hidden"
                      />
                      <div className={cn("w-10 h-6 flex flex-shrink-0 items-center rounded-full p-1 transition-colors", item.available !== false ? 'bg-emerald-500' : 'bg-slate-300')}>
                        <div className={cn("bg-white w-4 h-4 rounded-full shadow-md transform transition-transform", item.available !== false ? 'translate-x-4' : 'translate-x-0')} />
                      </div>
                    </label>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

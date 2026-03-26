import React, { useState, useEffect, useMemo } from "react";
import type { MenuItem, Slot, OrderReceipt, AppUser, Route, DeliveryDetails, OrderKind } from "../types";
import { useUser } from "../contexts/UserContext";
import { useCart } from "../contexts/CartContext";
import { usePlan } from "../contexts/PlanContext";
import { motion, AnimatePresence } from "framer-motion";
import { buildPlanFromSubscription, makeOrderId } from "../data/menu";
import { useRazorpay } from "../hooks/useRazorpay";
import { useMenu } from "../hooks/useMenu";
import { supabase } from "../lib/supabase";
import { useAppSetting, useAppSettingNumber, useAppSettingString } from "../hooks/useAppSettings";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { SectionTitle, LuxuryLabel } from "../components/ui/Typography";
import { formatINR, formatDateTimeIndia, formatDateIndia, dayKey, addDays, parseDateKeyToDate, digitsOnly } from "../lib/format";
import { cn } from "../lib/utils";
import { User, Sparkles, MapPin, Plus, LocateFixed, ArrowRight, Store, Navigation, Map as MapIcon, CheckCircle2, AlertTriangle, Package, Clock, Receipt, ChevronRight, ShieldCheck } from "lucide-react";
import { MapPicker } from "../components/ui/MapPicker";
import { OrderStatusOverlay } from "../components/ui/OrderStatusOverlay";
import { api } from "../lib/api";

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-black/5 text-black/60">{children}</span>;
}

function computePriceSummary(items: Array<{ price?: number; qty: number }>, gstRate: number, discountPct: number = 0, deliveryFee: number = 0, isFreeDelivery: boolean = false) {
  const subtotal = items.reduce((acc, it) => acc + (it.price ?? 0) * it.qty, 0);
  const discount = subtotal * (discountPct / 100);
  const discountedSubtotal = subtotal - discount;
  const gst = discountedSubtotal * gstRate;
  const effectiveDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const total = discountedSubtotal + gst + effectiveDeliveryFee;
  return { subtotal, discount, discountedSubtotal, gstRate, gst, deliveryFee, isFreeDelivery, total, currency: "INR" as const };
}

function PriceBox({
  title,
  items,
  gstRate,
  discountPct = 0,
  discountLabel = "Discount",
  deliveryFee = 0,
  isFreeDelivery = false
}: {
  title: string;
  items: Array<{ name: string; qty: number; price?: number; image?: string }>;
  gstRate: number;
  discountPct?: number;
  discountLabel?: string;
  deliveryFee?: number;
  isFreeDelivery?: boolean;
}) {
  const subtotal = items.reduce((acc, it) => acc + (it.price ?? 0) * it.qty, 0);
  const discount = subtotal * (discountPct / 100);
  const discountedSubtotal = subtotal - discount;
  const gst = discountedSubtotal * gstRate;
  const effectiveDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const total = discountedSubtotal + gst + effectiveDeliveryFee;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
            <Receipt size={16} />
          </div>
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
        <div className="bg-slate-100 px-2.5 py-1 rounded-full text-[9px] font-black uppercase text-slate-500 tracking-wider whitespace-nowrap">
          Tax Included · GST ({Math.round(gstRate * 100)}%)
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {items.length ? (
          items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {it.image ? (
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
                  <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-400 flex-shrink-0 border border-indigo-100 shadow-sm">
                  <Package size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate leading-tight mb-0.5">{it.name}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty: {it.qty}</div>
              </div>
              <div className="text-sm font-black text-slate-900 ml-2">
                {typeof it.price === 'number' ? formatINR(it.price * it.qty) : "—"}
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <span className="text-xs text-slate-400 font-medium">No items selected</span>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-black/10 pt-4 text-sm space-y-2">
        <div className="flex items-center justify-between text-black/60">
          <span>Subtotal</span>
          {discount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-black/40 line-through text-xs font-normal">{formatINR(subtotal)}</span>
              <span className="font-medium text-black">{formatINR(discountedSubtotal)}</span>
            </div>
          ) : (
            <span className="font-medium text-black">{formatINR(subtotal)}</span>
          )}
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between text-green-700 font-semibold">
            <span>{discountLabel} ({discountPct}%)</span>
            <span className="font-medium">-{formatINR(discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-black/60">
          <span>GST ({Math.round(gstRate * 100)}%)</span>
          <span className="font-medium text-black">{formatINR(gst)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex items-center justify-between text-black/60">
            <span>Delivery Fee</span>
            {isFreeDelivery ? (
              <div className="flex items-center gap-2">
                <span className="text-black/40 line-through text-xs">{formatINR(deliveryFee)}</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>
            ) : (
              <span className="font-medium text-black">{formatINR(deliveryFee)}</span>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="text-base font-bold text-slate-900">Total</span>
          <span className="text-xl font-black text-emerald-600">{formatINR(total)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailedScheduleReview({ lines }: { lines: Array<{ day: string; slot: Slot; item: MenuItem }> }) {
  if (!lines.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-slate-400" />
        Schedule Review
      </div>
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
        {lines.map((l, idx) => (
          <div key={idx} className="flex items-start justify-between text-xs border-b border-slate-50 pb-2 last:border-0">
            <div>
              <div className="font-semibold text-slate-800">{formatDateIndia(l.day)}</div>
              <div className="text-slate-500 uppercase tracking-tighter font-bold text-[9px]">{l.slot} • {l.item.name}</div>
            </div>
            <div className="text-slate-700 font-bold shrink-0">Planned</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckoutCommon({
  headline,
  onBack,
  backLabel = "Back to Home",
  onPlace,
  summaryRight,
  showToast,
  hideSignInNote,
  extraContent,
  submitLabel,
  submitDisabled,
  enableFulfillmentToggle,
  onFulfillmentTypeChange,
}: {
  headline: string;
  onBack: () => void;
  backLabel?: string;
  onPlace: (details: { delivery: DeliveryDetails; payment: string }) => void;
  showToast: (msg: string) => void;
  summaryRight: React.ReactNode;
  hideSignInNote?: boolean;
  extraContent?: React.ReactNode;
  submitLabel?: string;
  submitDisabled?: boolean;
  enableFulfillmentToggle?: boolean;
  onFulfillmentTypeChange?: (type: "pickup" | "delivery") => void;
}) {
  const { user, setUser } = useUser();
  const pickupSetting = useAppSetting("enable_pickup", true);
  const deliverySetting = useAppSetting("enable_delivery", true);
  const storeAddressSetting = useAppSettingString("store_physical_address", "The Fresh Box\n123 Health Avenue, Fitness District\nCity Center, 500001");
  const storeMapUrlSetting = useAppSettingString("store_map_url", "https://maps.google.com/?q=12.9715987,77.5945627");
  const googleMapsApiKeySetting = useAppSettingString("google_maps_api_key", "");
  const googleMapsApiKey = googleMapsApiKeySetting.value || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");

  // Force fulfillmentType if only one option is available
  useEffect(() => {
     let updatedType: "delivery" | "pickup" = fulfillmentType;
     if (!deliverySetting.value && pickupSetting.value) updatedType = "pickup";
     if (deliverySetting.value && !pickupSetting.value) updatedType = "delivery";
     
     if (updatedType !== fulfillmentType) {
       setFulfillmentType(updatedType);
       onFulfillmentTypeChange?.(updatedType);
     }
  }, [deliverySetting.value, pickupSetting.value]);

  // 'primary' = use defaultDelivery, number = savedAddresses[n], 'new' = new address form
  const hasDefault = !!(user?.defaultDelivery?.building);
  const hasSaved = !!(user?.savedAddresses?.length);
  const [selectedIdx, setSelectedIdx] = useState<'primary' | number | "new">(
    hasDefault ? 'primary' : hasSaved ? 0 : "new"
  );
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [geoPermission, setGeoPermission] = useState<PermissionState | "unsupported">("prompt");

  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        setGeoPermission(status.state);
        status.onchange = () => setGeoPermission(status.state);
      });
    } else {
      setGeoPermission("unsupported");
    }
  }, []);

  const initialDelivery = (idx: 'primary' | number | "new"): DeliveryDetails => {
    if (idx === 'primary' && user?.defaultDelivery) return { ...user.defaultDelivery };
    if (idx !== "new" && typeof idx === 'number' && user?.savedAddresses?.[idx]) return { ...user.savedAddresses[idx] };
    return {
      receiverName: user?.name || "",
      receiverPhone: user?.phone ? digitsOnly(user.phone) : "",
      locationType: "House",
      building: "",
      street: "",
      area: "",
      addressLabel: "",
      instructions: "",
    };
  };

  const [delivery, setDelivery] = useState<DeliveryDetails>(initialDelivery(selectedIdx));

  // Sync delivery when selection changes
  useEffect(() => {
    setDelivery(initialDelivery(selectedIdx));
  }, [selectedIdx]);

  // Get preview address for selected saved address
  const selectedAddrPreview = useMemo(() => {
    if (selectedIdx === 'primary') return user?.defaultDelivery;
    if (typeof selectedIdx === 'number') return user?.savedAddresses?.[selectedIdx];
    return null;
  }, [selectedIdx, user]);

  const detectLocation = () => {
    if (!navigator.geolocation) { setGpsStatus("❌ Geolocation not supported on this device."); return; }
    setGpsStatus("📡 Detecting your location…");
    navigator.geolocation.getCurrentPosition((pos) => {
      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      setDelivery(prev => ({
        ...prev,
        ...newPos,
        area: prev.area || "Location pinned on map",
        instructions: prev.instructions || "Location detected via GPS.",
      }));
      setShowMap(true);
      setGpsStatus("✅ Position detected! You can drag the pin on the map for extra precision.");

      // Reverse Geocode immediately to fill fields
      if (typeof window !== "undefined" && (window as any).google && (window as any).google.maps && (window as any).google.maps.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: newPos }, (results: any, status: any) => {
          if (status === 'OK' && results?.[0]) {
            const comps: any = {};
            results[0].address_components.forEach((c: any) => {
              if (c.types.includes('sublocality_level_1') || c.types.includes('locality')) comps.area = c.long_name;
              if (c.types.includes('route')) comps.street = c.long_name;
              if (c.types.includes('subpremise') || c.types.includes('premise')) comps.building = c.long_name;
            });
            setDelivery(prev => ({
              ...prev,
              area: comps.area || prev.area,
              street: comps.street || prev.street,
              building: comps.building || prev.building
            }));
          }
        });
      }
    }, () => {
      // Fallback: Default to Hyderabad if geolocation fails
      setDelivery(prev => ({
        ...prev,
        lat: prev.lat || 17.3850, 
        lng: prev.lng || 78.4867,
      }));
      setShowMap(true);
      setGpsStatus("ℹ️ Location access not granted. We've centered the map on Hyderabad; please pin your location manually.");
    });
  };

  const handlePlaceOrder = async () => {
    if (fulfillmentType === "pickup") {
      onPlace({ delivery: { ...delivery, isPickup: true }, payment: 'razorpay' });
      return;
    }

    if (!delivery.receiverName.trim()) return showToast("Please enter receiver name.");
    if (delivery.receiverPhone.slice(-10).length !== 10) return showToast("Please enter a valid phone number.");
    if (!delivery.building.trim()) return showToast("Please enter building/floor.");
    if (!delivery.street.trim()) return showToast("Please enter street name.");
    if (!delivery.area.trim()) return showToast("Please enter area.");

    // Robust Auto-save logic: If any address is provided, ensure it's set as default and added to saved list if new.
    if (user?.id && setUser && delivery.building) {
      const currentDefault = user.defaultDelivery;
      const savedList = user.savedAddresses || [];
      
      const isNewDefault = !currentDefault?.building || 
        currentDefault.building !== delivery.building || 
        currentDefault.street !== delivery.street || 
        currentDefault.area !== delivery.area;
        
      const isAlreadyInSaved = savedList.some(a => 
        a.building === delivery.building && a.street === delivery.street && a.area === delivery.area
      );

      if (isNewDefault || !isAlreadyInSaved) {
        const updatedSavedAddresses = isAlreadyInSaved ? savedList : [...savedList, delivery];
        const updatedUser: AppUser = { 
          ...user, 
          defaultDelivery: delivery,
          savedAddresses: updatedSavedAddresses
        };
        
        setUser(updatedUser);
        
        // Save to Database (Awaited to prevent race conditions on refresh)
        const { error } = await supabase.from('profiles').update({
          default_delivery: delivery,
          saved_addresses: updatedSavedAddresses,
        }).eq('id', user.id);
        
        if (error) console.error("[Checkout] Error auto-saving default address:", error);
      }
    }

    onPlace({ delivery: { ...delivery, isPickup: false }, payment: 'razorpay' });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6 animate-fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-bold">{headline}</div>
          {!hideSignInNote ? <div className="text-sm text-black/55">Checkout</div> : null}
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="text-sm font-semibold text-black/60 hover:text-black transition-colors flex items-center gap-1.5">
            ← {backLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-col-reverse lg:grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <SectionTitle icon={User} title="Delivery Details" subtitle="Where should we send your food?" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fulfillment Toggle */}
              {enableFulfillmentToggle && (pickupSetting.value || deliverySetting.value) && (
                <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                  {deliverySetting.value && (
                    <button
                      onClick={() => {
                        setFulfillmentType("delivery");
                        onFulfillmentTypeChange?.("delivery");
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2",
                        fulfillmentType === "delivery" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <MapPin size={16} /> Delivery
                    </button>
                  )}
                  {pickupSetting.value && (
                    <button
                      onClick={() => {
                        setFulfillmentType("pickup");
                        onFulfillmentTypeChange?.("pickup");
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2",
                        fulfillmentType === "pickup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <Store size={16} /> Store Pickup
                    </button>
                  )}
                </div>
              )}

              {fulfillmentType === "pickup" ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-2xl text-center space-y-5">
                  <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                    <Store size={32} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Pick up from Store</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto whitespace-pre-wrap">{storeAddressSetting.value}</p>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4 mt-6 border-t border-emerald-100/50 pt-6">
                     <div className="space-y-1.5 text-left">
                       <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pickup Name *</label>
                       <Input value={delivery.receiverName} onChange={(e) => setDelivery({...delivery, receiverName: e.target.value})} placeholder="Your Name" className="bg-white border-emerald-100 focus:ring-emerald-400" />
                     </div>
                     <div className="space-y-1.5 text-left">
                       <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone Number *</label>
                       <Input inputMode="numeric" value={delivery.receiverPhone.slice(-10)} onChange={(e) => setDelivery({...delivery, receiverPhone: digitsOnly(e.target.value)})} placeholder="10 digit number" className="bg-white border-emerald-100 focus:ring-emerald-400" />
                     </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl font-bold mt-4"
                    onClick={() => window.open(storeMapUrlSetting.value, "_blank")}
                  >
                    <Navigation className="mr-2" size={16} /> Get Directions
                  </Button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* GPS status banner — replaces blocking alert */}
                  {gpsStatus && (
                    <div className={`p-3 rounded-xl text-sm font-medium ${
                      gpsStatus.startsWith('✅') ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                      gpsStatus.startsWith('❌') ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>{gpsStatus}</div>
                  )}

                  {/* Address chip selector */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Delivery Address</label>
                <div className="flex flex-wrap gap-3">
                  {/* Default / primary address chip */}
                  {user?.defaultDelivery?.building && (
                    <button
                      onClick={() => setSelectedIdx('primary')}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm transition-all",
                        selectedIdx === 'primary' ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-900" : "border-slate-100 bg-white hover:border-slate-300"
                      )}
                    >
                      <MapPin size={16} className={cn(selectedIdx === 'primary' ? "text-slate-900" : "text-black/40")} />
                      <div className="text-left">
                        <div className="font-bold leading-tight flex items-center gap-2">{user.defaultDelivery.addressLabel || "Home"} <Pill>Default</Pill></div>
                        <div className="text-[10px] text-black/50 truncate max-w-[120px]">{user.defaultDelivery.area}</div>
                      </div>
                    </button>
                  )}
                  {/* Other saved addresses chips */}
                  {user?.savedAddresses?.map((addr, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm transition-all",
                        selectedIdx === i ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-900" : "border-slate-100 bg-white hover:border-slate-300"
                      )}
                    >
                      <MapPin size={16} className={cn(selectedIdx === i ? "text-slate-900" : "text-slate-400")} />
                      <div className="text-left">
                        <div className="font-bold leading-tight">{addr.addressLabel || "Saved Address"}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{addr.area}</div>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedIdx("new")}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm transition-all border-dashed",
                      selectedIdx === "new" ? "border-slate-900 bg-slate-50 text-slate-900 shadow-sm" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <Plus size={16} className="text-slate-900" />
                    <span className="font-bold">New Address</span>
                  </button>
                </div>

                {/* Full address preview for selected saved address */}
                {selectedAddrPreview && selectedIdx !== 'new' && (
                  <div className="p-3 rounded-xl bg-black/5 border border-black/10 text-sm text-black/80">
                    <div className="font-semibold text-slate-800">{selectedAddrPreview.receiverName} · {selectedAddrPreview.receiverPhone}</div>
                    <div className="text-slate-600 mt-0.5">{[selectedAddrPreview.building, selectedAddrPreview.street, selectedAddrPreview.area].filter(Boolean).join(', ')}</div>
                    {selectedAddrPreview.instructions && <div className="text-slate-400 text-xs mt-1 italic">📝 {selectedAddrPreview.instructions}</div>}
                  </div>
                )}
               </div>
              
              {!googleMapsApiKey && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                  ⚠️ Google Maps API Key not configured by admin. Pin on map feature is disabled.
                </div>
              )}

              {/* Address fields — shown when 'new' selected or always for edits */}
              <div className={cn("space-y-5", selectedIdx !== 'new' ? "hidden" : "")}>
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={detectLocation}
                    className={cn(
                      "flex-1 rounded-xl bg-slate-900 text-white hover:bg-black border-none h-11",
                      geoPermission === 'prompt' ? "ring-2 ring-indigo-500 ring-offset-2" : ""
                    )}
                  >
                    <LocateFixed size={18} className="mr-2" /> 
                    {gpsStatus?.includes("Detecting") ? "Detecting..." : 
                     geoPermission === 'prompt' ? "Allow & Detect Location" : "Detect My Location"}
                  </Button>
                  {googleMapsApiKey && (
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowMap(!showMap)}
                      className="flex-1 rounded-xl border-slate-200 h-11"
                    >
                      <MapIcon size={18} className="mr-2" /> {showMap ? "Hide Map" : "Pin on Map"}
                    </Button>
                  )}
                </div>

                {gpsStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-xl text-xs font-semibold border flex items-start gap-3",
                      gpsStatus.includes("✅") ? "bg-emerald-50 border-emerald-100 text-emerald-800" : 
                      gpsStatus.includes("❌") || gpsStatus.includes("not granted") ? "bg-rose-50 border-rose-100 text-rose-800 shadow-sm" : 
                      "bg-indigo-50 border-indigo-100 text-indigo-800 animate-pulse"
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      {gpsStatus.includes("✅") ? <CheckCircle2 size={16} /> : 
                       gpsStatus.includes("📡") ? <LocateFixed size={16} /> : 
                       <AlertTriangle size={16} />}
                    </div>
                    <div className="space-y-1">
                      <p>{gpsStatus}</p>
                      {(gpsStatus.includes("not granted") || gpsStatus.includes("denied")) && (
                        <p className="text-[10px] font-normal opacity-80 leading-relaxed italic">
                          Tip: Click the 🔒 lock icon in your browser address bar to allow location access for this site.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {showMap && googleMapsApiKey && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <MapPicker 
                      apiKey={googleMapsApiKey}
                      initialPos={delivery.lat && delivery.lng ? { lat: delivery.lat, lng: delivery.lng } : undefined}
                      onPositionChange={(pos, comps) => {
                        setDelivery(prev => ({ 
                          ...prev, 
                          lat: pos.lat, 
                          lng: pos.lng,
                          area: comps?.area || prev.area,
                          street: comps?.street || prev.street,
                          building: comps?.building || prev.building
                        }));
                      }}
                    />
                  </motion.div>
                )}

                <div className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-slate-50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receiver Name</label>
                    <Input value={delivery.receiverName} onChange={(e) => setDelivery({...delivery, receiverName: e.target.value})} placeholder="Who is receiving?" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receiver Phone</label>
                    <div className="flex gap-2">
                      <Input value="+91" disabled className="w-16 bg-slate-50 text-center px-1" />
                      <Input className="flex-1" inputMode="numeric" value={delivery.receiverPhone.slice(-10)}
                        onChange={(e) => setDelivery({...delivery, receiverPhone: digitsOnly(e.target.value)})} placeholder="10 digit number" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location Type</label>
                  <div className="flex gap-2">
                    {(["House", "Office", "Other"] as const).map((t) => (
                      <Button key={t} variant={delivery.locationType === t ? "secondary" : "outline"} size="sm"
                        onClick={() => setDelivery({...delivery, locationType: t})} className="flex-1">{t}</Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Building / Floor *</label>
                    <Input value={delivery.building} onChange={(e) => setDelivery({...delivery, building: e.target.value})} placeholder="e.g. 4th Floor, Skyline Apts" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Street Name *</label>
                    <Input value={delivery.street} onChange={(e) => setDelivery({...delivery, street: e.target.value})} placeholder="e.g. MG Road" />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Area / Location *</label>
                    <Input value={delivery.area} onChange={(e) => setDelivery({...delivery, area: e.target.value})} placeholder="e.g. Indiranagar, Bangalore" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Save As (e.g. Home, Office)</label>
                    <Input value={delivery.addressLabel} onChange={(e) => setDelivery({...delivery, addressLabel: e.target.value})} placeholder="e.g. My Gym" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Instructions</label>
                  <Textarea value={delivery.instructions} onChange={(e) => setDelivery({...delivery, instructions: e.target.value})}
                    placeholder="e.g. Leave at the gate, Call on arrival" className="resize-none" />
                </div>
              </div>
              </motion.div>
              )}
            </CardContent>
          </Card>


        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] flex flex-col shadow-xl shadow-slate-200/40 border-slate-200/60 rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <LuxuryLabel text="Order summary" />
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100/50">
                  <ShieldCheck className="w-3 h-3" /> Secure
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium uppercase tracking-tighter">Review your items and final total</div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                {summaryRight}
                {extraContent}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-4xl px-2 text-center sm:text-left">
        <AnimatePresence>
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="backdrop-blur-xl bg-white/95 border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[2rem] p-3 sm:p-4 flex items-center justify-between gap-4"
          >
            <div className="flex-1 hidden sm:block pl-2">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-0.5">
                Final Step
              </div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                Review and place your order securely.
              </div>
            </div>
            
            <div className="w-full sm:w-auto">
              <Button
                size="lg"
                disabled={submitDisabled}
                className="w-full sm:w-64 text-base font-black uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] bg-emerald-600 hover:bg-emerald-700 text-white h-12 sm:h-14 rounded-2xl transition-all hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] active:scale-95 flex items-center justify-center gap-2"
                onClick={handlePlaceOrder}
              >
                {submitLabel ?? "PAY"} <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Buffer for floating bar */}
      <div className="h-24 sm:h-32" />
    </div>
  );
}

export function CheckoutRegularPage({
  setRoute,
  setLastOrder,
  showToast,
}: {
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
}) {
  const { user } = useUser();
  const { regularCart, setRegularCart } = useCart();
  const { menu: MENU } = useMenu();
  const cartItems = useMemo(() => {
    return Object.entries(regularCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: MENU.find((m) => m.id === id), qty }))
      .filter((x) => !!x.item) as { item: MenuItem; qty: number }[];
  }, [regularCart, MENU]);

  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const deliveryFeeSetting = useAppSettingNumber("delivery_fee", 0);
  const freeDeliverySetting = useAppSetting("free_delivery_enabled", false);
  const [gstRate, setGstRate] = useState(0.05);

  useEffect(() => {
    if (!taxSetting.loading) {
      setGstRate(taxSetting.value / 100);
    }
  }, [taxSetting.value, taxSetting.loading]);

  const priceItems = useMemo(() => cartItems.map(({ item, qty }) => ({ name: item.name, qty, price: item.priceINR, image: item.image })), [cartItems]);
  const [payError, setPayError] = useState("");
  const { openPayment, loading: payLoading } = useRazorpay();
  const [isPickup, setIsPickup] = useState(false);
  const [orderStatus, setOrderStatus] = useState<"success" | "failure" | "none">("none");

  return (
    <CheckoutCommon
      headline="Complete Your Order"
      onBack={() => setRoute("home")}
      showToast={showToast}
      enableFulfillmentToggle={true}
      onFulfillmentTypeChange={(type) => setIsPickup(type === 'pickup')}
      onPlace={async (d) => {
        if (!user) { showToast("Please sign in to place an order."); return; }
        setPayError("");

        // Address saving is now handled centrally in CheckoutCommon.handlePlaceOrder

        const orderNumber = makeOrderId();
        const summary = computePriceSummary(
          cartItems.map(({ item, qty }) => ({ price: item.priceINR, qty })),
          gstRate,
          0,
          isPickup ? 0 : deliveryFeeSetting.value,
          freeDeliverySetting.value
        );

        // Step 1: Pre-create order in DB as "pending" so Razorpay Webhook can recover it if frontend crashes
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const { data: dbOrder, error: orderErr } = await supabase.from('orders').insert({
          order_number: orderNumber, user_id: user.id, customer_name: d.delivery.receiverName,
          delivery_date: new Date().toISOString().slice(0, 10),
          status: 'pending', kind: 'regular', payment_status: 'pending',
          subtotal: Math.round(summary.subtotal), gst_amount: Math.round(summary.gst),
          delivery_fee: Math.round(summary.deliveryFee), total: Math.round(summary.total),
          delivery_details: d.delivery,
          meta: { delivery_otp: deliveryOtp }
        }).select('id').single();

        if (orderErr || !dbOrder) { setPayError(`Order initialization failed: ${orderErr?.message}`); return; }

        if (cartItems.length > 0) {
          await supabase.from('order_items').insert(
            cartItems.map(({ item, qty }) => ({ order_id: dbOrder.id, menu_item_id: item.id, item_name: item.name, quantity: qty, unit_price: item.priceINR }))
          );
        }

        // Step 2: Open Razorpay
        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: async (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
            // Clean up the draft order since payment failed/dismissed
            await supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', dbOrder.id);
          },
          onSuccess: async (paymentId, razorpayOrderId) => {
            setOrderStatus("success");

            // Mark order as paid and preparing
            await supabase.from('orders').update({
              status: 'preparing',
              payment_status: 'paid',
              meta: { delivery_otp: deliveryOtp, razorpay_payment_id: paymentId, razorpay_order_id: razorpayOrderId }
            }).eq('id', dbOrder.id);

            const receipt: OrderReceipt = {
              id: orderNumber, kind: "regular", createdAt: Date.now(),
              headline: "Order Confirmed", deliveryAtLabel: "Next available delivery",
              customer: { ...d.delivery, receiverPhone: "+91" + d.delivery.receiverPhone.slice(-10), instructions: d.delivery.instructions || undefined },
              payment: "PAID",
              lines: cartItems.map(({ item, qty }) => ({ itemId: item.id, label: item.name, qty, unitPriceAtOrder: item.priceINR })),
              priceSummary: summary,
            };
            setLastOrder(receipt);
            setRegularCart({});
            
            setTimeout(() => {
              setRoute("order-confirmation");
            }, 2000);
          },
        });
      }}
      extraContent={
        <>
          {payError ? <div className="mt-3 p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">{payError}</div> : null}
          <OrderStatusOverlay status={orderStatus} onClose={() => setOrderStatus("none")} />
        </>
      }
      submitLabel={payLoading ? "Opening Payment..." : "PAY"}
      submitDisabled={payLoading}
      summaryRight={
        <PriceBox 
          title="Cart Items" 
          items={priceItems} 
          gstRate={gstRate} 
          deliveryFee={isPickup ? 0 : deliveryFeeSetting.value} 
          isFreeDelivery={freeDeliverySetting.value}
        />
      }
    />
  );
}

export function CheckoutPersonalPage({
  setRoute,
  setLastOrder,
  showToast,
}: {
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
}) {
  const { user, setUser } = useUser();
  const { 
    subscription, 
    planMap, 
    holds, 
    startDates, 
    targetMap,
    dateSlotAddons,
    clearPlanningState 
  } = usePlan();
  const plan = useMemo(() => buildPlanFromSubscription(subscription), [subscription]);
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const startKey = startDates[subscription] || startDates['last_selected'] || tomorrowKey;
  const startDate = useMemo(() => parseDateKeyToDate(startKey), [startKey]);
  const dates = useMemo(() => Array.from({ length: plan.duration }, (_, i) => dayKey(addDays(startDate, i))), [plan.duration, startDate]);

  const chargeable = useMemo(() => {
    const lines: Array<{ day: string; slot: Slot; item: MenuItem; qty: number; type?: 'meal' | 'addon' }> = [];
    for (const dk of dates) {
      const hold = holds[dk] || { day: false, slots: {} };
      if (hold.day) continue;
      const dp = planMap[dk] || {};
      for (const s of plan.allowedSlots) {
        if (hold.slots[s]) continue;
        const it = dp[s];
        if (it) lines.push({ day: dk, slot: s, item: it, qty: 1, type: 'meal' });
      }
      // Include addons for this day
      const dayAddons = dateSlotAddons[dk];
      if (dayAddons) {
        for (const s of plan.allowedSlots) {
          if (hold.slots[s]) continue;
          const addonList = dayAddons[s] || [];
          for (const a of addonList) {
            lines.push({ day: dk, slot: s, item: a.item, qty: a.qty, type: 'addon' });
          }
        }
      }
    }

    const agg = new Map<string, { id: string; name: string; qty: number; price?: number; image?: string }>();
    for (const l of lines) {
      const key = l.item.id;
      const cur = agg.get(key);
      if (cur) cur.qty += l.qty;
      else agg.set(key, { id: l.item.id, name: l.item.name, qty: l.qty, price: l.item.priceINR, image: l.item.image });
    }
    return { lines, items: Array.from(agg.values()) };
  }, [dates, holds, plan.allowedSlots, planMap, dateSlotAddons]);

  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const deliveryFeeSetting = useAppSettingNumber("delivery_fee", 0);
  const freeDeliverySetting = useAppSetting("free_delivery_enabled", false);
  const [gstRate, setGstRate] = useState(0.05);

  useEffect(() => {
    if (!taxSetting.loading) {
      setGstRate(taxSetting.value / 100);
    }
  }, [taxSetting.value, taxSetting.loading]);

  const personalizedDiscount = useAppSettingNumber("personalized_discount_pct", 15);
  const [payError, setPayError] = useState("");
  const { openPayment, loading: payLoading } = useRazorpay();
  const [orderStatus, setOrderStatus] = useState<"success" | "failure" | "none">("none");

  return (
    <CheckoutCommon
      headline={`Subscribe • ${plan.title}`}
      hideSignInNote
      onBack={() => setRoute("app")}
      backLabel="Back to Plan Builder"
      showToast={showToast}
      onPlace={async (d) => {
        if (!user) { showToast("Please sign in to subscribe."); return; }
        
        // ── Check for existing active subscription using the dedicated subscriptions table ──
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['active', 'paused', 'trialing'])
          .eq('payment_status', 'paid')
          .maybeSingle();

        if (existingSub) {
          showToast("You already have an active subscription. You cannot take multiple subscriptions at a time.");
          return;
        }

        setPayError("");

        const summary = computePriceSummary(
          chargeable.items.map((x: any) => ({ price: x.price, qty: x.qty })),
          gstRate,
          personalizedDiscount.value,
          deliveryFeeSetting.value,
          freeDeliverySetting.value
        );
        const orderNumber = makeOrderId();

        const processOrder = async (): Promise<{ success: boolean; subId?: string; deliveryOtp?: string }> => {
          try {
            // We still need to mark as Pro for subscriptions
            setUser(prev => prev ? { ...prev, isPro: true } : prev);
            await supabase.from('profiles').update({ is_pro: true }).eq('id', user.id);

            const endDate = dayKey(addDays(parseDateKeyToDate(startKey), Math.max(0, plan.duration - 1)));

            // ── Insert into dedicated subscriptions table ──
            const scheduleLines = chargeable.lines.map(l => ({
              day: l.day, slot: l.slot, itemId: l.item.id,
              label: l.item.name, qty: l.qty, unitPriceAtOrder: l.item.priceINR,
              ...(l.type === 'addon' ? { type: 'addon' } : {})
            }));

            // Generate a 4-digit master delivery OTP for the subscription
            const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

            const { data: subData, error: subTableErr } = await supabase.from('subscriptions').insert({
              user_id: user.id,
              customer_name: d.delivery.receiverName,
              plan_name: plan.title,
              plan_type: plan.allowedSlots.join(' + '),
              duration_days: plan.duration,
              start_date: startKey,
              end_date: endDate,
              status: 'active',
              schedule: scheduleLines,
              delivery_details: d.delivery,
              targets: targetMap[subscription] || {},
              meta: { planId: subscription, orderNumber, deliveryFee: Math.round(summary.deliveryFee), delivery_otp: deliveryOtp },
              total: Math.round(summary.total),
              payment_status: 'pending', // Webhook will set to 'paid'
            }).select('id').single();

            if (subTableErr || !subData) {
              console.error("[Checkout] Subscription insert error:", subTableErr);
              setPayError(`Subscription activation failed: ${subTableErr?.message || 'Unknown error'}`);
              setOrderStatus("failure");
              return { success: false };
            }

            return { success: true, subId: subData.id, deliveryOtp };
          } catch (err: any) {
            console.error("[Checkout] Unexpected error during subscription creation:", err);
            setPayError(`Subscription activation failed: ${err?.message || 'Unexpected error'}`);
            setOrderStatus("failure");
            return { success: false };
          }
        };

        // Create the pending subscription first
        const initResult = await processOrder() as { success: boolean, subId?: string, deliveryOtp?: string };
        if (!initResult.success || !initResult.subId) return;

        // Subscriptions always go through Razorpay
        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: async (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
            // Revert to inactive since payment failed
            if (initResult.subId) {
              await supabase.from('subscriptions').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', initResult.subId);
            }
          },
          onSuccess: async (paymentId, razorpayOrderId) => {
            setOrderStatus("success");
            
            // Mark subscription as paid and capture payment IDs
            await supabase.from('subscriptions').update({
              payment_status: 'paid',
              meta: { planId: subscription, orderNumber, deliveryFee: Math.round(summary.deliveryFee), delivery_otp: initResult.deliveryOtp, razorpay_payment_id: paymentId, razorpay_order_id: razorpayOrderId }
            }).eq('id', initResult.subId);

            const receipt: OrderReceipt = {
              id: orderNumber, kind: "subscription", createdAt: Date.now(),
              headline: "Subscription Scheduled", deliveryAtLabel: `${plan.duration} days schedule`,
              customer: { ...d.delivery, receiverPhone: "+91" + d.delivery.receiverPhone.slice(-10), instructions: d.delivery.instructions || undefined },
              payment: "PAID",
              meta: { 
                delivery_otp: initResult.deliveryOtp,
                plan: plan.title, startDate: startKey, endDate: dayKey(addDays(parseDateKeyToDate(startKey), Math.max(0, plan.duration - 1))), durationDays: plan.duration, mealsPerDay: plan.allowedSlots.length, chargeableDeliveries: chargeable.lines.length,
                scheduleLines: chargeable.lines.map((l: any) => ({ day: l.day, slot: l.slot, itemId: l.item.id, label: l.item.name, qty: l.qty, unitPriceAtOrder: l.item.priceINR })) 
              },
              lines: chargeable.lines.map((l: any) => ({
                itemId: l.item.id,
                label: l.type === 'addon' ? `${l.item.name} [Add-on]` : l.item.name,
                qty: l.qty,
                unitPriceAtOrder: l.item.priceINR,
              })),
              priceSummary: summary,
            };
            setLastOrder(receipt);
            
            // Clear persistent planning state on success
            clearPlanningState();

            // Trigger welcome email in the background
            if (initResult.subId) {
                api.v1.sendWelcomeEmail(initResult.subId).catch(console.error);
            }

            setTimeout(() => {
              setRoute("order-confirmation");
            }, 2000);
          },
        });
      }}
      extraContent={
        <>
          {payError ? <div className="mt-3 p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">{payError}</div> : null}
          <OrderStatusOverlay status={orderStatus} onClose={() => setOrderStatus("none")} errorDetail={payError} />
        </>
      }

      submitLabel={payLoading ? "Opening Payment..." : "Pay & Subscribe"}
      submitDisabled={payLoading}
      summaryRight={
        <div className="space-y-4">
          <DetailedScheduleReview lines={chargeable.lines} />
          <PriceBox 
            title="Chargeable Deliveries" 
            items={chargeable.items as any} 
            gstRate={gstRate} 
            discountPct={personalizedDiscount.value} 
            discountLabel="Plan Discount" 
            deliveryFee={deliveryFeeSetting.value} 
            isFreeDelivery={freeDeliverySetting.value} 
          />
        </div>
      }
    />
  );
}

export function CheckoutGroupPage({
  setRoute,
  setLastOrder,
  showToast,
}: {
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
}) {
  const { user } = useUser();
  const { groupCart, setGroupCart, groupDraft, setGroupDraft } = useCart();
  const { menu: MENU } = useMenu();
  const cartItems = useMemo(() => {
    return Object.entries(groupCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: MENU.find((m) => m.id === id), qty }))
      .filter((x) => !!x.item) as { item: MenuItem; qty: number }[];
  }, [groupCart, MENU]);

  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const deliveryFeeSetting = useAppSettingNumber("delivery_fee", 0);
  const freeDeliverySetting = useAppSetting("free_delivery_enabled", false);
  const [gstRate, setGstRate] = useState(0.05);

  useEffect(() => {
    if (!taxSetting.loading) {
      setGstRate(taxSetting.value / 100);
    }
  }, [taxSetting.value, taxSetting.loading]);

  const groupDiscountSetting = useAppSettingNumber("group_discount_pct", 0);
  const totalUnits = useMemo(() => cartItems.reduce((a, b) => a + b.qty, 0), [cartItems]);
  const effectiveDiscount = totalUnits > 10 ? groupDiscountSetting.value : 0;

  const priceItems = useMemo(() => cartItems.map(({ item, qty }) => ({ name: item.name, qty, price: item.priceINR, image: item.image })), [cartItems]);
  const [payError, setPayError] = useState("");
  const { openPayment, loading: payLoading } = useRazorpay();
  const [isPickup, setIsPickup] = useState(false);
  const [orderStatus, setOrderStatus] = useState<"success" | "failure" | "none">("none");

  const storeOpenWeekday = useAppSettingString("store_open_weekday", "06:00");
  const storeCloseWeekday = useAppSettingString("store_close_weekday", "21:00");
  const storeOpenWeekend = useAppSettingString("store_open_weekend", "09:00");
  const storeCloseWeekend = useAppSettingString("store_close_weekend", "21:00");

  const storeTimings = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const closeStr = isWeekend ? storeCloseWeekend.value : storeCloseWeekday.value;
    const [closeH, closeM] = closeStr.split(':').map(Number);
    const closeTimeDate = new Date();
    closeTimeDate.setHours(closeH, closeM, 0, 0);
    const cutoffTimeDate = new Date(closeTimeDate.getTime() - (3 * 60 * 60 * 1000));
    return { closeTime: closeStr, isTooLateForToday: now >= cutoffTimeDate };
  }, [storeOpenWeekday.value, storeCloseWeekday.value, storeOpenWeekend.value, storeCloseWeekend.value]);

  return (
    <CheckoutCommon
      headline="Group Order Checkout"
      hideSignInNote
      onBack={() => setRoute("app")}
      backLabel="Back to Plan Builder"
      showToast={showToast}
      enableFulfillmentToggle={true}
      onFulfillmentTypeChange={(type) => setIsPickup(type === 'pickup')}
      onPlace={async (d) => {
        if (!user) { showToast("Please sign in to place a group order."); return; }
        
        // Final backup check for 3-hour rule
        const now = new Date();
        const delivery = new Date(groupDraft.deliveryAt);
        if (dayKey(now) === dayKey(delivery) && storeTimings.isTooLateForToday) {
          showToast(`Sorry, group orders for today must be placed at least 3 hours before store closing (${storeTimings.closeTime}).`);
          return;
        }

        setPayError("");

        // Address saving is now handled centrally in CheckoutCommon.handlePlaceOrder

        const orderNumber = makeOrderId();
        const summary = computePriceSummary(
          cartItems.map(({ item, qty }) => ({ price: item.priceINR, qty })),
          gstRate,
          effectiveDiscount,
          isPickup ? 0 : deliveryFeeSetting.value,
          freeDeliverySetting.value
        );
        const deliveryDateStr = groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

        const processOrder = async (): Promise<{ success: boolean; orderId?: string; deliveryOtp?: string }> => {
          const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
          const { data: dbOrder, error: orderErr } = await supabase.from('orders').insert({
            order_number: orderNumber, user_id: user.id, customer_name: d.delivery.receiverName, delivery_date: deliveryDateStr,
            status: 'pending', kind: 'group', payment_status: 'pending', // Webhook sets to paid
            subtotal: Math.round(summary.subtotal), gst_amount: Math.round(summary.gst),
            delivery_fee: Math.round(summary.deliveryFee), total: Math.round(summary.total),
            delivery_details: d.delivery,
            meta: { people: groupDraft.people, deliveryAt: groupDraft.deliveryAt, delivery_otp: deliveryOtp }
          }).select('id').single();
          if (orderErr || !dbOrder) { setPayError(`Order init failed: ${orderErr?.message}`); return { success: false }; }

          if (cartItems.length > 0) {
            await supabase.from('order_items').insert(
              cartItems.map(({ item, qty }) => ({ order_id: dbOrder.id, menu_item_id: item.id, item_name: item.name, quantity: qty, unit_price: item.priceINR }))
            );
          }
          return { success: true, orderId: dbOrder.id, deliveryOtp };
        };

        const initResult = await processOrder();
        if (!initResult.success || !initResult.orderId) return;

        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: async (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
            await supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', initResult.orderId);
          },
          onSuccess: async (paymentId, razorpayOrderId) => {
            setOrderStatus("success");
            await supabase.from('orders').update({
              status: 'preparing', payment_status: 'paid',
              meta: { people: groupDraft.people, deliveryAt: groupDraft.deliveryAt, delivery_otp: initResult.deliveryOtp, razorpay_payment_id: paymentId, razorpay_order_id: razorpayOrderId }
            }).eq('id', initResult.orderId);

            const receipt: OrderReceipt = {
              id: orderNumber, kind: "group", createdAt: Date.now(),
              headline: "Group Order Confirmed", deliveryAtLabel: groupDraft.deliveryAt || "Scheduled delivery",
              customer: { ...d.delivery, receiverPhone: "+91" + d.delivery.receiverPhone.slice(-10), instructions: d.delivery.instructions || undefined },
              payment: "PAID", meta: { people: groupDraft.people, deliveryAt: groupDraft.deliveryAt, delivery_otp: initResult.deliveryOtp },
              lines: cartItems.map(({ item, qty }) => ({ itemId: item.id, label: item.name, qty, unitPriceAtOrder: item.priceINR })),
              priceSummary: summary,
            };
            setLastOrder(receipt);
            setGroupCart({});
            setGroupDraft({ people: 10, deliveryAt: "", notes: "" });
            setTimeout(() => { setRoute("order-confirmation"); }, 2000);
          },
        });
      }}
      extraContent={
        <>
          {payError ? <div className="mt-3 p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">{payError}</div> : null}
          <OrderStatusOverlay status={orderStatus} onClose={() => setOrderStatus("none")} />
        </>
      }
      submitLabel={payLoading ? "Opening Payment..." : "Pay & Place Group Order"}
      submitDisabled={payLoading}
      summaryRight={
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            <div className="font-semibold flex items-center gap-1.5"><User className="w-4 h-4"/> Event Details</div>
            <div className="mt-2 text-indigo-800/80"><strong>Headcount:</strong> {groupDraft.people} people</div>
            <div className="mt-1 text-indigo-800/80"><strong>When:</strong> {groupDraft.deliveryAt ? formatDateTimeIndia(groupDraft.deliveryAt) : "Not set"}</div>
            {groupDraft.notes && <div className="mt-2 pt-2 border-t border-indigo-200/50 text-indigo-800/80 italic">"{groupDraft.notes}"</div>}
          </div>
          <PriceBox 
            title="Catering Items" 
            items={priceItems} 
            gstRate={gstRate} 
            discountPct={effectiveDiscount} 
            discountLabel="Group Discount" 
            deliveryFee={isPickup ? 0 : deliveryFeeSetting.value} 
            isFreeDelivery={freeDeliverySetting.value} 
          />
        </div>
      }
    />
  );
}

export function OrderConfirmationPage({
  lastOrder,
  onGoHome,
  onGoDashboard,
  onModify,
}: {
  lastOrder: OrderReceipt | null;
  onGoHome: () => void;
  onGoDashboard: () => void;
  onModify: (kind: OrderKind) => void;
}) {
  const storeMapUrlSetting = useAppSettingString("store_map_url", "https://maps.google.com/?q=12.9715987,77.5945627");

  if (!lastOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 animate-fade-in flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Receipt size={40} className="text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">No Active Order</h2>
        <p className="mt-2 text-slate-500 max-w-xs">It looks like you haven't placed a recent order, or the session has expired.</p>
        <Button onClick={onGoHome} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
          Back to Home
        </Button>
      </div>
    );
  }

  const o = lastOrder;
  const when = formatDateTimeIndia(o.createdAt);
  const isPickup = o.customer.isPickup;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } } };
  const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-start px-4 py-12 relative overflow-hidden bg-slate-50/50">
      {/* Background Magic Elements */}
      <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-emerald-100/60 to-transparent -z-10" />
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, ease: "easeOut" }}
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-300/20 blur-[100px] rounded-full -z-10" />
      
      {/* Hero Success Badge */}
      <motion.div 
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
        className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] mb-6 z-10 relative"
      >
        <CheckCircle2 size={48} className="text-white relative z-10" />
        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20" />
      </motion.div>

      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter text-center mb-2">
        {o.headline}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-slate-500 font-medium mb-8 text-center px-4">
        We've received your request and the kitchen has been notified!
      </motion.p>

      {/* The Digital Receipt */}
      <motion.div 
        variants={containerVariants} initial="hidden" animate="show"
        className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100"
      >
        {/* Receipt Header Pattern */}
        <div className="h-4 w-full bg-slate-800" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 3px)', backgroundSize: '12px 10px', backgroundPosition: '-6px 0px' }} />

        <div className="p-6 sm:p-10">
          {/* Order Meta Header */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-dashed border-slate-200 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Order Number</p>
              <div className="text-lg font-black font-mono text-slate-800 tracking-wider">#{o.id.toUpperCase()}</div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Placed On</p>
              <div className="text-sm font-bold text-slate-700 font-mono">{when}</div>
            </div>
          </motion.div>

          {/* Quick Info Grid */}
          <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4 py-6 border-b-2 border-dashed border-slate-200">
             <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
               <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                 {isPickup ? <Store size={20} /> : <MapPin size={20} />}
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{isPickup ? 'Store Pickup' : 'Delivery To'}</p>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {o.customer.receiverName}
                    {!isPickup && <span className="block text-xs font-medium text-slate-500 mt-0.5">{[o.customer.building, o.customer.street, o.customer.area].filter(Boolean).join(', ')}</span>}
                  </p>
               </div>
             </div>
             
             <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
               <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                 <Clock size={20} />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Estimated Time</p>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {o.kind === "group" ? formatDateTimeIndia(o.deliveryAtLabel) : formatDateIndia(o.deliveryAtLabel)}
                    {o.kind === "personalized" && <span className="block text-xs font-medium text-slate-500 mt-0.5">{o.meta?.durationDays} Days Schedule</span>}
                  </p>
               </div>
             </div>

             {/* Subscription Badge */}
             {o.kind === "personalized" && o.meta?.plan && (
               <div className="sm:col-span-2 flex items-center gap-3 p-4 rounded-2xl bg-violet-50 border border-violet-100">
                 <Sparkles className="text-violet-500 shrink-0" size={20} />
                 <div>
                   <p className="text-xs font-black text-violet-900 tracking-tight">{o.meta.plan} Subscription Active</p>
                   <p className="text-[10px] text-violet-600 font-bold mt-0.5">{o.meta.chargeableDeliveries} Deliveries Planned across {o.meta.durationDays} days</p>
                 </div>
               </div>
             )}
          </motion.div>

          {/* Items List */}
          <motion.div variants={fadeUp} className="py-6 border-b-2 border-dashed border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Package size={14} /> Order Items
            </h3>
            <div className="space-y-4">
              {o.lines.slice(0, 10).map((l, idx) => (
                <div key={idx} className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <div className="text-sm font-bold text-slate-800">{l.qty}x</div>
                    <div>
                      <div className="text-sm font-bold text-slate-700">{l.label}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {typeof l.unitPriceAtOrder === "number" ? formatINR(l.unitPriceAtOrder * l.qty) : "—"}
                  </div>
                </div>
              ))}
              {o.lines.length > 10 && (
                <div className="text-xs font-bold text-slate-400 pt-2">+ {o.lines.length - 10} more items...</div>
              )}
            </div>
          </motion.div>

          {/* Pricing Totals */}
          {o.priceSummary && (
            <motion.div variants={fadeUp} className="pt-6 space-y-3">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Subtotal</span>
                <span className="text-slate-700">{formatINR(o.priceSummary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Taxes & GST</span>
                <span className="text-slate-700">{formatINR(o.priceSummary.gst)}</span>
              </div>
              {o.priceSummary.deliveryFee !== undefined && o.priceSummary.deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Delivery Fee</span>
                  {o.priceSummary.isFreeDelivery ? (
                    <span className="text-emerald-600 font-bold uppercase tracking-wider text-xs">Free</span>
                  ) : (
                    <span className="text-slate-700">{formatINR(o.priceSummary.deliveryFee)}</span>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-slate-900 border-dashed">
                <span className="text-lg font-black text-slate-900 uppercase tracking-tight">Total Paid</span>
                <span className="text-2xl font-black text-emerald-600">{formatINR(o.priceSummary.total)}</span>
              </div>
            </motion.div>
          )}

        </div>
        
        {/* Receipt Footer Pattern */}
        <div className="h-4 w-full bg-slate-100" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 3px)', backgroundSize: '12px 10px', backgroundPosition: '-6px 0px' }} />
      </motion.div>

      {/* Action Buttons */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-2xl px-4 relative z-10">
        <motion.div variants={fadeUp} className="flex-1">
          <Button onClick={onGoDashboard} className="w-full h-14 rounded-2xl bg-white text-slate-900 hover:bg-slate-50 hover:-translate-y-1 transition-all shadow-[0_10px_20px_rgba(0,0,0,0.05)] border border-slate-200 font-bold text-base flex justify-center items-center gap-2 group">
            Track Order <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
        
        {o.kind !== "regular" && (
          <motion.div variants={fadeUp} className="flex-1">
            <Button onClick={() => onModify(o.kind)} className="w-full h-14 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 transition-all shadow-lg font-bold text-base shadow-indigo-500/20 border-none">
              Modify Schedule
            </Button>
          </motion.div>
        )}

        {isPickup && (
          <motion.div variants={fadeUp} className="w-full sm:w-auto">
             <Button onClick={() => window.open(storeMapUrlSetting.value, "_blank")} className="w-full h-14 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-1 transition-all shadow-lg font-bold text-base shadow-emerald-500/20 border-none flex justify-center items-center gap-2">
                <Navigation size={18} /> Store Map
             </Button>
          </motion.div>
        )}
      </motion.div>
      
      <motion.button 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        onClick={onGoHome} className="mt-12 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest relative z-10"
      >
        Return to Menu
      </motion.button>

      <div className="h-20" />
    </div>
  );
}

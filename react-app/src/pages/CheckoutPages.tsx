import React, { useState, useEffect, useMemo } from "react";
import type { MenuItem, StartDateMap, TargetMap, HoldsMap, PlanMap, Slot, OrderReceipt, AppUser, Route, DeliveryDetails, OrderKind, GroupCart, GroupOrderDraft } from "../types";
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
import { User, Sparkles, MapPin, Plus, LocateFixed, ArrowRight, Store, Navigation, Map as MapIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { MapPicker } from "../components/ui/MapPicker";
import { OrderStatusOverlay } from "../components/ui/OrderStatusOverlay";

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
  isFreeDelivery = false,
}: {
  title: string;
  items: Array<{ name: string; qty: number; price?: number }>;
  gstRate: number;
  discountPct?: number;
  discountLabel?: string;
  deliveryFee?: number;
  isFreeDelivery?: boolean;
}) {
  const hasAnyPrice = items.some((x) => typeof x.price === "number");
  const subtotal = items.reduce((acc, it) => acc + (it.price ?? 0) * it.qty, 0);
  const discount = subtotal * (discountPct / 100);
  const discountedSubtotal = subtotal - discount;
  const gst = discountedSubtotal * gstRate;
  const effectiveDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const total = discountedSubtotal + gst + effectiveDeliveryFee;

  return (
    <div className="rounded-2xl border border-black/10 bg-black/3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {!hasAnyPrice && <div className="text-xs text-black/50 mt-1">Prices pending admin setup.</div>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium tracking-widest uppercase text-[9px]">Tax Included GST ({Math.round(gstRate * 100)}%)</span>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {items.length ? (
          items.map((it, idx) => (
            <div key={idx} className="flex items-start justify-between">
              <div>
                <div className="font-medium text-black">{it.name}</div>
                <div className="text-xs text-black/55">Qty: {it.qty}</div>
              </div>
              <div className="text-slate-700 font-medium">
                {typeof it.price === "number" ? formatINR(it.price * it.qty) : "—"}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500 italic">No chargeable items selected.</div>
        )}
      </div>

      <div className="mt-4 border-t border-black/10 pt-4 text-sm space-y-2">
        <div className="flex items-center justify-between text-black/60">
          <span>Subtotal</span>
          <span className="font-medium text-black">{formatINR(subtotal)}</span>
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
        <div className="mt-2 flex items-center justify-between pt-2 border-t border-black/10">
          <span className="text-base font-bold text-black">Total</span>
          <span className="text-base font-bold text-green-700">{formatINR(total)}</span>
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
  user,
  setUser,
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
  user: AppUser | null;
  setUser?: React.Dispatch<React.SetStateAction<AppUser | null>>;
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
  const pickupSetting = useAppSetting("enable_pickup", true);
  const deliverySetting = useAppSetting("enable_delivery", true);
  const storeAddressSetting = useAppSettingString("store_address", "The Fresh Box\n123 Health Avenue, Fitness District\nCity Center, 500001");
  const storeMapUrlSetting = useAppSettingString("store_map_url", "https://maps.google.com/?q=12.9715987,77.5945627");
  const googleMapsApiKey = useAppSettingString("google_maps_api_key", "");

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

    // Auto-save address for new customers (first time checkout)
    if (user?.id && setUser) {
      const isFirstAddress = !user.defaultDelivery?.building && !(user.savedAddresses?.length);
      if ((selectedIdx === 'new') && isFirstAddress && delivery.building) {
        const updatedUser: AppUser = { ...user, defaultDelivery: delivery };
        setUser(updatedUser);
        // Save to Supabase in the background
        supabase.from('profiles').update({
          default_delivery: delivery,
          saved_addresses: [],
        }).eq('id', user.id);
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

      <div className="grid gap-8 lg:grid-cols-5">
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
              
              {!googleMapsApiKey.value && (
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
                  {googleMapsApiKey.value && (
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

                {showMap && googleMapsApiKey.value && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <MapPicker 
                      apiKey={googleMapsApiKey.value}
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
          <Card className="sticky top-24">
            <CardHeader>
              <LuxuryLabel text="Order summary" />
              <div className="mt-2 text-sm text-black/55">Review your selected items and totals.</div>
            </CardHeader>
            <CardContent className="pt-6">
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
  user,
  setUser,
  regularCart,
  setRegularCart,
  setRoute,
  setLastOrder,
  showToast,
}: {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  regularCart: Record<string, number>;
  setRegularCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
}) {
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

  const priceItems = useMemo(() => cartItems.map(({ item, qty }) => ({ name: item.name, qty, price: item.priceINR })), [cartItems]);
  const [payError, setPayError] = useState("");
  const { openPayment, loading: payLoading } = useRazorpay();
  const [isPickup, setIsPickup] = useState(false);
  const [orderStatus, setOrderStatus] = useState<"success" | "failure" | "none">("none");

  return (
    <CheckoutCommon
      user={user}
      setUser={setUser}
      headline="Complete Your Order"
      onBack={() => setRoute("home")}
      showToast={showToast}
      enableFulfillmentToggle={true}
      onFulfillmentTypeChange={(type) => setIsPickup(type === 'pickup')}
      onPlace={async (d) => {
        if (!user) { showToast("Please sign in to place an order."); return; }
        setPayError("");

        const isNew = !user.savedAddresses?.some(a => a.building === d.delivery.building && a.street === d.delivery.street);
        if (isNew) {
          const updatedAddresses = [...(user.savedAddresses || []), d.delivery];
          setUser(prev => prev ? { ...prev, savedAddresses: updatedAddresses } : prev);
          await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', user.id);
        }

        const orderNumber = makeOrderId();
        const summary = computePriceSummary(
          cartItems.map(({ item, qty }) => ({ price: item.priceINR, qty })),
          gstRate,
          0,
          isPickup ? 0 : deliveryFeeSetting.value,
          freeDeliverySetting.value
        );

        const processOrder = async () => {
          const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
          const { data: dbOrder, error: orderErr } = await supabase.from('orders').insert({
            order_number: orderNumber,
            user_id: user.id,
            customer_name: d.delivery.receiverName,
            delivery_date: new Date().toISOString().slice(0, 10),
            status: 'pending',
            kind: 'regular',
            payment_status: 'paid',
            subtotal: Math.round(summary.subtotal),
            gst_amount: Math.round(summary.gst),
            delivery_fee: Math.round(summary.deliveryFee),
            total: Math.round(summary.total),
            delivery_details: d.delivery,
            meta: { delivery_otp: deliveryOtp }
          }).select('id').single();

          if (orderErr || !dbOrder) { setPayError(`Order save failed: ${orderErr?.message}`); return; }

          if (cartItems.length > 0) {
            await supabase.from('order_items').insert(
              cartItems.map(({ item, qty }) => ({ order_id: dbOrder.id, menu_item_id: item.id, item_name: item.name, quantity: qty, unit_price: item.priceINR }))
            );
          }

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
          // Success overlay will handle navigation after delay
        };

        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
          },
          onSuccess: async () => {
            setOrderStatus("success");
            await processOrder();
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
      summaryRight={<PriceBox title="Cart Items" items={priceItems} gstRate={gstRate} deliveryFee={isPickup ? 0 : deliveryFeeSetting.value} isFreeDelivery={freeDeliverySetting.value} />}
    />
  );
}

export function CheckoutPersonalPage({
  user,
  setUser,
  subscription,
  planMap,
  setPlanMap,
  holds,
  setHolds,
  setRoute,
  setLastOrder,
  showToast,
  startDates,
  setStartDates,
  targetMap,
  setTargetMap,
}: {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  subscription: string;
  planMap: PlanMap;
  setPlanMap: React.Dispatch<React.SetStateAction<PlanMap>>;
  holds: HoldsMap;
  setHolds: React.Dispatch<React.SetStateAction<HoldsMap>>;
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
  startDates: StartDateMap;
  setStartDates: React.Dispatch<React.SetStateAction<StartDateMap>>;
  targetMap: TargetMap;
  setTargetMap: React.Dispatch<React.SetStateAction<TargetMap>>;
}) {
  const plan = useMemo(() => buildPlanFromSubscription(subscription), [subscription]);
  const tomorrowKey = dayKey(addDays(new Date(), 1));
  const startKey = startDates[subscription] || startDates['last_selected'] || tomorrowKey;
  const startDate = useMemo(() => parseDateKeyToDate(startKey), [startKey]);
  const dates = useMemo(() => Array.from({ length: plan.duration }, (_, i) => dayKey(addDays(startDate, i))), [plan.duration, startDate]);

  const chargeable = useMemo(() => {
    const lines: Array<{ day: string; slot: Slot; item: MenuItem; qty: number }> = [];
    for (const dk of dates) {
      const hold = holds[dk] || { day: false, slots: {} };
      if (hold.day) continue;
      const dp = planMap[dk] || {};
      for (const s of plan.allowedSlots) {
        if (hold.slots[s]) continue;
        const it = dp[s];
        if (!it) continue;
        lines.push({ day: dk, slot: s, item: it, qty: 1 });
      }
    }

    const agg = new Map<string, { id: string; name: string; qty: number; price?: number }>();
    for (const l of lines) {
      const key = l.item.id;
      const cur = agg.get(key);
      if (cur) cur.qty += 1;
      else agg.set(key, { id: l.item.id, name: l.item.name, qty: 1, price: l.item.priceINR });
    }
    return { lines, items: Array.from(agg.values()) };
  }, [dates, holds, plan.allowedSlots, planMap]);

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
      user={user}
      setUser={setUser}
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
          .in('status', ['active', 'ready', 'preparing', 'new'])
          .maybeSingle();

        if (existingSub) {
          showToast("You already have an active subscription. You cannot take multiple subscriptions at a time.");
          return;
        }

        setPayError("");

        const deliveredItems: MenuItem[] = [];
        for (const dk of dates) {
          const hold = holds[dk] || { day: false, slots: {} };
          if (hold.day) continue;
          const dp = planMap[dk] || {};
          for (const s of plan.allowedSlots) {
            if (hold.slots[s]) continue;
            const it = dp[s];
            if (!it) continue;
            deliveredItems.push(it);
          }
        }

        const summary = computePriceSummary(
          chargeable.items.map((x: any) => ({ price: x.price, qty: x.qty })),
          gstRate,
          personalizedDiscount.value,
          deliveryFeeSetting.value,
          freeDeliverySetting.value
        );
        const orderNumber = makeOrderId();

        const isNew = !user.savedAddresses?.some(a => a.building === d.delivery.building && a.street === d.delivery.street);
        const updatedAddresses = isNew ? [...(user.savedAddresses || []), d.delivery] : (user.savedAddresses || []);

        const processOrder = async (isCod: boolean) => {
          setUser(prev => prev ? { ...prev, isPro: true, savedAddresses: updatedAddresses } : prev);
          await supabase.from('profiles').update({ saved_addresses: updatedAddresses, is_pro: true }).eq('id', user.id);

          const endDate = dayKey(addDays(parseDateKeyToDate(startKey), Math.max(0, plan.duration - 1)));
          // ── No parent 'orders' row for subscriptions anymore! ──
          // This prevents subscriptions from cluttering the Kitchen and Order History.
          // The source of truth is now solely the 'subscriptions' table.

          // ── Insert into dedicated subscriptions table ──
          // This is the source of truth for App.tsx dashboard display and admin management
          const scheduleLines = chargeable.lines.map(l => ({
            day: l.day, slot: l.slot, itemId: l.item.id,
            label: l.item.name, qty: l.qty, unitPriceAtOrder: l.item.priceINR
          }));
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
            meta: { planId: subscription, orderNumber },
            delivery_fee: Math.round(summary.deliveryFee),
            total: Math.round(summary.total),
            payment_status: isCod ? 'pending' : 'paid',
          }).select('id').single();

          if (subTableErr || !subData) {
            console.error("[App] Subscription table insert error:", subTableErr);
            setPayError(`Subscription activation failed: ${subTableErr?.message || 'Unknown error'}`);
            return;
          }

          const receipt: OrderReceipt = {
            id: orderNumber, kind: "personalized", createdAt: Date.now(),
            headline: "Subscription Scheduled", deliveryAtLabel: `${plan.duration} days schedule`,
            customer: { ...d.delivery, receiverPhone: "+91" + d.delivery.receiverPhone.slice(-10), instructions: d.delivery.instructions || undefined },
            payment: isCod ? "Cash on Delivery" : "PAID",
            meta: { 
              plan: plan.title, startDate: startKey, endDate: dayKey(addDays(parseDateKeyToDate(startKey), Math.max(0, plan.duration - 1))), durationDays: plan.duration, mealsPerDay: plan.allowedSlots.length, chargeableDeliveries: chargeable.lines.length,
              scheduleLines: chargeable.lines.map((l) => ({ day: l.day, slot: l.slot, itemId: l.item.id, label: l.item.name, qty: l.qty, unitPriceAtOrder: l.item.priceINR })) 
            },
            lines: deliveredItems.map((it) => ({ itemId: it.id, label: it.name, qty: 1, unitPriceAtOrder: it.priceINR })),
            priceSummary: summary,
          };
          setLastOrder(receipt);
          
          // Clear persistent state on success
          setPlanMap({});
          setHolds({});
          setStartDates({});
          setTargetMap({});

          // Trigger welcome email in the background (fire and forget)
          supabase.functions.invoke('welcome-subscription', { body: { subscriptionId: subData.id } }).catch(console.error);
          
          // Success overlay will handle navigation after delay
        };

        // Subscriptions always go through Razorpay (payment method selection is hidden)
        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
          },
          onSuccess: async () => {
            setOrderStatus("success");
            await processOrder(false);
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
  user,
  setUser,
  groupCart,
  setGroupCart,
  groupDraft,
  setGroupDraft,
  setRoute,
  setLastOrder,
  showToast,
}: {
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  groupCart: GroupCart;
  setGroupCart: React.Dispatch<React.SetStateAction<GroupCart>>;
  groupDraft: GroupOrderDraft;
  setGroupDraft: React.Dispatch<React.SetStateAction<GroupOrderDraft>>;
  setRoute: (r: Route) => void;
  setLastOrder: React.Dispatch<React.SetStateAction<OrderReceipt | null>>;
  showToast: (msg: string) => void;
}) {
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

  const groupDiscount = useAppSettingNumber("group_discount_pct", 0);
  const priceItems = useMemo(() => cartItems.map(({ item, qty }) => ({ name: item.name, qty, price: item.priceINR })), [cartItems]);
  const [payError, setPayError] = useState("");
  const { openPayment, loading: payLoading } = useRazorpay();
  const [isPickup, setIsPickup] = useState(false);

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
      user={user}
      setUser={setUser}
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

        const isNew = !user.savedAddresses?.some(a => a.building === d.delivery.building && a.street === d.delivery.street);
        if (isNew) {
          const updatedAddresses = [...(user.savedAddresses || []), d.delivery];
          setUser(prev => prev ? { ...prev, savedAddresses: updatedAddresses } : prev);
          await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', user.id);
        }

        const orderNumber = makeOrderId();
        const summary = computePriceSummary(
          cartItems.map(({ item, qty }) => ({ price: item.priceINR, qty })),
          gstRate,
          groupDiscount.value,
          isPickup ? 0 : deliveryFeeSetting.value,
          freeDeliverySetting.value
        );
        const deliveryDateStr = groupDraft.deliveryAt ? new Date(groupDraft.deliveryAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

        const processOrder = async () => {
          const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
          const { data: dbOrder, error: orderErr } = await supabase.from('orders').insert({
            order_number: orderNumber, user_id: user.id, customer_name: d.delivery.receiverName, delivery_date: deliveryDateStr,
            status: 'pending', kind: 'group', payment_status: 'paid',
            subtotal: Math.round(summary.subtotal), gst_amount: Math.round(summary.gst),
            delivery_fee: Math.round(summary.deliveryFee),
            total: Math.round(summary.total), delivery_details: d.delivery,
            meta: { people: groupDraft.people, deliveryAt: groupDraft.deliveryAt, delivery_otp: deliveryOtp }
          }).select('id').single();

          if (orderErr || !dbOrder) { setPayError(`Order save failed: ${orderErr?.message}`); return; }

          if (cartItems.length > 0) {
            await supabase.from('order_items').insert(
              cartItems.map(({ item, qty }) => ({ order_id: dbOrder.id, menu_item_id: item.id, item_name: item.name, quantity: qty, unit_price: item.priceINR }))
            );
          }

          const receipt: OrderReceipt = {
            id: orderNumber, kind: "group", createdAt: Date.now(),
            headline: "Group Order Confirmed", deliveryAtLabel: groupDraft.deliveryAt || "Scheduled delivery",
            customer: { ...d.delivery, receiverPhone: "+91" + d.delivery.receiverPhone.slice(-10), instructions: d.delivery.instructions || undefined },
            payment: "PAID",
            meta: { people: groupDraft.people, deliveryAt: groupDraft.deliveryAt },
            lines: cartItems.map(({ item, qty }) => ({ itemId: item.id, label: item.name, qty, unitPriceAtOrder: item.priceINR })),
            priceSummary: summary,
          };
          setLastOrder(receipt);
          setGroupCart({});
          setGroupDraft({ people: 10, deliveryAt: "", notes: "" });
          // Success overlay will handle navigation after delay
        };

        await openPayment({
          amount: summary.total,
          orderNumber,
          customerName: d.delivery.receiverName,
          customerEmail: user.email || '',
          customerPhone: d.delivery.receiverPhone,
          onFailure: (reason) => {
            setPayError(reason);
            setOrderStatus("failure");
          },
          onSuccess: async () => {
            setOrderStatus("success");
            await processOrder();
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
            discountPct={groupDiscount.value} 
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
      <div className="mx-auto max-w-3xl px-4 py-10 animate-fade-in">
        <Card>
          <CardHeader>
            <LuxuryLabel text="No recent order" />
            <div className="mt-2 text-sm text-black/55">Place an order to see confirmation.</div>
          </CardHeader>
          <CardContent>
            <Button onClick={onGoHome}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const o = lastOrder;
  const when = formatDateTimeIndia(o.createdAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-fade-in-up">
      <div className="mb-6 px-2">
        <button 
          onClick={onGoHome} 
          className="text-sm font-semibold text-black/60 hover:text-black transition-colors flex items-center gap-1.5"
        >
          ← Back to Home
        </button>
      </div>
      <Card>
        <CardHeader>
          <SectionTitle icon={Sparkles} title={`${o.headline} ✅`} subtitle={`Order ID: ${o.id} • ${when}`} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Delivery</div>
              <div className="mt-1 text-sm text-black/55">{o.kind === "group" ? formatDateTimeIndia(o.deliveryAtLabel) : formatDateIndia(o.deliveryAtLabel)}</div>
            </div>
            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Payment</div>
              <div className="mt-1 text-sm text-black/55">{o.payment}</div>
            </div>
            {o.kind === "personalized" && o.meta?.plan && (
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 md:col-span-2">
                <div className="text-sm font-semibold text-violet-900">Subscription Plan</div>
                <div className="mt-1 text-sm text-violet-700 font-bold">
                  {o.meta.plan}
                  {o.meta.durationDays ? ` · ${o.meta.durationDays} days` : ""}
                  {o.meta.mealsPerDay ? ` · ${o.meta.mealsPerDay} meal${o.meta.mealsPerDay > 1 ? "s" : ""}/day` : ""}
                </div>
                {o.meta.chargeableDeliveries != null && (
                  <div className="mt-0.5 text-xs text-violet-500">{o.meta.chargeableDeliveries} scheduled deliveries</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Customer</div>
            <div className="mt-2 text-sm text-black/55 space-y-1">
              <div>{o.customer.receiverName}</div>
              <div>{o.customer.receiverPhone}</div>
              <div>{[o.customer.building, o.customer.street, o.customer.area].filter(Boolean).join(', ')}</div>
              {o.customer.instructions ? <div className="italic">Instr: {o.customer.instructions}</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Items</div>
                <div className="mt-1 text-xs text-black/50">Details for the food items in your order.</div>
              </div>
              <div className="text-xs text-black/55 truncate max-w-[100px]">Kind: {o.kind}</div>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {o.lines.length ? (
                o.lines.slice(0, 120).map((l, idx) => {
                  const atPrice = l.unitPriceAtOrder;
                  const showPrice = typeof atPrice === "number";
                  return (
                    <div key={idx} className="rounded-xl border border-black/10 p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{l.label}</span>
                        <span className="text-black/55">×{l.qty}</span>
                      </div>
                      {showPrice ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55">
                          <span>Price at order: {typeof atPrice === "number" ? formatINR(atPrice) : "—"}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="text-black/55">No items.</div>
              )}
              {o.lines.length > 120 ? <div className="text-xs text-black/50">Showing first 120…</div> : null}
            </div>
          </div>

          {o.priceSummary ? (
            <div className="rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Price</div>
              <div className="mt-2 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-black/55">Subtotal</span>
                  <span className="font-medium">{formatINR(o.priceSummary.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/55">GST ({Math.round(o.priceSummary.gstRate * 100)}%)</span>
                  <span className="font-medium">{formatINR(o.priceSummary.gst)}</span>
                </div>
                {o.priceSummary.deliveryFee !== undefined && o.priceSummary.deliveryFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-black/55">Delivery Fee</span>
                    {o.priceSummary.isFreeDelivery ? (
                      <div className="flex items-center gap-2">
                        <span className="text-black/30 line-through text-xs">{formatINR(o.priceSummary.deliveryFee)}</span>
                        <span className="font-bold text-emerald-600">FREE</span>
                      </div>
                    ) : (
                      <span className="font-medium text-black">{formatINR(o.priceSummary.deliveryFee)}</span>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">{formatINR(o.priceSummary.total)}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onGoHome} variant="outline" className="flex-1">Go to Home</Button>
            <Button onClick={onGoDashboard} variant="outline" className="flex-1">Go to Dashboard</Button>
            {o.kind !== "regular" && (
              <Button onClick={() => onModify(o.kind)} className="flex-1">Modify Schedule / Details</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Floating Action Bar for Pickup Orders */}
      {o.customer.isPickup && (
        <>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-4xl px-2 text-center sm:text-left">
            <AnimatePresence>
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="backdrop-blur-xl bg-white/95 border border-emerald-200 shadow-[0_20px_50px_rgba(16,185,129,0.15)] rounded-[2rem] p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div className="flex-1 hidden sm:block pl-2">
                  <div className="text-[10px] font-black uppercase text-emerald-500 tracking-wider mb-0.5">
                    Store Pickup
                  </div>
                  <div className="text-sm font-bold text-emerald-900 leading-tight">
                    Your order will be ready at our store. Get directions now.
                  </div>
                </div>
                
                <div className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-64 text-base font-black uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] bg-emerald-600 hover:bg-emerald-700 text-white h-12 sm:h-14 rounded-2xl transition-all hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] active:scale-95 flex items-center justify-center gap-2"
                    onClick={() => window.open(storeMapUrlSetting.value, "_blank")}
                  >
                    <Navigation className="h-5 w-5" /> Get Directions
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="h-24 sm:h-32" />
        </>
      )}

    </div>
  );
}

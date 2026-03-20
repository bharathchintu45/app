import { useEffect, useRef, useState } from "react";
import type { DeliveryDetails } from "../../types";
import { MapPin, Navigation } from "lucide-react";

interface LocationPickerProps {
  delivery: Partial<DeliveryDetails>;
  onChange: (updated: Partial<DeliveryDetails>) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

function mapsReady(): boolean {
  return typeof window !== "undefined" && !!window.google?.maps?.places;
}

export function LocationPicker({ delivery, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(mapsReady());
  const [gpsLoading, setGpsLoading] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Wait for Google Maps to load (it's loaded async in index.html)
  useEffect(() => {
    if (mapsReady()) { setReady(true); return; }
    const timer = setInterval(() => {
      if (mapsReady()) { setReady(true); clearInterval(timer); }
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // Initialize map + autocomplete once ready
  useEffect(() => {
    if (!ready || !mapRef.current || !inputRef.current) return;

    const defaultCenter = delivery.lat && delivery.lng
      ? { lat: delivery.lat, lng: delivery.lng }
      : { lat: 17.385, lng: 78.4867 }; // Hyderabad default

    // Init Map
    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: delivery.lat ? 16 : 13,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
    });
    mapInstanceRef.current = map;

    // Init draggable Marker
    const marker = new window.google.maps.Marker({
      position: defaultCenter,
      map,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: "Drag to pinpoint your location",
    });
    markerRef.current = marker;

    // On marker drag end → reverse geocode
    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (!pos) return;
      const lat = pos.lat();
      const lng = pos.lng();
      reverseGeocode(lat, lng);
    });

    // Init Places Autocomplete
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["geometry", "address_components", "formatted_address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      map.setCenter({ lat, lng });
      map.setZoom(17);
      marker.setPosition({ lat, lng });
      fillFromPlace(place.address_components || [], lat, lng);
    });
  }, [ready]);

  function reverseGeocode(lat: number, lng: number) {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === "OK" && results[0]) {
        fillFromPlace(results[0].address_components, lat, lng);
        if (inputRef.current) inputRef.current.value = results[0].formatted_address;
      }
    });
  }

  function fillFromPlace(components: any[], lat: number, lng: number) {
    const get = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.long_name || "";
    const streetNum = get("street_number");
    const route = get("route");
    const sublocality = get("sublocality_level_1") || get("sublocality") || get("neighborhood");
    const locality = get("locality");

    onChange({
      ...delivery,
      building: delivery.building || (streetNum ? `${streetNum} ${route}`.trim() : route),
      street: delivery.street || route,
      area: delivery.area || sublocality || locality,
      lat,
      lng,
    });
  }

  function handleGps() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapInstanceRef.current?.setCenter({ lat, lng });
        mapInstanceRef.current?.setZoom(17);
        markerRef.current?.setPosition({ lat, lng });
        reverseGeocode(lat, lng);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // If no API key or maps still loading, don't render
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return null;
  if (!ready) return (
    <div className="h-48 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
      <div className="text-sm text-slate-400 font-medium animate-pulse">Loading map…</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search your address…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
        />
        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Navigation size={12} className={gpsLoading ? "animate-spin" : ""} />
          {gpsLoading ? "Locating…" : "Use GPS"}
        </button>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className="h-52 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
      />
      <p className="text-[11px] text-slate-400 font-medium text-center">
        📌 Drag the pin to pinpoint your exact door location
      </p>

      {/* Coords confirmation */}
      {delivery.lat && delivery.lng && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
          <MapPin size={14} className="text-emerald-600 shrink-0" />
          <span className="text-[11px] font-bold text-emerald-700">
            Location captured: {delivery.lat.toFixed(5)}, {delivery.lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}

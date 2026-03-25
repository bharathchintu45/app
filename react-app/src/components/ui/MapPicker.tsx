import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Crosshair, MapPin, Search } from 'lucide-react';
import { Input } from './Input';

const defaultCenter = {
  lat: 17.3850,
  lng: 78.4867
};

interface AddressComponents {
  street?: string;
  area?: string;
  building?: string;
  city?: string;
}

interface MapPickerProps {
  apiKey: string;
  initialPos?: { lat: number; lng: number };
  onPositionChange: (pos: { lat: number; lng: number }, components?: AddressComponents) => void;
}

export function MapPicker({ apiKey, initialPos, onPositionChange }: MapPickerProps) {
  const [position, setPosition] = useState(initialPos || defaultCenter);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Google Maps Script
  useEffect(() => {
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }
    
    // Prevent multiple script tags
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    console.log('[MapPicker] Loading Google Maps script with key length:', apiKey?.length || 0);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount to allow cached maps across components
    };
  }, [apiKey]);

  const geocodePosition = useCallback((pos: { lat: number; lng: number }) => {
    if (!(window as any).google) return;
    
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results: any, status: any) => {
      if (status === 'OK' && results?.[0]) {
        const components: AddressComponents = {};
        const res = results[0];
        
        // Map Google address components to our fields with priority for Indian addresses
        const addr: any = {};
        res.address_components.forEach((c: any) => {
          const types = c.types;
          // Area Priority: Sublocality L1 > Sublocality L2 > Neighborhood > Locality
          if (types.includes('sublocality_level_1')) addr.sub1 = c.long_name;
          else if (types.includes('sublocality_level_2')) addr.sub2 = c.long_name;
          else if (types.includes('neighborhood')) addr.neigh = c.long_name;
          else if (types.includes('locality')) addr.loc = c.long_name;

          // Street
          if (types.includes('route')) components.street = c.long_name;

          // Building Priority: Premise > Subpremise > Point of Interest
          if (types.includes('premise') || types.includes('subpremise') || types.includes('point_of_interest')) {
            components.building = components.building ? `${c.long_name}, ${components.building}` : c.long_name;
          }
          
          if (types.includes('administrative_area_level_2')) components.city = c.long_name;
        });

        // Consolidate Area
        components.area = addr.sub1 || addr.sub2 || addr.neigh || addr.loc || "";

        onPositionChange(pos, components);
      }
    });
  }, [onPositionChange]);

  // Initialize Map and Autocomplete once script is loaded
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !inputRef.current || !(window as any).google) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
        center: position,
        zoom: 15,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      markerRef.current = new (window as any).google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        draggable: true,
      });

      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.getPosition();
        if (pos) {
          const newPos = { lat: pos.lat(), lng: pos.lng() };
          setPosition(newPos);
          geocodePosition(newPos);
        }
      });
    }

    if (!autocompleteRef.current) {
      autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "IN" },
        fields: ["address_components", "geometry", "name"],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const newPos = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          setPosition(newPos);
          mapInstanceRef.current?.panTo(newPos);
          markerRef.current?.setPosition(newPos);
          geocodePosition(newPos);
        }
      });
    }
  }, [isLoaded, position, geocodePosition]);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (navPosition) => {
          const newPos = {
            lat: navPosition.coords.latitude,
            lng: navPosition.coords.longitude,
          };
          setPosition(newPos);
          mapInstanceRef.current?.panTo(newPos);
          markerRef.current?.setPosition(newPos);
          geocodePosition(newPos);
        },
        () => {
          // No alert here to avoid annoying the user if they've already seen the fallback text in parent
        }
      );
    }
  };

  if (!isLoaded) {
    return (
      <div className="h-[350px] w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-medium text-sm">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="relative w-full space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={16} />
        <Input 
          ref={inputRef}
          type="text" 
          placeholder="Search for your landmark or area..." 
          className="pl-10 pr-4 py-2 w-full bg-white border-slate-200 rounded-xl text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        />
      </div>

      <div className="relative">
        <div ref={mapRef} style={{ width: '100%', height: '350px', borderRadius: '16px' }} />
        
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <Button 
            type="button"
            size="sm" 
            variant="secondary" 
            className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white text-slate-900 border-none h-10 w-10 p-0 rounded-xl"
            onClick={detectLocation}
            title="Detect My Location"
          >
            <Crosshair size={18} />
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <MapPin size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
          Drag the pin or search to auto-fill address fields. Make sure to allow location access in your browser for the best experience.
        </p>
      </div>
    </div>
  );
}

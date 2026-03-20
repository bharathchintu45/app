/**
 * Lazy Google Maps loader.
 * Call loadGoogleMaps() in a useEffect inside any component that needs
 * the Maps Places API. It will only inject the script once and reuse
 * the cached promise on subsequent calls.
 */

let mapsPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Already loaded — google object exists
  if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
    return Promise.resolve();
  }

  // Already in-flight — return the same promise
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn('[googleMaps] VITE_GOOGLE_MAPS_API_KEY is not set.');
      resolve(); // Resolve gracefully so the UI doesn't break
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => {
      mapsPromise = null; // allow retry on next call
      reject(e);
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

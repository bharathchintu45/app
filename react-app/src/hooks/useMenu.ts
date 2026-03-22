import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem } from '../types';

let cachedMenu: MenuItem[] | null = null;
let fetchPromise: Promise<MenuItem[]> | null = null;
let currentMenuCache: MenuItem[] | null = null; // Store fully resolved cache

/**
 * Shared helper to get the menu app-wide without re-fetching.
 * This allows App.tsx or other components to access the same data as useMenu().
 */
export async function getMenu(): Promise<MenuItem[]> {
  // If we already resolved and cached it fully, return instantly
  if (currentMenuCache) return currentMenuCache;

  // If there's an ongoing fetch, wait for it
  if (fetchPromise) return fetchPromise;

  fetchPromise = new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      fetchPromise = null;
      reject(new Error("Menu fetch timed out (10s). Check your connection."));
    }, 10000);

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id');

      clearTimeout(timeout);

      if (error) {
        console.error('Error fetching menu:', error);
        fetchPromise = null;
        reject(error);
        return;
      }

      const mapped = (data || []).map((dbItem) => {
        const rawCat = dbItem.category || '';
        let mappedCat = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) : 'Add-Ons';
        // Map legacy DB categories
        if (mappedCat === 'Breakfast') mappedCat = 'All-Day Kitchen';
        else if (mappedCat === 'Lunch' || mappedCat === 'Dinner') mappedCat = 'Midday-Midnight Kitchen';
        else if (mappedCat === 'Snack') mappedCat = 'Add-Ons';

        return {
          id: dbItem.id,
          category: mappedCat as any,
          name: dbItem.name,
          description: dbItem.description,
          image: dbItem.image_url,
          calories: dbItem.calories,
          protein: dbItem.protein,
          carbs: dbItem.carbs,
          fat: dbItem.fat,
          fiber: dbItem.fiber,
          priceINR: dbItem.price_inr,
          available: dbItem.available !== false,
          tags: dbItem.tags || [],
        };
      }) as MenuItem[];

      currentMenuCache = mapped;
      resolve(mapped);
    } catch (err) {
      clearTimeout(timeout);
      console.error('Exception fetching menu:', err);
      fetchPromise = null;
      reject(err);
    }
  });

  return fetchPromise;
}

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[]>(cachedMenu || []);
  const [loading, setLoading] = useState<boolean>(!cachedMenu);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        const data = await getMenu();
        if (isMounted) {
          setMenu(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to load menu:", err);
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  // Function to refresh the cache (useful for the Admin portal)
  const refreshMenu = async () => {
    setLoading(true);
    cachedMenu = null;
    fetchPromise = null; // force new fetch
    try {
      const data = await getMenu();
      setMenu(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return { menu, loading, error, refreshMenu };
}

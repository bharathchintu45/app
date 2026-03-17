import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem } from '../types';

let cachedMenu: MenuItem[] | null = null;
let fetchPromise: Promise<MenuItem[]> | null = null;

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[]>(cachedMenu || []);
  const [loading, setLoading] = useState<boolean>(!cachedMenu);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (cachedMenu) {
        setMenu(cachedMenu);
        setLoading(false);
        return;
      }

      if (!fetchPromise) {
        fetchPromise = Promise.resolve(
          supabase
            .from('menu_items')
            .select('*')
            .order('id')
            .then(({ data, error }) => {
              if (error) throw error;
              if (!data) return [];
              
              return data.map((dbItem) => ({
                id: dbItem.id,
                category: dbItem.category as any,
                name: dbItem.name,
                description: dbItem.description,
                image: dbItem.image_url,
                calories: dbItem.calories,
                protein: dbItem.protein,
                carbs: dbItem.carbs,
                fat: dbItem.fat,
                fiber: dbItem.fiber,
                priceINR: dbItem.price_inr,
                available: dbItem.available,
              })) as MenuItem[];
            })
        );
      }

      try {
        const data = await fetchPromise;
        if (isMounted) {
          cachedMenu = data;
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
    fetchPromise = null; // force new fetch
    const { data, error: err } = await supabase.from('menu_items').select('*').order('id');
    if (err) {
      console.error("Refresh failed", err);
      setError(err.message);
      setLoading(false);
      return;
    }
    if (data) {
      const mapped: MenuItem[] = data.map((dbItem) => ({
        id: dbItem.id,
        category: dbItem.category as any,
        name: dbItem.name,
        description: dbItem.description,
        image: dbItem.image_url,
        calories: dbItem.calories,
        protein: dbItem.protein,
        carbs: dbItem.carbs,
        fat: dbItem.fat,
        fiber: dbItem.fiber,
        priceINR: dbItem.price_inr,
        available: dbItem.available,
      }));
      cachedMenu = mapped;
      setMenu(mapped);
    }
    setLoading(false);
  };

  return { menu, loading, error, refreshMenu };
}

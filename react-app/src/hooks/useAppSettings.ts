import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Hook to read a global app setting from the `app_settings` table.
 * Returns the value (default provided if not found) and a setter for admins.
 */
export function useAppSetting(key: string, defaultValue: boolean = true) {
  const [value, setValue] = useState<boolean>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data) {
          setValue(data.value === true || data.value === "true");
        }
        setLoading(false);
      }
    }

    fetch();

    // Subscribe to realtime changes so all clients update instantly
    const channel = supabase
      .channel(`public:app_settings:key=eq.${key}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "app_settings", 
          filter: `key=eq.${key}` 
        },
        (payload) => {
          if (cancelled) return;
          const data = payload.new as { value: any } | null;
          const newVal = data?.value;
          if (newVal !== null && newVal !== undefined) {
             setValue(newVal === true || newVal === "true");
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [key]);

  /** Toggle the setting in the database (admin only) */
  async function toggle() {
    const newVal = !value;
    setValue(newVal); // optimistic
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      setValue(!newVal); // rollback
      console.error("[useAppSetting] Error:", error);
    }
  }

  return { value, loading, toggle };
}

/**
 * Hook to read a global app setting from the `app_settings` table as a number.
 * Returns the numeric value (default provided if not found) and a setter for admins.
 */
export function useAppSettingNumber(key: string, defaultValue: number = 0) {
  const [value, setValue] = useState<number>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data && data.value !== null && data.value !== undefined) {
          setValue(Number(data.value));
        }
        setLoading(false);
      }
    }

    fetch();

    const channel = supabase
      .channel(`public:app_settings_num:key=eq.${key}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "app_settings", 
          filter: `key=eq.${key}` 
        },
        (payload) => {
          if (cancelled) return;
          const data = payload.new as { value: any } | null;
          if (data?.value !== null && data?.value !== undefined) {
             setValue(Number(data.value));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [key]);

  /** Set the setting in the database (admin only) */
  async function update(newVal: number) {
    setValue(newVal); // optimistic
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[useAppSettingNumber] Error updating:", error);
    }
  }

  return { value, loading, update };
}

/**
 * Hook to read a global app setting from the `app_settings` table as a string.
 */
export function useAppSettingString(key: string, defaultValue: string = "") {
  const [value, setValue] = useState<string>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data && data.value !== null && data.value !== undefined) {
          setValue(String(data.value));
        }
        setLoading(false);
      }
    }

    fetch();

    const channel = supabase
      .channel(`public:app_settings_str:key=eq.${key}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "app_settings", 
          filter: `key=eq.${key}` 
        },
        (payload) => {
          if (cancelled) return;
          const data = payload.new as { value: any } | null;
          if (data?.value !== null && data?.value !== undefined) {
             setValue(String(data.value));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [key]);

  /** Set the setting in the database (admin only) */
  async function update(newVal: string) {
    setValue(newVal); // optimistic
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[useAppSettingString] Error updating:", error);
    }
  }

  return { value, loading, update };
}

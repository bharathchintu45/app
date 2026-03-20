import { useAppSettingsContext } from "../contexts/AppSettingsContext";
import { supabase } from "../lib/supabase";

/**
 * Hook to read a global app setting from the `app_settings` table.
 * Returns the value (default provided if not found) and a setter for admins.
 */
export function useAppSetting(key: string, defaultValue: boolean = true) {
  const { getSetting, loading } = useAppSettingsContext();
  const rawValue = getSetting(key, defaultValue);
  const value = rawValue === true || String(rawValue).toLowerCase() === "true";

  /** Explicitly set the setting in the database (admin only) */
  async function update(newVal: boolean) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[useAppSetting] Error:", error);
    }
  }

  /** Toggle the setting in the database (admin only) */
  async function toggle() {
    const newVal = !value;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[useAppSetting] Error:", error);
    }
  }

  return { value, loading, toggle, update };
}

/**
 * Hook to read a global app setting from the `app_settings` table as a number.
 * Returns the numeric value (default provided if not found) and a setter for admins.
 */
export function useAppSettingNumber(key: string, defaultValue: number = 0) {
  const { getSetting, loading } = useAppSettingsContext();
  const value = Number(getSetting(key, defaultValue));

  /** Set the setting in the database (admin only) */
  async function update(newVal: number) {
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
 * Returns the string value (default provided if not found) and a setter for admins.
 */
export function useAppSettingString(key: string, defaultValue: string = "") {
  const { getSetting, loading } = useAppSettingsContext();
  const value = String(getSetting(key, defaultValue));

  /** Set the setting in the database (admin only) */
  async function update(newVal: string) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newVal, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[useAppSettingString] Error updating:", error);
    }
  }

  return { value, loading, update };
}



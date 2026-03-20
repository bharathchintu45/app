import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface AppSetting {
  key: string;
  value: any;
  type: 'boolean' | 'number' | 'string' | 'json';
}

interface AppSettingsContextType {
  settings: Record<string, any>;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  getSetting: (key: string, defaultValue?: any) => any;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach((s: AppSetting) => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('[AppSettingsContext] Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to changes
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          console.log('[AppSettingsContext] Setting change detected:', payload);
          if (payload.eventType === 'DELETE') {
            setSettings(prev => {
              const next = { ...prev };
              delete next[payload.old.key];
              return next;
            });
          } else {
            const { key, value } = payload.new as AppSetting;
            setSettings(prev => ({ ...prev, [key]: value }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const getSetting = useCallback((key: string, defaultValue?: any) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  return (
    <AppSettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, getSetting }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettingsContext = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettingsContext must be used within an AppSettingsProvider');
  }
  return context;
};

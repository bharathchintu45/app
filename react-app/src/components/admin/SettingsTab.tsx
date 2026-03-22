import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Settings, 
  RefreshCw, 
  ShieldCheck, 
  Play
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { useAppSetting, useAppSettingNumber, useAppSettingString } from "../../hooks/useAppSettings";
import { api } from "../../lib/api";

interface SettingsTabProps {
  showToast: (msg: string) => void;
  fetchOrders?: () => Promise<void>;
}

export default function SettingsTab({ showToast, fetchOrders }: SettingsTabProps) {
  // Use hooks for all settings
  const chatSetting = useAppSetting("chat_enabled", true);
  const personalizedDiscount = useAppSettingNumber("personalized_plan_discount", 0);
  const groupDiscount = useAppSettingNumber("group_order_discount", 0);
  const taxSetting = useAppSettingNumber("tax_percentage", 5);
  const enableRegularOrders = useAppSetting("enable_regular_orders", true);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);
  const enableGroupMeals = useAppSetting("enable_group_meals", true);
  const maintenanceSetting = useAppSetting("maintenance_mode", false);
  const cutoffSetting = useAppSettingNumber("order_cutoff_hour", 22);
  const chefNoteSetting = useAppSettingString("chef_note_text", "");
  const chefNoteEnabledSetting = useAppSetting("chef_note_enabled", false);
  const rewardsEnabled = useAppSetting("rewards_enabled", true);
  const referralEnabled = useAppSetting("referral_enabled", true);
  const bypassEmailsSetting = useAppSettingString("maintenance_bypass_emails", "");
  const deliveryFeeSetting = useAppSettingNumber("delivery_fee", 0);
  const freeDeliverySetting = useAppSetting("free_delivery_enabled", false);
  const supportPhone = useAppSettingString("support_phone_number", "");
  const supportWhatsApp = useAppSettingString("support_whatsapp_number", "");
  const autoOrderTimeSetting = useAppSettingString("auto_order_generation_time", "05:00");
  const autoOrderEnabledSetting = useAppSetting("auto_order_generation_enabled", false);
  const kitchenRealtimeStatus = useAppSetting("kitchen_realtime_status_enabled", true);
  const kitchenPrepAggregation = useAppSetting("kitchen_prep_aggregation_enabled", true);
  const healthPreferencesEnabled = useAppSetting("enable_health_preferences", true);
  const enableDelivery = useAppSetting("enable_standard_delivery", true);
  const enablePickup = useAppSetting("enable_store_pickup", true);
  const storeAddressSetting = useAppSettingString("store_physical_address", "");
  const storeMapUrlSetting = useAppSettingString("store_map_url", "");
  const storeOpenWeekday = useAppSettingString("store_open_weekday", "06:00");
  const storeCloseWeekday = useAppSettingString("store_close_weekday", "21:00");
  const storeOpenWeekend = useAppSettingString("store_open_weekend", "09:00");
  const storeCloseWeekend = useAppSettingString("store_close_weekend", "21:00");
  const googleMapsApiKey = useAppSettingString("google_maps_api_key", "");
  const enableStoreTimings = useAppSetting("enable_store_timing_logic", true);
  const enableEmailAuth = useAppSetting("enable_email_auth", true);
  const enablePhoneAuth = useAppSetting("enable_phone_auth", true);
  const enableAdminPortal = useAppSetting("admin_portal_active", true);
  const enableManagerPortal = useAppSetting("manager_portal_active", true);

  const [draftSettings, setDraftSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowResult, setRunNowResult] = useState<{ success: boolean; message: string; created: number; skipped: number } | null>(null);

  useEffect(() => {
    const allLoaded = [
      chatSetting, personalizedDiscount, groupDiscount, taxSetting,
      enableRegularOrders, enablePersonalizedSubscriptions, enableGroupMeals,
      maintenanceSetting, cutoffSetting, chefNoteSetting, chefNoteEnabledSetting,
      rewardsEnabled, referralEnabled, bypassEmailsSetting, deliveryFeeSetting,
      freeDeliverySetting, supportPhone, supportWhatsApp, autoOrderTimeSetting,
      autoOrderEnabledSetting, kitchenRealtimeStatus, kitchenPrepAggregation,
      healthPreferencesEnabled, storeAddressSetting, storeMapUrlSetting,
      storeOpenWeekday, storeCloseWeekday, storeOpenWeekend, storeCloseWeekend, googleMapsApiKey, enableStoreTimings,
      enableEmailAuth, enablePhoneAuth, enableAdminPortal, enableManagerPortal
    ].every(s => !s.loading);

    if (allLoaded && !draftSettings) {
      setDraftSettings({
        chatEnabled: chatSetting.value,
        personalizedDiscount: personalizedDiscount.value,
        groupDiscount: groupDiscount.value,
        taxPercentage: taxSetting.value,
        enableRegularOrders: enableRegularOrders.value,
        enablePersonalizedSubscriptions: enablePersonalizedSubscriptions.value,
        enableGroupMeals: enableGroupMeals.value,
        maintenanceMode: maintenanceSetting.value,
        orderCutoffHour: cutoffSetting.value,
        chefNote: chefNoteSetting.value,
        chefNoteEnabled: chefNoteEnabledSetting.value,
        rewardsEnabled: rewardsEnabled.value,
        referralEnabled: referralEnabled.value,
        maintenanceBypassEmails: bypassEmailsSetting.value,
        deliveryFee: deliveryFeeSetting.value,
        freeDeliveryEnabled: freeDeliverySetting.value,
        supportPhone: supportPhone.value,
        supportWhatsApp: supportWhatsApp.value,
        autoOrderTime: autoOrderTimeSetting.value,
        autoOrderEnabled: autoOrderEnabledSetting.value,
        kitchenRealtimeEnabled: kitchenRealtimeStatus.value,
        enableKitchenPrepAggregation: kitchenPrepAggregation.value,
        enableHealthPreferences: healthPreferencesEnabled.value,
        enableDelivery: enableDelivery.value,
        enablePickup: enablePickup.value,
        storeAddress: storeAddressSetting.value,
        storeMapUrl: storeMapUrlSetting.value,
        storeOpenWeekday: storeOpenWeekday.value,
        storeCloseWeekday: storeCloseWeekday.value,
        storeOpenWeekend: storeOpenWeekend.value,
        storeCloseWeekend: storeCloseWeekend.value,
        googleMapsApiKey: googleMapsApiKey.value,
        enableStoreTimings: enableStoreTimings.value,
        enableEmailAuth: enableEmailAuth.value,
        enablePhoneAuth: enablePhoneAuth.value,
        enableAdminPortal: enableAdminPortal.value,
        enableManagerPortal: enableManagerPortal.value,
      });
    }
  }, [
    chatSetting.loading, personalizedDiscount.loading, groupDiscount.loading, taxSetting.loading,
    enableRegularOrders.loading, enablePersonalizedSubscriptions.loading, enableGroupMeals.loading,
    maintenanceSetting.loading, cutoffSetting.loading, chefNoteSetting.loading, chefNoteEnabledSetting.loading,
    rewardsEnabled.loading, referralEnabled.loading, deliveryFeeSetting.loading, freeDeliverySetting.loading,
    supportPhone.loading, supportWhatsApp.loading, autoOrderTimeSetting.loading, autoOrderEnabledSetting.loading,
    kitchenRealtimeStatus.loading, kitchenPrepAggregation.loading, healthPreferencesEnabled.loading,
    enableDelivery.loading, enablePickup.loading, storeAddressSetting.loading, storeMapUrlSetting.loading,
    storeOpenWeekday.loading, storeCloseWeekday.loading, storeOpenWeekend.loading, storeCloseWeekend.loading, googleMapsApiKey.loading,
    enableStoreTimings.loading, enableEmailAuth.loading, enablePhoneAuth.loading,
    enableAdminPortal.loading, enableManagerPortal.loading,
    draftSettings
  ]);

  async function handleSaveSettings() {
    if (!draftSettings) return;
    setIsSavingSettings(true);
    try {
      if (draftSettings.chatEnabled !== chatSetting.value) await chatSetting.update(draftSettings.chatEnabled);
      if (draftSettings.enableRegularOrders !== enableRegularOrders.value) await enableRegularOrders.update(draftSettings.enableRegularOrders);
      if (draftSettings.enablePersonalizedSubscriptions !== enablePersonalizedSubscriptions.value) await enablePersonalizedSubscriptions.update(draftSettings.enablePersonalizedSubscriptions);
      if (draftSettings.enableGroupMeals !== enableGroupMeals.value) await enableGroupMeals.update(draftSettings.enableGroupMeals);
      if (draftSettings.maintenanceMode !== maintenanceSetting.value) await maintenanceSetting.update(draftSettings.maintenanceMode);
      if (draftSettings.rewardsEnabled !== rewardsEnabled.value) await rewardsEnabled.update(draftSettings.rewardsEnabled);
      if (draftSettings.referralEnabled !== referralEnabled.value) await referralEnabled.update(draftSettings.referralEnabled);
      if (draftSettings.chefNoteEnabled !== chefNoteEnabledSetting.value) await chefNoteEnabledSetting.update(draftSettings.chefNoteEnabled);
      if (draftSettings.kitchenRealtimeEnabled !== kitchenRealtimeStatus.value) await kitchenRealtimeStatus.update(draftSettings.kitchenRealtimeEnabled);
      if (draftSettings.enableKitchenPrepAggregation !== kitchenPrepAggregation.value) await kitchenPrepAggregation.update(draftSettings.enableKitchenPrepAggregation);
      if (draftSettings.enableHealthPreferences !== healthPreferencesEnabled.value) await healthPreferencesEnabled.update(draftSettings.enableHealthPreferences);
      if (draftSettings.enableDelivery !== enableDelivery.value) await enableDelivery.update(draftSettings.enableDelivery);
      if (draftSettings.enablePickup !== enablePickup.value) await enablePickup.update(draftSettings.enablePickup);
      
      await personalizedDiscount.update(draftSettings.personalizedDiscount);
      await groupDiscount.update(draftSettings.groupDiscount);
      await taxSetting.update(draftSettings.taxPercentage);
      await cutoffSetting.update(draftSettings.orderCutoffHour);
      await chefNoteSetting.update(draftSettings.chefNote);
      await bypassEmailsSetting.update(draftSettings.maintenanceBypassEmails);
      await deliveryFeeSetting.update(draftSettings.deliveryFee);
      await supportPhone.update(draftSettings.supportPhone);
      await supportWhatsApp.update(draftSettings.supportWhatsApp);
      await storeAddressSetting.update(draftSettings.storeAddress);
      await storeMapUrlSetting.update(draftSettings.storeMapUrl);
      await storeOpenWeekday.update(draftSettings.storeOpenWeekday);
      await storeCloseWeekday.update(draftSettings.storeCloseWeekday);
      await storeOpenWeekend.update(draftSettings.storeOpenWeekend);
      await storeCloseWeekend.update(draftSettings.storeCloseWeekend);
      await googleMapsApiKey.update(draftSettings.googleMapsApiKey);
      if (draftSettings.freeDeliveryEnabled !== freeDeliverySetting.value) await freeDeliverySetting.update(draftSettings.freeDeliveryEnabled);
      await autoOrderTimeSetting.update(draftSettings.autoOrderTime);
      if (draftSettings.autoOrderEnabled !== autoOrderEnabledSetting.value) await autoOrderEnabledSetting.update(draftSettings.autoOrderEnabled);
      if (draftSettings.enableStoreTimings !== enableStoreTimings.value) await enableStoreTimings.update(draftSettings.enableStoreTimings);
      if (draftSettings.enableEmailAuth !== enableEmailAuth.value) await enableEmailAuth.update(draftSettings.enableEmailAuth);
      if (draftSettings.enablePhoneAuth !== enablePhoneAuth.value) await enablePhoneAuth.update(draftSettings.enablePhoneAuth);
      if (draftSettings.enableAdminPortal !== enableAdminPortal.value) await enableAdminPortal.update(draftSettings.enableAdminPortal);
      if (draftSettings.enableManagerPortal !== enableManagerPortal.value) await enableManagerPortal.update(draftSettings.enableManagerPortal);
      showToast("Settings saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleRunNow() {
    setRunNowLoading(true);
    setRunNowResult(null);
    try {
      const now = new Date();
      const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
      const targetStr = ist.toISOString().slice(0, 10);

      const { data, error } = await api.v1.generateDailyOrders(targetStr);
      
      if (error) throw error;
      
      setRunNowResult({ success: true, message: `Orders generated for ${targetStr}`, created: data.created, skipped: 0 });
      showToast(`✅ Done: ${data.created} order(s) created`);
      if (fetchOrders) await fetchOrders();
    } catch (err: any) {
      setRunNowResult({ success: false, message: err.message || 'Unknown error', created: 0, skipped: 0 });
      showToast('❌ Error: ' + (err.message || 'Unknown error'));
    } finally {
      setRunNowLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-8">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between">
          <SectionTitle icon={Settings} title="Global Features" subtitle="Manage application-wide toggles and settings" />
          <Button 
            onClick={handleSaveSettings} 
            disabled={isSavingSettings || !draftSettings}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
          >
            {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Chef's Inbox Chat</h3>
              <p className="text-sm text-slate-500 mt-1">Enable or disable the real-time chat feature for customers and kitchen staff.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, chatEnabled: !d.chatEnabled } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.chatEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.chatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Regular Orders</h3>
              <p className="text-sm text-slate-500 mt-1">Toggle the ability for customers to place one-time regular meal orders.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableRegularOrders: !d.enableRegularOrders } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableRegularOrders ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableRegularOrders ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Standard Delivery</h3>
              <p className="text-sm text-slate-500 mt-1">Allow customers to choose standard home/office delivery for their orders.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableDelivery: !d.enableDelivery } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableDelivery ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableDelivery ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Store Pickup</h3>
              <p className="text-sm text-slate-500 mt-1">Allow customers to pick up their orders directly from the physical store.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enablePickup: !d.enablePickup } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePickup ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePickup ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Personalized Subscriptions</h3>
              <p className="text-sm text-slate-500 mt-1">Toggle the personalized meal plan subscription system.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enablePersonalizedSubscriptions: !d.enablePersonalizedSubscriptions } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePersonalizedSubscriptions ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePersonalizedSubscriptions ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Group Meals</h3>
              <p className="text-sm text-slate-500 mt-1">Toggle the group booking and bulk ordering feature.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableGroupMeals: !d.enableGroupMeals } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableGroupMeals ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableGroupMeals ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Kitchen Real-time Status</h3>
              <p className="text-sm text-slate-500 mt-1">Enable live sync indicators and pulse dots on the kitchen dashboard.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, kitchenRealtimeEnabled: !d.kitchenRealtimeEnabled } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.kitchenRealtimeEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.kitchenRealtimeEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Kitchen Prep Aggregation</h3>
              <p className="text-sm text-slate-500 mt-1">Automatically total up ingredients to prep for today's active orders in Kitchen view.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableKitchenPrepAggregation: !d.enableKitchenPrepAggregation } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableKitchenPrepAggregation ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableKitchenPrepAggregation ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Health Preferences</h3>
              <p className="text-sm text-slate-500 mt-1">Enable health goal selection and macro targets on profiles and dashboards.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableHealthPreferences: !d.enableHealthPreferences } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableHealthPreferences ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableHealthPreferences ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Email Login</h3>
              <p className="text-sm text-slate-500 mt-1">Allow customers to log in or sign up using an email address and OTP.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableEmailAuth: !d.enableEmailAuth } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableEmailAuth ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableEmailAuth ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-slate-900">Phone Login</h3>
              <p className="text-sm text-slate-500 mt-1">Allow customers to log in or sign up using a mobile number and SMS OTP.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enablePhoneAuth: !d.enablePhoneAuth } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enablePhoneAuth ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enablePhoneAuth ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-rose-900">Maintenance Mode</h3>
              <p className="text-sm text-rose-500 mt-1">If enabled, customers will see a maintenance message and won't be able to access the site.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, maintenanceMode: !d.maintenanceMode } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.maintenanceMode ? 'bg-rose-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-orange-900">Admin Portal Global Access</h3>
              <p className="text-sm text-orange-600 mt-1">Toggle the entire Admin Console visibility. Use for critical security maintenance.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableAdminPortal: !d.enableAdminPortal } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableAdminPortal ? 'bg-orange-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableAdminPortal ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-indigo-900">Manager Portal Access</h3>
              <p className="text-sm text-indigo-600 mt-1">Enable or disable access to the specialized Operations Hub for Managers.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, enableManagerPortal: !d.enableManagerPortal } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableManagerPortal ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableManagerPortal ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
            <div>
              <h3 className="font-bold text-slate-900">Maintenance Bypass Emails</h3>
              <p className="text-sm text-slate-500 mt-1">Comma-separated emails that can bypass the maintenance screen (e.g. testers, owners).</p>
            </div>
            <div className="mt-4">
              <textarea
                value={draftSettings?.maintenanceBypassEmails ?? ""}
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, maintenanceBypassEmails: e.target.value } : null)}
                className="w-full p-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-20"
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                 <h3 className="font-bold text-slate-900">Rewards Program</h3>
                 <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Active</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Enable or disable the generic rewards and points system.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, rewardsEnabled: !d.rewardsEnabled } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.rewardsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.rewardsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start justify-between">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                 <h3 className="font-bold text-slate-900">Refer & Earn</h3>
                 <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase">Promo</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Manage the visibility of the referral and affiliate incentives program.</p>
            </div>
            <button
              onClick={() => setDraftSettings((d: any) => d ? { ...d, referralEnabled: !d.referralEnabled } : null)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.referralEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.referralEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Order Cutoff Time (24h)</h3>
              <p className="text-sm text-slate-500 mt-1">The hour after which next-day orders are locked (Max 10 PM / 22:00).</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Input 
                type="number" 
                value={draftSettings?.orderCutoffHour ?? 22} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, orderCutoffHour: Math.max(0, Math.min(22, Number(e.target.value) || 0)) } : null)}
                className="w-24 font-bold text-lg bg-white"
                min="0"
                max="22"
              />
              <span className="text-slate-500 font-medium">: 00</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Personalized Plan Discount (%)</h3>
              <p className="text-sm text-slate-500 mt-1">Global discount applied to all personalized meal plans.</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Input 
                type="number" 
                value={draftSettings?.personalizedDiscount ?? 0} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, personalizedDiscount: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : null)}
                className="w-24 font-bold text-lg bg-white"
                min="0"
                max="100"
              />
              <span className="text-slate-500 font-medium">%</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Group Order Discount (%)</h3>
              <p className="text-sm text-slate-500 mt-1">Global discount applied to all bulk/group orders.</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Input 
                type="number" 
                value={draftSettings?.groupDiscount ?? 0} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, groupDiscount: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : null)}
                className="w-24 font-bold text-lg bg-white"
                min="0"
                max="100"
              />
              <span className="text-slate-500 font-medium">%</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Tax Percentage (GST %)</h3>
              <p className="text-sm text-slate-500 mt-1">Global tax rate applied at checkout.</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Input 
                type="number" 
                value={draftSettings?.taxPercentage ?? 5} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, taxPercentage: Math.max(0, Math.min(28, Number(e.target.value) || 0)) } : null)}
                className="w-24 font-bold text-lg bg-white"
                min="0"
                max="28"
              />
              <span className="text-slate-500 font-medium">%</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Delivery Fee (₹)</h3>
                <p className="text-sm text-slate-500 mt-1">Flat delivery charge applied to every order/subscription.</p>
              </div>
              <button
                onClick={() => setDraftSettings((d: any) => d ? { ...d, freeDeliveryEnabled: !d.freeDeliveryEnabled } : null)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.freeDeliveryEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                title="Toggle Free Delivery Offer"
              >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.freeDeliveryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {draftSettings?.freeDeliveryEnabled && (
              <div className="mt-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg inline-flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-700">Free Delivery Offer is Active!</span>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-slate-500 font-medium">₹</span>
              <Input 
                type="number" 
                value={draftSettings?.deliveryFee ?? 0} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, deliveryFee: Math.max(0, Number(e.target.value) || 0) } : null)}
                className="w-24 font-bold text-lg bg-white"
                min="0"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Support Phone Number</h3>
              <p className="text-sm text-slate-500 mt-1">The phone number customers will call for support.</p>
            </div>
            <div className="mt-4">
              <Input 
                value={draftSettings?.supportPhone ?? ""} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, supportPhone: e.target.value } : null)}
                className="w-full font-bold bg-white"
                placeholder="+91 8008880000"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Support WhatsApp Number</h3>
              <p className="text-sm text-slate-500 mt-1">The WhatsApp number (include country code, no + or spaces).</p>
            </div>
            <div className="mt-4">
              <Input 
                value={draftSettings?.supportWhatsApp ?? ""} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, supportWhatsApp: e.target.value } : null)}
                className="w-full font-bold bg-white"
                placeholder="918008880000"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
            <div>
              <h3 className="font-bold text-slate-900">Physical Store Address</h3>
              <p className="text-sm text-slate-500 mt-1">Address shown to customers when they select Store Pickup.</p>
            </div>
            <div className="mt-4">
              <textarea 
                value={draftSettings?.storeAddress ?? ""} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeAddress: e.target.value } : null)}
                className="w-full font-bold bg-white text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="123 Health Ave..."
                rows={2}
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between col-span-full">
            <div>
              <h3 className="font-bold text-slate-900">Store Map Link / Coordinates</h3>
              <p className="text-sm text-slate-500 mt-1">Google Maps URL or precise link to open map directions for pickup.</p>
            </div>
            <div className="mt-4">
              <Input 
                value={draftSettings?.storeMapUrl ?? ""} 
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeMapUrl: e.target.value } : null)}
                className="w-full font-bold bg-white"
                placeholder="https://maps.google.com/?q=..."
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
            <h3 className="font-bold text-slate-900 mb-4">Store Operating Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-wider">
                  <span>Weekdays (Mon-Fri)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Opening Time</label>
                    <Input 
                      type="time"
                      value={draftSettings?.storeOpenWeekday ?? "06:00"} 
                      onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeOpenWeekday: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Closing Time</label>
                    <Input 
                      type="time"
                      value={draftSettings?.storeCloseWeekday ?? "21:00"} 
                      onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeCloseWeekday: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-wider">
                  <span>Weekends (Sat-Sun)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Opening Time</label>
                    <Input 
                      type="time"
                      value={draftSettings?.storeOpenWeekend ?? "09:00"} 
                      onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeOpenWeekend: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Closing Time</label>
                    <Input 
                      type="time"
                      value={draftSettings?.storeCloseWeekend ?? "21:00"} 
                      onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, storeCloseWeekend: e.target.value } : null)}
                      className="w-full font-bold bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
            <h3 className="font-bold text-slate-900 mb-2 text-rose-600">Google Maps Platform Configuration</h3>
            <p className="text-xs text-slate-500 mb-4">Required for exact customer location detection and address pin drops.</p>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Google Maps API Key</label>
            <Input 
              type="password"
              value={draftSettings?.googleMapsApiKey ?? ""} 
              onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, googleMapsApiKey: e.target.value } : null)}
              className="w-full font-bold bg-white"
              placeholder="Enter your API Key"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">Chef's Daily Note</h3>
                <p className="text-sm text-slate-500 mt-1">A personalized greeting displayed on the user dashboard.</p>
              </div>
              <button
                onClick={() => setDraftSettings((d: any) => d ? { ...d, chefNoteEnabled: !d.chefNoteEnabled } : null)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.chefNoteEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.chefNoteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {draftSettings?.chefNoteEnabled && (
              <textarea
                value={draftSettings?.chefNote ?? ""}
                onChange={(e: any) => setDraftSettings((d: any) => d ? { ...d, chefNote: e.target.value } : null)}
                className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="Write something inspiring for your customers..."
              />
            )}
            {!draftSettings?.chefNoteEnabled && (
              <div className="text-sm text-slate-400 italic px-1">Chef note is currently hidden from customers.</div>
            )}
          </div>

          {/* ── Auto Order Scheduler Card ── */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 col-span-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-indigo-900">Auto Subscription Order Generator</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${draftSettings?.autoOrderEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {draftSettings?.autoOrderEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-sm text-indigo-700 mt-1">
                  Automatically creates today's delivery orders for all active subscriptions at the scheduled time (IST).
                  Runs via Supabase cron — no browser needed. Duplicate-safe: already-generated orders are skipped.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Daily Run Time (IST)</label>
                    <input
                      type="time"
                      value={draftSettings?.autoOrderTime ?? "05:00"}
                      onChange={e => setDraftSettings((d: any) => d ? { ...d, autoOrderTime: e.target.value } : null)}
                      className="h-10 px-4 rounded-xl border border-indigo-200 bg-white font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Schedule</label>
                    <div className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-indigo-100 text-sm font-medium text-slate-700">
                      {draftSettings?.autoOrderEnabled
                        ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" /> Daily at {draftSettings.autoOrderTime} IST</>
                        : <><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Schedule disabled</>
                      }
                    </div>
                  </div>
                </div>
                {runNowResult && (
                  <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 ${runNowResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                    {runNowResult.success ? '✅' : '❌'}
                    <span>{runNowResult.message}</span>
                    {runNowResult.success && <><span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-black">{runNowResult.created} created</span><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-black">{runNowResult.skipped} skipped</span></>}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-indigo-700">Enable</span>
                  <button
                    onClick={() => setDraftSettings((d: any) => d ? { ...d, autoOrderEnabled: !d.autoOrderEnabled } : null)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.autoOrderEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.autoOrderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button
                  onClick={handleRunNow}
                  disabled={runNowLoading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200"
                >
                  {runNowLoading ? <><RefreshCw size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Run Now</>}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 col-span-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Enable Store Timing Logic</h3>
                <p className="text-sm text-slate-500 mt-1">If enabled, the store will show as "Closed" outside of operating hours.</p>
              </div>
              <button
                onClick={() => setDraftSettings((d: any) => d ? { ...d, enableStoreTimings: !d.enableStoreTimings } : null)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftSettings?.enableStoreTimings ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftSettings?.enableStoreTimings ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

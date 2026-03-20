import { useState } from "react";
import { User, Mail, Phone, Target, Leaf } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { useAppSetting } from "../../hooks/useAppSettings";
import type { AppUser, DeliveryDetails } from "../../types";

interface ProfileFormProps {
  user: AppUser;
  setUser: (u: AppUser | null) => void;
}

const HEALTH_GOALS = ["Weight Loss", "Muscle Gain", "Maintenance", "Endurance", "Clean Eating"];
const DIET_PREFS  = ["Vegetarian", "Non-Veg", "Vegan", "Keto", "High Protein", "Low Carb"];

export function ProfileForm({ user, setUser }: ProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    delivery: {
      receiverName: user?.defaultDelivery?.receiverName || user?.name || "",
      receiverPhone: user?.defaultDelivery?.receiverPhone || user?.phone || "",
      locationType: user?.defaultDelivery?.locationType || "House",
      building: user?.defaultDelivery?.building || "",
      street: user?.defaultDelivery?.street || "",
      area: user?.defaultDelivery?.area || "",
      addressLabel: user?.defaultDelivery?.addressLabel || "Home",
      instructions: user?.defaultDelivery?.instructions || "",
    } as DeliveryDetails,
  });

  // Health preferences (local state until we add DB columns)
  const healthPreferencesEnabled = useAppSetting("enable_health_preferences", true);
  const [selectedGoal, setSelectedGoal]   = useState<string | null>(null);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);

  // Phone update flow
  const [phoneStep, setPhoneStep] = useState<'idle' | 'input' | 'otp'>('idle');
  const [newPhone, setNewPhone]   = useState('');
  const [phoneOtp, setPhoneOtp]   = useState('');
  const [phoneMsg, setPhoneMsg]   = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: formData.name, email: formData.email })
      .eq('id', user.id);

    if (error) {
      setSaveMsg('❌ Save failed: ' + error.message);
    } else {
      setUser({ ...user, name: formData.name, email: formData.email, defaultDelivery: formData.delivery });
      setSaveMsg('✅ Profile updated!');
      setEditing(false);
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const sendPhoneOtp = async () => {
    if (!newPhone.trim() || newPhone.replace(/\D/g, '').length < 10) { setPhoneMsg('❌ Enter a valid 10-digit number.'); return; }
    setPhoneLoading(true); setPhoneMsg('');
    const phone = '+91' + newPhone.replace(/\D/g, '').slice(-10);
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) { setPhoneMsg('❌ ' + error.message); } else { setPhoneStep('otp'); setPhoneMsg('✅ OTP sent to ' + phone); }
    setPhoneLoading(false);
  };

  const verifyPhoneOtp = async () => {
    if (!phoneOtp.trim()) { setPhoneMsg('❌ Enter the OTP.'); return; }
    setPhoneLoading(true);
    const phone = '+91' + newPhone.replace(/\D/g, '').slice(-10);
    const { error } = await supabase.auth.verifyOtp({ phone, token: phoneOtp, type: 'phone_change' });
    if (error) { setPhoneMsg('❌ Wrong OTP: ' + error.message); }
    else {
      await supabase.from('profiles').update({ phone_number: phone }).eq('id', user?.id || '');
      setUser({ ...user!, phone });
      setPhoneStep('idle'); setNewPhone(''); setPhoneOtp('');
      setPhoneMsg('✅ Phone number updated!');
      setTimeout(() => setPhoneMsg(''), 4000);
    }
    setPhoneLoading(false);
  };

  return (
    <>
      {/* ─── Personal Info Card ─── */}
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-5 px-5 md:px-8">
          <SectionTitle icon={User} title="Personal Information" subtitle="Your identity and contact details." />
          <Button
            variant={editing ? "primary" : "outline"}
            size="sm"
            onClick={() => editing ? handleSave() : setEditing(true)}
            className="bg-white shrink-0 ml-3"
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
          </Button>
        </CardHeader>
        <CardContent className="p-5 md:p-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input disabled={!editing} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="pl-10 disabled:bg-slate-50 disabled:border-transparent font-medium" />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone</label>
              {phoneStep === 'idle' ? (
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input disabled value={user.phone || 'Not set'} className="pl-10 bg-slate-50 border-transparent font-medium" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPhoneStep('input')} className="shrink-0 text-sky-600 border-sky-200 hover:bg-sky-50">Change</Button>
                </div>
              ) : phoneStep === 'input' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value="+91" disabled className="w-16 bg-slate-50 text-center px-1 shrink-0" />
                    <Input value={newPhone} onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" inputMode="numeric" className="flex-1" />
                    <Button size="sm" onClick={sendPhoneOtp} disabled={phoneLoading} className="shrink-0">{phoneLoading ? 'Sending…' : 'Send OTP'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setPhoneStep('idle'); setNewPhone(''); setPhoneMsg(''); }} className="shrink-0">Cancel</Button>
                  </div>
                  {phoneMsg && <p className={`text-xs font-medium ${phoneMsg.startsWith('✅') ? 'text-slate-700' : 'text-rose-600'}`}>{phoneMsg}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {phoneMsg && <p className={`text-xs font-medium ${phoneMsg.startsWith('✅') ? 'text-slate-700' : 'text-rose-600'}`}>{phoneMsg}</p>}
                  <div className="flex gap-2">
                    <Input value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" inputMode="numeric" className="flex-1" />
                    <Button size="sm" onClick={verifyPhoneOtp} disabled={phoneLoading} className="shrink-0">{phoneLoading ? 'Verifying…' : 'Verify'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setPhoneStep('idle'); setNewPhone(''); setPhoneOtp(''); setPhoneMsg(''); }} className="shrink-0">Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input disabled={!editing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="yourname@example.com" className="pl-10 disabled:bg-slate-50 disabled:border-transparent font-medium" />
              </div>
            </div>
          </div>

          {saveMsg && (
            <div className={`p-3 rounded-xl text-sm font-medium text-center ${saveMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{saveMsg}</div>
          )}
        </CardContent>
      </Card>

      {/* ─── Health Preferences Card ─── */}
      {!healthPreferencesEnabled.loading && healthPreferencesEnabled.value && (
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-5 px-5 md:px-8">
          <SectionTitle icon={Target} title="Health Preferences" subtitle="Help us personalise your meal plan." />
        </CardHeader>
        <CardContent className="p-5 md:p-8 space-y-6">
          {/* Goal Tags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Health Goal</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {HEALTH_GOALS.map(goal => (
                <button
                  key={goal}
                  onClick={() => setSelectedGoal(selectedGoal === goal ? null : goal)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                    selectedGoal === goal
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                  )}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          {/* Diet Preference Tags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Leaf size={14} className="text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Diet Preference <span className="text-slate-300 font-medium normal-case">(pick all that apply)</span></span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DIET_PREFS.map(diet => {
                const active = selectedDiets.includes(diet);
                return (
                  <button
                    key={diet}
                    onClick={() => setSelectedDiets(active ? selectedDiets.filter(d => d !== diet) : [...selectedDiets, diet])}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                      active
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"
                    )}
                  >
                    {diet}
                  </button>
                );
              })}
            </div>
          </div>

          {(selectedGoal || selectedDiets.length > 0) && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <Leaf size={16} className="text-indigo-500 mt-0.5 shrink-0" />
              <div className="text-sm text-indigo-700 font-medium">
                {selectedGoal && <span className="font-bold">Goal: {selectedGoal}. </span>}
                {selectedDiets.length > 0 && <span>Preferences: {selectedDiets.join(", ")}.</span>}
                <span className="text-indigo-400 ml-1">Our chefs will personalise your meals accordingly.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </>
  );
}

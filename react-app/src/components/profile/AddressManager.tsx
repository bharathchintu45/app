import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Input, Textarea } from "../ui/Input";
import { SectionTitle } from "../ui/Typography";
import { supabase } from "../../lib/supabase";
import type { AppUser, DeliveryDetails } from "../../types";

interface AddressManagerProps {
  user: AppUser;
  setUser: (u: AppUser | null) => void;
}

export function AddressManager({ user, setUser }: AddressManagerProps) {
  const [addrMode, setAddrMode] = useState<'view' | 'add' | 'edit'>('view');
  const [addrDraft, setAddrDraft] = useState<DeliveryDetails | null>(null);
  const [addrEditIdx, setAddrEditIdx] = useState<'primary' | number | null>(null);
  const [addrMsg, setAddrMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const showAddrMsg = (msg: string) => { setAddrMsg(msg); setTimeout(() => setAddrMsg(''), 3000); };

  const persistAddresses = async (userId: string, updatedUser: AppUser) => {
    const { error } = await supabase.from('profiles').update({
      saved_addresses: updatedUser.savedAddresses || [],
      default_delivery: updatedUser.defaultDelivery || null,
    }).eq('id', userId);
    return error;
  };

  const blankAddr = (): DeliveryDetails => ({
    receiverName: user.name || '',
    receiverPhone: user.phone || '',
    locationType: 'House',
    building: '',
    street: '',
    area: '',
    addressLabel: '',
    instructions: '',
  });

  const handleAddNew = () => {
    setAddrDraft(blankAddr());
    setAddrEditIdx(null);
    setAddrMode('add');
  };

  const handleEditAddr = (idx: 'primary' | number) => {
    const addr = idx === 'primary' ? user.defaultDelivery : user.savedAddresses?.[idx as number];
    if (!addr) return;
    setAddrDraft({ ...addr });
    setAddrEditIdx(idx);
    setAddrMode('edit');
  };

  const handleSaveAddr = async () => {
    if (!addrDraft || !user.id) return;
    setSaving(true);
    let updatedUser: AppUser;

    if (addrMode === 'add') {
      const hasDefault = !!user.defaultDelivery?.building;
      updatedUser = {
        ...user,
        defaultDelivery: hasDefault ? user.defaultDelivery : addrDraft,
        savedAddresses: hasDefault ? [...(user.savedAddresses || []), addrDraft] : (user.savedAddresses || []),
      };
    } else if (addrEditIdx === 'primary') {
      updatedUser = { ...user, defaultDelivery: addrDraft };
    } else {
      const updated = [...(user.savedAddresses || [])];
      updated[addrEditIdx as number] = addrDraft;
      updatedUser = { ...user, savedAddresses: updated };
    }

    const err = await persistAddresses(user.id, updatedUser);
    setSaving(false);
    if (err) { showAddrMsg('❌ Failed to save: ' + err.message); return; }

    setUser(updatedUser);
    setAddrMode('view');
    setAddrDraft(null);
    showAddrMsg(addrMode === 'add' ? '✅ New address saved!' : '✅ Address updated!');
  };

  const handleDeleteAddr = async (idx: number) => {
    if (!window.confirm('Delete this address?')) return;
    const updated = [...(user.savedAddresses || [])];
    updated.splice(idx, 1);
    const updatedUser = { ...user, savedAddresses: updated };
    const err = await persistAddresses(user.id!, updatedUser);
    if (err) { showAddrMsg('❌ Failed to delete: ' + err.message); return; }
    setUser(updatedUser);
    showAddrMsg('🗑️ Address removed.');
  };

  const handleSetPrimary = async (idx: number) => {
    const addr = user.savedAddresses?.[idx];
    if (!addr) return;
    const oldDefault = user.defaultDelivery!;
    const updated = [...(user.savedAddresses || [])];
    updated.splice(idx, 1, oldDefault);
    const updatedUser = { ...user, defaultDelivery: addr, savedAddresses: updated };
    const err = await persistAddresses(user.id!, updatedUser);
    if (err) { showAddrMsg('❌ Failed: ' + err.message); return; }
    setUser(updatedUser);
    showAddrMsg('✅ Default address updated!');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <SectionTitle 
          icon={MapPin} 
          title="Saved Addresses" 
          subtitle="Manage your delivery locations."
        />
        {addrMode === 'view' && (
          <Button variant="outline" size="sm" onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" /> Add New
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {addrMsg && (
          <div className={`p-3 rounded-xl text-sm font-medium text-center ${
            addrMsg.startsWith('✅') ? 'bg-slate-50 text-slate-700 border border-slate-200' :
            addrMsg.startsWith('🗑') ? 'bg-slate-50 text-slate-600 border border-slate-200' :
            'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>{addrMsg}</div>
        )}

        {user.defaultDelivery?.building ? (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-1">Primary Address</h4>
            <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{user.defaultDelivery?.addressLabel || "Home"}</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-700 font-bold uppercase tracking-wider">{user.defaultDelivery?.locationType}</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{user.defaultDelivery?.receiverName}</p>
                  <p className="text-xs text-slate-500">{user.defaultDelivery?.receiverPhone}</p>
                  <p className="text-sm text-slate-600 mt-1">{[user.defaultDelivery?.building, user.defaultDelivery?.street, user.defaultDelivery?.area].filter(Boolean).join(', ')}</p>
                  {user.defaultDelivery?.instructions && (
                    <p className="text-xs text-slate-400 italic mt-1">📝 {user.defaultDelivery.instructions}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900" onClick={() => handleEditAddr('primary')}>
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400">
            <MapPin className="mx-auto mb-2 w-6 h-6 opacity-40" />
            <p className="text-sm">No primary address yet. Add one below.</p>
          </div>
        )}

        {(user.savedAddresses || []).length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">Other Saved Addresses</h4>
            <div className="grid gap-3">
              {(user.savedAddresses || []).map((addr, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors group">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{addr.addressLabel || 'Address ' + (idx + 2)}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-bold uppercase tracking-wider">{addr.locationType}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{addr.receiverName}</p>
                      <p className="text-xs text-slate-500">{addr.receiverPhone}</p>
                      <p className="text-sm text-slate-600 mt-1">{[addr.building, addr.street, addr.area].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Button variant="ghost" size="sm" className="text-sky-600 text-xs" onClick={() => handleEditAddr(idx)}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-slate-600 text-xs whitespace-nowrap" onClick={() => handleSetPrimary(idx)}>Set Primary</Button>
                    <Button variant="ghost" size="sm" className="text-rose-500 text-xs" onClick={() => handleDeleteAddr(idx)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(addrMode === 'add' || addrMode === 'edit') && addrDraft && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-4 border-t border-slate-100">
            <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/40 space-y-5">
              <h4 className="text-sm font-bold text-slate-800">
                {addrMode === 'add' ? '➕ New Address' : '✏️ Edit Address'}
              </h4>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Location Type</label>
                <div className="flex gap-2">
                  {(["House", "Office", "Other"] as const).map((t) => (
                    <Button key={t} variant={addrDraft.locationType === t ? "primary" : "outline"} size="sm"
                      onClick={() => setAddrDraft({ ...addrDraft, locationType: t })} className="flex-1">
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Receiver Name</label>
                  <Input value={addrDraft.receiverName} onChange={(e) => setAddrDraft({ ...addrDraft, receiverName: e.target.value })} placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Receiver Phone</label>
                  <Input value={addrDraft.receiverPhone} onChange={(e) => setAddrDraft({ ...addrDraft, receiverPhone: e.target.value })} placeholder="10-digit mobile" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Building / Floor</label>
                  <Input value={addrDraft.building} onChange={(e) => setAddrDraft({ ...addrDraft, building: e.target.value })} placeholder="4th Floor, Skyline Apts" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Street Name</label>
                  <Input value={addrDraft.street} onChange={(e) => setAddrDraft({ ...addrDraft, street: e.target.value })} placeholder="MG Road" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Area / Locality</label>
                  <Input value={addrDraft.area} onChange={(e) => setAddrDraft({ ...addrDraft, area: e.target.value })} placeholder="Indiranagar, Bangalore" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Save As (nickname)</label>
                  <Input value={addrDraft.addressLabel} onChange={(e) => setAddrDraft({ ...addrDraft, addressLabel: e.target.value })} placeholder="e.g. Home, Office, Gym" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Delivery Instructions (optional)</label>
                <Textarea value={addrDraft.instructions || ''} onChange={(e) => setAddrDraft({ ...addrDraft, instructions: e.target.value })}
                  placeholder="Leave at the gate, ring bell twice..." className="resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveAddr} disabled={saving} className="flex-1">
                  {saving ? 'Saving…' : addrMode === 'add' ? 'Add Address' : 'Update Address'}
                </Button>
                <Button variant="outline" onClick={() => { setAddrMode('view'); setAddrDraft(null); }} className="flex-1">Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

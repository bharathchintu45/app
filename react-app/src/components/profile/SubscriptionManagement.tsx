import { useState, useEffect } from "react";
import { PauseCircle, PlayCircle, XCircle, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import type { AppUser } from "../../types";

interface SubscriptionManagementProps {
  user: AppUser;
  onUpdate?: () => void;
  showToast?: (msg: string) => void;
}

export function SubscriptionManagement({ user, onUpdate, showToast }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubscription = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      setSubscription(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscription();

    const channel = supabase
      .channel(`user-subscription-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'subscriptions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchSubscription();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  const updateStatus = async (newStatus: string, updates: Record<string, any> = {}) => {
    if (!subscription || actionLoading) return false;
    setActionLoading(true);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: newStatus, ...updates })
      .eq('id', subscription.id);

    if (error) {
      const msg = `❌ Failed: ${error.message}`;
      showToast?.(msg);
      setActionLoading(false);
      return false;
    }

    if (onUpdate) onUpdate();
    setActionLoading(false);
    return true;
  };

  const handlePause = async () => {
    const pauseEnd = new Date(); 
    pauseEnd.setDate(pauseEnd.getDate() + 7);
    const ok = await updateStatus('paused', { 
      meta: { ...(subscription.meta || {}), pause_until: pauseEnd.toISOString() } 
    });
    if (ok) showToast?.('⏸️ Subscription paused for 7 days.');
  };

  const handleResume = async () => {
    const ok = await updateStatus('active', { 
      meta: { ...(subscription.meta || {}), pause_until: null } 
    });
    if (ok) showToast?.('▶️ Subscription resumed successfully.');
  };

  const handleCancel = async () => {
    if (!subscription || actionLoading) return;
    const confirmed = window.confirm("Are you sure you want to cancel your plan? This will stop future deliveries.");
    if (!confirmed) return;
    const ok = await updateStatus('cancelled');
    if (ok) showToast?.('⏹️ Subscription cancelled.');
  };

  if (loading) return null;

  if (!subscription) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <CreditCard size={28} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">Ready to Start?</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">You don't have an active meal plan yet. Start your journey today!</p>
        <Button onClick={() => window.location.hash = "#home"} className="rounded-2xl h-12 px-8 bg-slate-900 text-white font-bold">
          Explore Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {subscription.status === 'paused' ? (
          <Button 
            onClick={handleResume} 
            disabled={actionLoading} 
            className="flex-1 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-200"
          >
            <PlayCircle size={20} className="mr-2" /> Resume Deliveries
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={handlePause} 
            disabled={actionLoading} 
            className="flex-1 h-14 rounded-2xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-black"
          >
            <PauseCircle size={20} className="mr-2" /> Pause for 7 Days
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          onClick={handleCancel} 
          disabled={actionLoading} 
          className="h-14 px-6 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold"
        >
          <XCircle size={20} className="mr-2" /> Cancel Plan
        </Button>
      </div>

      {subscription.status === 'paused' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800 leading-relaxed">
            Your plan is currently paused. Deliveries will resume automatically after the pause period ends.
          </p>
        </div>
      )}
    </div>
  );
}

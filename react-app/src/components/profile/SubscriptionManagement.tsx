import { useState, useEffect } from "react";
import { PauseCircle, PlayCircle, XCircle, Calendar, CreditCard } from "lucide-react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { formatDateIndia } from "../../lib/format";
import type { AppUser } from "../../types";
import { cn } from "../../lib/utils";

interface SubscriptionManagementProps {
  user: AppUser;
  onUpdate?: () => void;
  showToast?: (msg: string) => void;
  /** Pre-fetched subscription order from the parent. If provided, no extra fetch is made. */
  prefetchedOrder?: any;
}

export function SubscriptionManagement({ user, onUpdate, showToast, prefetchedOrder }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<any>(prefetchedOrder ?? null);
  const [loading, setLoading] = useState(!prefetchedOrder);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Sync if parent re-fetches and gives us a new prefetched order
  useEffect(() => {
    if (prefetchedOrder !== undefined) {
      setSubscription(prefetchedOrder);
      setLoading(false);
    }
  }, [prefetchedOrder]);

  useEffect(() => {
    // Only fetch independently when no prefetched data is provided
    if (prefetchedOrder !== undefined) return;

    async function fetchSub() {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'personalized')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(!error && data ? data : null);
      setLoading(false);
    }
    fetchSub();

    const channel = supabase
      .channel(`user-sub-${user.id}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        setSubscription((prev: any) => (prev && prev.id === deletedId ? null : prev));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { fetchSub(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, prefetchedOrder]);

  const updateStatus = async (newStatus: string, extraMeta?: Record<string, any>) => {
    if (!subscription || actionLoading) return false;
    setActionLoading(true);
    setMessage('');
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, meta: { ...(subscription.meta || {}), ...extraMeta } })
      .eq('id', subscription.id);
    if (error) {
      const msg = `❌ Failed: ${error.message}`;
      setMessage(msg); showToast?.(msg);
      setActionLoading(false);
      return false;
    }
    setSubscription({ ...subscription, status: newStatus, meta: { ...(subscription.meta || {}), ...extraMeta } });
    if (onUpdate) onUpdate();
    setActionLoading(false);
    return true;
  };

  const handlePause = async () => {
    const pauseEnd = new Date(); pauseEnd.setDate(pauseEnd.getDate() + 7);
    const now = new Date().toISOString();
    const ok = await updateStatus('paused', { pause_start_date: now, pause_end_date: pauseEnd.toISOString() });
    if (ok) { const msg = '⏸️ Subscription paused for 7 days.'; setMessage(msg); showToast?.(msg); }
  };

  const handleResume = async () => {
    const ok = await updateStatus('active', { pause_start_date: null, pause_end_date: null });
    if (ok) { const msg = '▶️ Subscription resumed successfully.'; setMessage(msg); showToast?.(msg); }
  };

  const handleCancel = async () => {
    if (!subscription || actionLoading) return;
    const confirmed = window.confirm("Are you sure you want to cancel your plan? This action cannot be undone.");
    if (!confirmed) return;
    const ok = await updateStatus('cancelled', { cancellation_date: new Date().toISOString() });
    if (ok) { const msg = '⏹️ Subscription cancelled.'; setMessage(msg); showToast?.(msg); }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400 font-medium">Loading subscription…</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <CreditCard size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-700 mb-1">No Active Subscription</p>
        <p className="text-xs text-slate-400">You don't have an active meal plan. Start one from the home page.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active:    'bg-emerald-100 text-emerald-800',
    pending:   'bg-sky-100 text-sky-800',
    paused:    'bg-amber-100 text-amber-800',
    cancelled: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <CreditCard size={16} className="text-slate-600" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">Subscription Management</div>
            <div className="text-xs text-slate-400 font-medium">View and control your current plan</div>
          </div>
        </div>
        <span className={cn("px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full", statusColors[subscription.status] || 'bg-slate-100 text-slate-800')}>
          {subscription.status}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current Plan</div>
            <div className="text-base font-black text-slate-900">{subscription.meta?.plan || 'Personalized Plan'}</div>
            {subscription.meta?.durationDays && (
              <div className="text-xs text-slate-500 font-medium mt-0.5">{subscription.meta.durationDays} days · {subscription.meta?.mealsPerDay || 2} meals/day</div>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4 flex items-center gap-3">
            <Calendar size={16} className="text-slate-400 shrink-0" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Start Date</div>
              <div className="text-sm font-black text-slate-900">{formatDateIndia(subscription.created_at || subscription.delivery_date)}</div>
            </div>
          </div>
        </div>

        {subscription.status === 'paused' && subscription.meta?.pause_end_date && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <PauseCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-amber-900">Plan Paused</div>
              <p className="text-xs text-amber-700 mt-0.5">
                Auto-resumes on <strong>{formatDateIndia(subscription.meta.pause_end_date)}</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          {(subscription.status === 'active' || subscription.status === 'pending') && (
            <Button variant="outline" onClick={handlePause} disabled={actionLoading} className="border-amber-200 text-amber-700 hover:bg-amber-50 text-sm">
              <PauseCircle size={15} className="mr-1.5" /> Pause (1 Week)
            </Button>
          )}
          {subscription.status === 'paused' && (
            <Button onClick={handleResume} disabled={actionLoading} className="bg-slate-900 hover:bg-black text-white text-sm">
              <PlayCircle size={15} className="mr-1.5" /> Resume Now
            </Button>
          )}
          {subscription.status !== 'cancelled' && (
            <Button variant="ghost" onClick={handleCancel} disabled={actionLoading} className="text-rose-600 hover:bg-rose-50 text-sm">
              <XCircle size={15} className="mr-1.5" /> Cancel Plan
            </Button>
          )}
        </div>

        {message && (
          <div className={cn("p-3 rounded-xl text-sm font-medium border", message.includes('❌') ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200')}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { LuxuryLabel } from "../ui/Typography";
import { RefreshCw, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { api } from "../../lib/api";

export function ManualOrderTrigger({ showToast }: { showToast: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<{ success: boolean; message: string; created: number } | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await api.v1.generateDailyOrders(date);
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ success: true, message: `Successfully checked subscriptions.`, created: data?.created || 0 });
      showToast(`Success: Generated ${data?.created || 0} orders.`);
    } catch (err: any) {
      console.error("[ManualTrigger] Error:", err);
      setResult({ success: false, message: err.message || "Failed to trigger generation", created: 0 });
      showToast("Trigger failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-indigo-100 bg-indigo-50/30">
      <CardHeader>
        <LuxuryLabel text="Subscription Order Engine" />
        <div className="mt-1 text-sm text-black/55">
          Manually trigger the daily order generator for a specific date.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Calendar size={12} /> Target Date
            </label>
            <Input 
              type="date" 
              value={date} 
              onChange={(e: any) => setDate(e.target.value)} 
              className="bg-white border-indigo-100"
            />
          </div>
          <Button 
            onClick={handleTrigger} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {loading ? "Generating..." : "Generate Orders"}
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded-xl border flex items-start gap-4 animate-fade-in ${
            result.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
          }`}>
            <div className="shrink-0 mt-0.5">
              {result.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </div>
            <div>
              <div className="font-bold text-sm">{result.success ? "Generation Complete" : "Generation Failed"}</div>
              <div className="text-xs opacity-80 mt-0.5">{result.message}</div>
              {result.created > 0 && (
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                  {result.created} New Orders
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

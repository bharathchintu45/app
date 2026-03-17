import { Hammer, Lock, Mail } from 'lucide-react';

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-8 md:p-12 text-center entrance-scale">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
          <Hammer className="text-emerald-500 w-10 h-10 animate-bounce" />
          <div className="absolute -top-1 -right-1 p-1.5 rounded-full bg-slate-900 border-2 border-white">
            <Lock size={12} className="text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
          Under <br />
          <span className="text-emerald-500 underline decoration-emerald-200 underline-offset-8">Maintenance</span>
        </h1>
        
        <p className="text-slate-500 font-medium leading-relaxed mb-8">
          We're currently optimizing the Fresh Box experience. We'll be back shortly with a smoother, faster plateau for your health goals.
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-3">
            <Mail size={18} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600">support@thefreshbox.in</span>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Only authorized personnel can bypass this screen
          </p>
        </div>
      </div>
    </div>
  );
}

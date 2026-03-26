import { ArrowRight, Sparkles, LayoutDashboard, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "../ui/Button";

interface EmptyDashboardStateProps {
  onBrowseMenu: () => void;
  onBuildPlan: () => void;
}

export function EmptyDashboardState({ onBrowseMenu, onBuildPlan }: EmptyDashboardStateProps) {
  return (
    <div className="w-full mt-4 sm:mt-6 animate-fade-in-up">
      {/* Premium Glass Card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/60 shadow-xl shadow-slate-900/5 p-8 sm:p-12 md:p-16 text-center">
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <LayoutDashboard size={240} />
        </div>
        <div className="absolute -left-10 -bottom-10 opacity-[0.03] pointer-events-none transform -rotate-12">
          <UtensilsCrossed size={200} />
        </div>

        {/* Floating Embellishment */}
        <div className="relative z-10 flex justify-center mb-6">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] bg-gradient-to-tr from-emerald-100 to-teal-50 flex items-center justify-center shadow-inner border border-white">
            <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-sm border border-slate-100 animate-bounce">
              <Sparkles size={14} className="text-amber-500" />
            </div>
            <span className="text-4xl sm:text-5xl">🥗</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Your Dashboard is Empty
          </h2>
          <p className="text-slate-500 text-sm sm:text-base md:text-lg font-medium leading-relaxed">
            You don't have an active meal plan yet. Subscribe to a customized plan or browse our menu to start enjoying chef-prepared meals delivered directly to your door.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={onBuildPlan}
            className="w-full sm:w-auto px-8 py-6 rounded-[1.5rem] bg-slate-950 text-white font-bold text-sm sm:text-base shadow-xl shadow-slate-900/20 hover:bg-slate-900 transition-all hover:scale-[1.02] active:scale-95 group"
          >
            Build a Custom Plan
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button 
            onClick={onBrowseMenu}
            variant="outline"
            className="w-full sm:w-auto px-8 py-6 rounded-[1.5rem] bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm sm:text-base hover:border-slate-300 hover:bg-slate-50 transition-all hover:translate-y-px"
          >
            <ShoppingBag className="mr-2 w-4 h-4 text-slate-400" />
            Browse Menu
          </Button>
        </div>

      </div>

      {/* Feature Highlights beneath */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 max-w-4xl mx-auto px-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">🔥</div>
          <h4 className="font-bold text-slate-900 text-sm">Track Macros</h4>
          <p className="text-xs text-slate-500">Hit your calorie and protein goals effortlessly.</p>
        </div>
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">🔄</div>
          <h4 className="font-bold text-slate-900 text-sm">Flexible Swaps</h4>
          <p className="text-xs text-slate-500">Change your meals or hold days anytime.</p>
        </div>
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">👨‍🍳</div>
          <h4 className="font-bold text-slate-900 text-sm">Chef Prepared</h4>
          <p className="text-xs text-slate-500">Restaurant-quality taste in every bite.</p>
        </div>
      </div>
    </div>
  );
}

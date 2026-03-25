import React from "react";
import { useAppSetting } from "../../hooks/useAppSettings";
import type { AppUser, AuthIntent, DashboardTab, Route } from "../../types";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

import { useUser } from "../../contexts/UserContext";

export function TopNav({
  route,
  setRoute,
  dashboardTab,
  setDashboardTab,
  setAuthOpen,
  setAuthIntent,
  unreadChefMessages = 0,
  hasActiveSubscription = false,
}: {
  route: Route;
  setRoute: (r: Route) => void;
  dashboardTab: DashboardTab;
  setDashboardTab: (t: DashboardTab) => void;
  authOpen: boolean;
  setAuthOpen: (b: boolean) => void;
  authIntent: AuthIntent;
  setAuthIntent: (v: AuthIntent) => void;
  unreadChefMessages?: number;
  hasActiveSubscription?: boolean;
}) {
  const { user, setUser } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);

  const navLinks = [
    { label: "Home", route: "home" as Route },
  ];

  async function handleAuthClick() {
    if (user) {
      if (window.confirm("Sign out?")) {
        await supabase.auth.signOut();
        setUser(null);
      }
    } else {
      setAuthIntent("regular");  // customers → Email OTP flow
      setAuthOpen(true);
    }
  }

  function NavItems({ isMobile }: { isMobile?: boolean }) {
    const linkClass = (isActive: boolean) => cn(
      "text-sm font-bold transition-all duration-300 flex items-center gap-1.5 px-4 py-2 rounded-full",
      isActive 
        ? "text-slate-900 bg-slate-100 shadow-sm ring-1 ring-black/5" 
        : "text-slate-500 hover:text-black hover:bg-slate-50",
      isMobile ? "text-lg py-3 w-full justify-center" : ""
    );

    return (
      <div className={cn("flex items-center gap-1", isMobile && "flex-col w-full")}>
        {navLinks.map((link) => (
          <button
            key={link.route}
            onClick={() => {
              setRoute(link.route);
              setMobileMenuOpen(false);
            }}
            className={linkClass(route === link.route)}
          >
            {link.label}
          </button>
        ))}
        {user && (
          <>
            {user.role === "delivery" ? (
              <button
                onClick={() => { setRoute("delivery"); setMobileMenuOpen(false); }}
                className={linkClass(route === "delivery")}
              >
                🛵 My Deliveries
              </button>
            ) : (
              <>
                {enablePersonalizedSubscriptions.value && (
                  <button
                    onClick={() => {
                      setDashboardTab("personal");
                      setRoute("app");
                      setMobileMenuOpen(false);
                    }}
                    className={linkClass(route === "app")}
                  >
                    Plan Builder
                  </button>
                )}
                {hasActiveSubscription && (
                  <button
                    onClick={() => {
                      setDashboardTab("personal");
                      setRoute("dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className={linkClass(route === "dashboard")}
                  >
                    Dashboard
                    {unreadChefMessages > 0 && (
                      <span className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center shrink-0 ml-1.5 text-[10px]",
                        route === "dashboard" ? "bg-slate-900 text-white" : "bg-rose-500 text-white"
                      )}>
                        {unreadChefMessages}
                      </span>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setRoute("orders");
                    setMobileMenuOpen(false);
                  }}
                  className={linkClass(route === "orders")}
                >
                  My Orders
                </button>
                <button
                  onClick={() => {
                    setRoute("profile");
                    setMobileMenuOpen(false);
                  }}
                  className={linkClass(route === "profile")}
                >
                  Profile
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 left-0 right-0 z-50 px-4 md:px-8 pointer-events-none">
        <header className="mx-auto max-w-5xl pointer-events-auto">
          <div className="flex h-14 items-center justify-between px-4 rounded-3xl border border-white/40 bg-white/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03]">
            <button 
              className="group flex items-center gap-2 transition-all hover:opacity-80 active:scale-95 px-3 py-1.5 rounded-2xl" 
              onClick={() => setRoute("home")} 
              type="button"
            >
              <div className="font-black tracking-tighter text-xl bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500">
                TFB
              </div>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <NavItems />
              {!user && (
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full px-5 h-9 bg-slate-900 text-white hover:shadow-lg hover:shadow-slate-900/20 active:translate-y-0.5 transition-all"
                  onClick={handleAuthClick}
                >
                  Sign In
                </Button>
              )}
            </nav>

            {/* Mobile Menu Toggle */}
            <div className="flex md:hidden items-center gap-2">
              {!user && (
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full px-4 h-8 text-xs font-bold"
                  onClick={handleAuthClick}
                >
                  Sign In
                </Button>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-600 hover:text-black hover:bg-slate-100 transition-all"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </header>
      </div>

      <div className="h-20" /> {/* Spacer for fixed header */}

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-sm md:hidden"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-4 top-20 bottom-4 z-[70] w-[calc(100%-2rem)] max-w-xs rounded-3xl border border-white/40 bg-white/90 backdrop-blur-xl shadow-2xl md:hidden overflow-hidden"
            >
              <div className="flex h-14 items-center justify-between px-6 border-b border-black/[0.03]">
                <div className="font-black text-slate-400 text-sm tracking-widest uppercase">Navigation</div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:text-black transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex flex-col gap-2 p-4 overflow-y-auto max-h-[calc(100%-120px)]">
                <NavItems isMobile={true} />
              </nav>
              
              <div className="absolute bottom-6 left-6 right-6">
                {!user ? (
                  <Button
                    variant="primary"
                    className="w-full rounded-2xl h-12 shadow-lg shadow-slate-900/10"
                    onClick={() => {
                      handleAuthClick();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Sign In
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-12 border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 bg-white"
                    onClick={async () => {
                      if (window.confirm("Sign out?")) {
                        await supabase.auth.signOut();
                        setUser(null);
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    Sign Out
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

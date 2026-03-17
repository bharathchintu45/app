import React from "react";
import { useAppSetting } from "../../hooks/useAppSettings";
import type { AppUser, AuthIntent, DashboardTab, Route } from "../../types";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function TopNav({
  route,
  setRoute,
  user,
  setUser,
  setAuthOpen,
  setAuthIntent,
  unreadChefMessages = 0,
  hasActiveSubscription = false,
}: {
  route: Route;
  setRoute: (r: Route) => void;
  user: AppUser | null;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  dashboardTab: DashboardTab;
  setDashboardTab: (t: DashboardTab) => void;
  authOpen: boolean;
  setAuthOpen: (b: boolean) => void;
  authIntent: AuthIntent;
  setAuthIntent: (v: AuthIntent) => void;
  unreadChefMessages?: number;
  hasActiveSubscription?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const enablePersonalizedSubscriptions = useAppSetting("enable_personalized_subscriptions", true);

  const navLinks = [
    { label: "Home", route: "home" as Route },
  ];

  function handleAuthClick() {
    if (user) {
      if (window.confirm("Sign out?")) setUser(null);
    } else {
      setAuthIntent("regular");  // customers → Email OTP flow
      setAuthOpen(true);
    }
  }

  function NavItems({ isMobile }: { isMobile?: boolean }) {
    const linkClass = (isActive: boolean) => cn(
      "text-sm font-medium transition-colors hover:text-black flex items-center gap-1.5",
      isActive ? "text-black font-bold" : "text-slate-600",
      isMobile ? "text-lg py-2 w-full justify-center" : ""
    );

    return (
      <>
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
        {user ? (
          <div className={cn(
            "flex items-center gap-1", 
            (enablePersonalizedSubscriptions.value || true) && !isMobile ? "bg-slate-100/80 rounded-full p-1" : "flex-col md:flex-row gap-4 md:gap-8"
          )}>
            {enablePersonalizedSubscriptions.value && (
              <button
                onClick={() => {
                  setRoute("app");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  linkClass(route === "app"),
                  !isMobile && "px-3 py-1.5 rounded-full",
                  !isMobile && route === "app" && "bg-white shadow-sm"
                )}
              >
                Plan Builder
              </button>
            )}
            {hasActiveSubscription && (
              <button
                onClick={() => {
                  setRoute("dashboard");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  linkClass(route === "dashboard"),
                  !isMobile && "px-3 py-1.5 rounded-full font-bold",
                  (!isMobile && route === "dashboard") 
                    ? "bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                    : !isMobile ? "text-slate-600 hover:bg-slate-200" : ""
                )}
              >
                Dashboard
                {unreadChefMessages > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 ml-1.5">
                    {unreadChefMessages}
                  </span>
                )}
              </button>
            )}
            
            {!isMobile && (enablePersonalizedSubscriptions.value || true) && (
              <div className="w-px h-4 bg-slate-300 mx-2" />
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
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-2.5 transition-transform hover:scale-105 active:scale-95" onClick={() => setRoute("home")} type="button">
            <div className="rounded-xl bg-[#111] text-white px-4 py-1.5 font-bold tracking-wide text-sm shadow-sm">
              TFB
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <NavItems />
            <div className="h-4 w-px bg-slate-200" />
            {!user && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAuthClick}
              >
                Sign In
              </Button>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-4">
            {!user && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAuthClick}
              >
                Sign In
              </Button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-black transition-colors p-1"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

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
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-72 border-l border-slate-200 bg-white shadow-2xl md:hidden"
            >
              <div className="flex h-16 items-center justify-end px-4 border-b border-slate-100">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-600 hover:text-black transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <nav className="flex flex-col gap-4 p-6 overflow-y-auto">
                <NavItems isMobile={true} />
              </nav>
              
              <div className="absolute bottom-8 left-0 right-0 px-6">
                {!user ? (
                  <Button
                    variant="primary"
                    className="w-full"
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
                    className="w-full border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      if (window.confirm("Sign out?")) {
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

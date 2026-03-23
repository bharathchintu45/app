import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Route, AuthIntent, DashboardTab, GroupCart, GroupOrderDraft, HoldsMap, OrderReceipt, PlanMap, StartDateMap, TargetMap, ThreadMsg, Slot, MenuItem } from "./types";
import { subscriptionId, runDevTests } from "./data/menu";
import { getMenu } from "./hooks/useMenu";
import { supabase } from "./lib/supabase";
import { dayKey, addDays, parseDateKeyToDate, getTodayIndia } from "./lib/format";
import { useOrderNotifications } from "./hooks/useOrderNotifications";
import { useAppSetting, useAppSettingString } from "./hooks/useAppSettings";
import { useUser } from "./contexts/UserContext";

// Layout
import { TopNav } from "./components/layout/TopNav";
import { Button } from "./components/ui/Button";

// Simple Error Boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8 text-white">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-2xl font-bold text-rose-500">Something went wrong.</h1>
            <pre className="p-4 bg-slate-800 rounded-xl text-xs overflow-auto max-h-60 border border-slate-700">
              {this.state.error?.toString()}
            </pre>
            <Button onClick={() => window.location.reload()} className="w-full">Reload Application</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Pages (Lazy Loaded for performance)
const LandingPage = React.lazy(() => import("./pages/LandingPage").then(module => ({ default: module.LandingPage })));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const KitchenPage = React.lazy(() => import("./pages/KitchenPage").then(module => ({ default: module.KitchenPage })));
const AdminPage = React.lazy(() => import("./pages/AdminPage").then(module => ({ default: module.AdminPage })));
const CheckoutRegularPage = React.lazy(() => import("./pages/CheckoutPages").then(module => ({ default: module.CheckoutRegularPage })));
const CheckoutPersonalPage = React.lazy(() => import("./pages/CheckoutPages").then(module => ({ default: module.CheckoutPersonalPage })));
const CheckoutGroupPage = React.lazy(() => import("./pages/CheckoutPages").then(module => ({ default: module.CheckoutGroupPage })));
const OrderConfirmationPage = React.lazy(() => import("./pages/CheckoutPages").then(module => ({ default: module.OrderConfirmationPage })));
const UserSettingsPage = React.lazy(() => import("./pages/UserSettingsPage").then(module => ({ default: module.UserSettingsPage })));
const OrderTrackingPage = React.lazy(() => import("./pages/OrderTrackingPage").then(module => ({ default: module.OrderTrackingPage })));
const DeliveryPage = React.lazy(() => import("./pages/DeliveryPage").then(module => ({ default: module.DeliveryPage })));
const ManagerPage = React.lazy(() => import("./pages/ManagerPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage").then(module => ({ default: module.NotFoundPage })));
const PrivacyPolicyPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.PrivacyPolicyPage })));
const TermsPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.TermsPage })));
const RefundsPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.RefundsPage })));
const ShippingPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.ShippingPage })));
const AboutPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.AboutPage })));
const ContactPage = React.lazy(() => import("./pages/LegalPages").then(module => ({ default: module.ContactPage })));

// MaintenancePage remains eager as it is a fallback
import { MaintenancePage } from "./pages/MaintenancePage";

// Components
import { OfflineOverlay } from "./components/layout/OfflineOverlay";

// Auth
import { AuthModal } from "./components/auth/AuthModal";

// Optional: for development tests
// function runDevTests() { ... } // Assuming this can be removed or placed elsewhere.

export default function App() {
  const { user, setUser } = useUser();
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash.replace('#', '');
    const validRoutes: Route[] = ["home", "login", "checkout-regular", "checkout-personal", "checkout-group", "order-confirmation", "app", "dashboard", "admin", "manager", "kitchen", "delivery", "profile", "orders", "404", "about", "contact", "privacy", "terms", "refunds", "shipping"];
    if (hash && !validRoutes.includes(hash as Route)) return "404";
    return (hash as Route) || "home";
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("none");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("personal");
  const [subscription, setSubscription] = useState(() => {
    const saved = localStorage.getItem("tfb_subscription");
    return saved || subscriptionId("complete", 7);
  });
  const [regularCart, setRegularCart] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("tfb_regular_cart");
    return saved ? JSON.parse(saved) : {};
  });
  const [holds, setHolds] = useState<HoldsMap>(() => {
    const saved = localStorage.getItem("tfb_holds");
    return saved ? JSON.parse(saved) : {};
  });
  const [planMap, setPlanMap] = useState<PlanMap>(() => {
    const saved = localStorage.getItem("tfb_plan_map");
    return saved ? JSON.parse(saved) : {};
  });
  
  // Real DB state for Chef's Inbox
  const [chefThreads, setChefThreads] = useState<ThreadMsg[]>([]);
  const [unreadChefMessages, setUnreadChefMessages] = useState(0);

  const [groupCart, setGroupCart] = useState<GroupCart>(() => {
    const saved = localStorage.getItem("tfb_group_cart");
    return saved ? JSON.parse(saved) : {};
  });
  const [groupDraft, setGroupDraft] = useState<GroupOrderDraft>(() => {
    const saved = localStorage.getItem("tfb_group_draft");
    return saved ? JSON.parse(saved) : { people: 10, deliveryAt: "", notes: "" };
  });
  const [lastOrder, setLastOrder] = useState<OrderReceipt | null>(null);
  const [startDates, setStartDates] = useState<StartDateMap>(() => {
    const saved = localStorage.getItem("tfb_start_dates");
    return saved ? JSON.parse(saved) : {};
  });
  const [targetMap, setTargetMap] = useState<TargetMap>(() => {
    const saved = localStorage.getItem("tfb_target_map");
    return saved ? JSON.parse(saved) : {};
  });
  const [activeSubscription, setActiveSubscription] = useState<any>(() => {
    const saved = localStorage.getItem("tfb_active_subscription");
    return saved ? JSON.parse(saved) : null;
  });
  const [isSubLoading, setIsSubLoading] = useState(false);
  const [todayOrder, setTodayOrder] = useState<OrderReceipt | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Global Toast State
  const [toastMsg, setToastMsg] = useState("");

  // Helper to log route changes - memoized to prevent re-render loops in children
  const changeRoute = useCallback((newRoute: Route) => {
    // Basic validation
    const validRoutes: Route[] = ["home", "login", "checkout-regular", "checkout-personal", "checkout-group", "order-confirmation", "app", "dashboard", "admin", "manager", "kitchen", "delivery", "profile", "orders", "404", "about", "contact", "privacy", "terms", "refunds", "shipping"];
    if (!validRoutes.includes(newRoute)) {
      console.warn(`[App] Invalid route requested: ${newRoute}. Redirecting to 404.`);
      setRoute("404");
      return;
    }

    if (newRoute === route) return;
    
    console.log(`[App] Navigating: ${route} -> ${newRoute}`);
    setRoute(newRoute);
  }, [route]);

  const { value: isMaintenance } = useAppSetting("maintenance_mode", false);
  const { value: bypassEmailsStr } = useAppSettingString("maintenance_bypass_emails", "info@thefreshbox.in, admin@thefreshbox.in");
  const { value: isAdminPortalActive } = useAppSetting("admin_portal_active", true);
  const { value: isManagerPortalActive } = useAppSetting("manager_portal_active", true);
  
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'kitchen' || user.role === 'delivery') return true;
    
    // Parse dynamic bypass emails
    const bypassEmails = bypassEmailsStr
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
      
    return user.email && bypassEmails.includes(user.email.toLowerCase());
  }, [user, bypassEmailsStr]);

  const isFetchingRef = useRef(false);

  // Hook handles Realtime order updates + pushes
  useOrderNotifications(user, (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 5000);
  });

  const { value: chefNoteRaw } = useAppSettingString("chef_note", "Ready for your healthy meal journey?");
  const { value: chefNoteEnabled } = useAppSetting("chef_note_enabled", true);
  const chefNote = chefNoteEnabled ? chefNoteRaw : "";

  // Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Handle browser back button and scroll-to-top on navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (window.history.state !== route) {
      window.history.pushState(route, "", `#${route}`);
    }
  }, [route]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        changeRoute(e.state as Route);
      } else {
        const hash = window.location.hash.replace('#', '');
        changeRoute((hash as Route) || "home");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ✅ Centralized data fetcher for subscription/orders/messages
  useEffect(() => {
    if (!user) {
      setChefThreads([]);
      setActiveSubscription(null);
      setPlanMap({});
      setHolds({});
      setTodayOrder(null);
      return;
    }

    async function loadDashboardData() {
      if (isFetchingRef.current) return;
      try {
        isFetchingRef.current = true;
        setIsSubLoading(true);

        const todayStr = getTodayIndia();

        const [threadsRes, subRes, menuItems, ordersRes] = await Promise.all([
          supabase.from("chef_threads").select("*").eq("customer_id", user!.id).order("created_at", { ascending: true }),
          supabase.from("subscriptions").select("*").eq("user_id", user!.id).eq("status", "active").maybeSingle(),
          getMenu().catch(() => []),
          supabase.from("orders").select("*, order_items(*)").eq("user_id", user!.id).eq("delivery_date", todayStr).not("status", "in", '("cancelled", "delivered")').order("created_at", { ascending: false })
        ]);

        // Process Threads
        if (threadsRes.data) {
          setChefThreads(threadsRes.data.map((t: any) => ({
            id: t.id, by: t.sender_name, text: t.text,
            at: new Date(t.created_at).getTime(), sender_id: t.sender_id,
          })));
        }

        // Process Subscription
        const subData = subRes.data;
        if (subData) {
          setActiveSubscription(subData);
          const [swapsRes, holdsRes] = await Promise.all([
            supabase.from('subscription_swaps').select('*').eq('subscription_id', subData.id),
            supabase.from('subscription_holds').select('*').eq('subscription_id', subData.id)
          ]);

          const menuMap = new Map<string, MenuItem>();
          menuItems.forEach(m => menuMap.set(m.id, m));

          const newPlanMap: PlanMap = {};
          const scheduleLines = subData.schedule || [];
          const baseDate = subData.start_date ? parseDateKeyToDate(subData.start_date) : null;

          scheduleLines.forEach((line: any) => {
            let dKey: string;
            if (typeof line.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(line.day)) dKey = line.day;
            else if (typeof line.day === 'number' && baseDate) dKey = dayKey(addDays(baseDate, line.day - 1));
            else return;

            if (!newPlanMap[dKey]) newPlanMap[dKey] = {};
            const item = menuMap.get(line.itemId);
            if (item) newPlanMap[dKey][line.slot as Slot] = item;
          });

          (swapsRes.data || []).forEach((s: any) => {
            if (!newPlanMap[s.date]) newPlanMap[s.date] = {};
            const item = menuMap.get(s.menu_item_id);
            if (item) newPlanMap[s.date][s.slot as Slot] = item;
          });

          const newHoldsMap: HoldsMap = {};
          (holdsRes.data || []).forEach((h: any) => {
            newHoldsMap[h.hold_date] = { day: h.is_full_day, slots: h.slots || {} };
          });

          setPlanMap(newPlanMap);
          setHolds(newHoldsMap);
        }

        // Process Today's Order
        if (ordersRes.data?.length) {
          const menuMap = new Map<string, MenuItem>();
          menuItems.forEach(m => menuMap.set(m.id, m));
          // (Simplified mapping logic for brevity, keeping existing behavior)
          const mappedOrders = ordersRes.data.map((tod: any): OrderReceipt => {
            const firstItem = tod.order_items?.[0];
            const image = firstItem ? menuMap.get(firstItem.menu_item_id)?.image : undefined;
            return {
              id: tod.id, userId: tod.user_id, orderNumber: tod.order_number,
              kind: tod.kind as any, createdAt: new Date(tod.created_at).getTime(),
              status: tod.status as any, headline: "Order", deliveryAtLabel: tod.delivery_date, customer: tod.delivery_details, payment: tod.payment_status, image,
              lines: (tod.order_items || []).map((dbItem: any) => ({
                itemId: dbItem.menu_item_id, label: dbItem.item_name || "Item",
                qty: dbItem.quantity, unitPriceAtOrder: dbItem.unit_price
              }))
            };
          });
          setTodayOrder(mappedOrders[0]);
        }
      } catch (err) {
        console.error("[App] Data fetch error:", err);
      } finally {
        isFetchingRef.current = false;
        setIsSubLoading(false);
      }
    }

    loadDashboardData();

    // Listen for Realtime Chats
    const channel = supabase
      .channel('public:chef_threads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chef_threads' }, payload => {
        const newRow = payload.new;
        if (newRow.customer_id === user!.id) {
          if (newRow.sender_id !== newRow.customer_id) setUnreadChefMessages(prev => prev + 1);
          setChefThreads(prev => [...prev, {
            id: newRow.id, by: newRow.sender_name, text: newRow.text,
            at: new Date(newRow.created_at).getTime(), sender_id: newRow.sender_id
          }]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ✅ Optimized Centralized Storage Sync
  useEffect(() => {
    const syncMap = {
      tfb_subscription: subscription,
      tfb_regular_cart: JSON.stringify(regularCart),
      tfb_holds: JSON.stringify(holds),
      tfb_plan_map: JSON.stringify(planMap),
      tfb_group_cart: JSON.stringify(groupCart),
      tfb_group_draft: JSON.stringify(groupDraft),
      tfb_start_dates: JSON.stringify(startDates),
      tfb_target_map: JSON.stringify(targetMap),
    };

    Object.entries(syncMap).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    if (activeSubscription) {
      localStorage.setItem("tfb_active_subscription", JSON.stringify(activeSubscription));
    } else {
      localStorage.removeItem("tfb_active_subscription");
    }
  }, [
    subscription, regularCart, holds, planMap, 
    groupCart, groupDraft, startDates, targetMap, activeSubscription
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  }, []);

  // Checkout Route Guard: Prevents accessing checkout with empty cart
  useEffect(() => {
    if (route === "checkout-regular" && (!regularCart || Object.keys(regularCart).length === 0)) {
      showToast("Your regular order cart is empty.");
      changeRoute("home");
    } else if (route === "checkout-personal") {
      // Allow personalized checkout even with 0 initial meals as per user request
    } else if (route === "checkout-group") {
      const hasItems = Object.values(groupCart).some(qty => qty > 0);
      if (!hasItems) {
        showToast("Please add at least one item to your group order cart before checking out.");
        changeRoute("app");
      }
    }
  }, [route, regularCart, planMap, groupCart, subscription, startDates, holds, showToast, changeRoute]);

  // Handle route-specific side effects
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (window.history.state !== route) {
      window.history.pushState(route, "", `#${route}`);
    }
  }, [route]);

  // Realtime subscription updates — watches the dedicated subscriptions table
  useEffect(() => {
    if (!user || user.role !== "customer") return;

    async function recheckSubscription() {
      const { data: subData } = await supabase
        .from("subscriptions")      // dedicated subscriptions table
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")     // single clean filter
        .maybeSingle();

      if (subData) {
        setActiveSubscription(subData);
      } else {
        setActiveSubscription((prev: any) => {
          if (prev) {
            setPlanMap({});
            setHolds({});
            localStorage.removeItem("tfb_plan_map");
            localStorage.removeItem("tfb_holds");
          }
          return null;
        });
      }
    }

    // Listen for any change to this user's subscriptions (INSERT, UPDATE, DELETE)
    const channelName = `subscription-updates-${user.id}`;
    const subChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",   // watch subscriptions table
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          console.log("[App] Subscription change detected — re-checking...");
          await recheckSubscription();
        }
      )
      .subscribe();

    // Safety net: poll every 30s in case realtime event is missed
    const pollInterval = setInterval(recheckSubscription, 30_000);

    return () => {
      supabase.removeChannel(subChannel);
      clearInterval(pollInterval);
    };
  }, [user]);

  // Portal and Access Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get("portal");

    // Unified portal redirect logic — only triggers if user is on home or specifically trying to access a portal
    if (portal === "admin" && route === "home") {
      if (!user) {
        setAuthIntent("admin");
        setAuthOpen(true);
      } else if (user.role === "admin") {
        changeRoute("admin");
      }
    } else if (portal === "kitchen" && route === "home") {
      if (!user) {
        setAuthIntent("kitchen");
        setAuthOpen(true);
      } else if (user.role === "kitchen" || user.role === "admin") {
        changeRoute("kitchen");
      }
    } else if (portal === "manager" && route === "home") {
      if (!user) {
        setAuthIntent("manager");
        setAuthOpen(true);
      } else if (user.role === "manager" || user.role === "admin") {
        changeRoute("manager");
      }
    } else if (portal === "delivery" && route === "home") {
      if (!user) {
        setAuthIntent("delivery");
        setAuthOpen(true);
      } else if (user.role === "delivery" || user.role === "admin") {
        changeRoute("delivery");
      }
    }

    // Checkout protection — ONLY for checkout routes
    const isCheckout = route === "checkout-regular" || route === "checkout-personal" || route === "checkout-group";
    if (!user && isCheckout) {
      console.log("[App] Unauthorized checkout access, redirecting to home.");
      changeRoute("home");
      setAuthIntent("regular");
      setAuthOpen(true);
    }
  }, [route, user]);

  // Developer logic validation
  useEffect(() => {
    // Standard check that works in most build environments without lint errors
    const isDev = window.location.hostname === "localhost" || (window as any).process?.env?.NODE_ENV === "development";
    if (isDev) {
      runDevTests();
    }
  }, []);

  // -------------------------------------------------------------
  // SEND MESSAGE HANDLER
  // -------------------------------------------------------------
  async function handleSendMessage(text: string) {
    if (!user || !text.trim()) return;
    
    // For DashboardPage, the customer sends to themselves
    const customer_id = user.id;

    const { error } = await supabase.from('chef_threads').insert({
      customer_id: customer_id,
      sender_id: user.id,
      sender_name: user.name.split(' ')[0] || user.name || "Customer",
      text: text.trim()
    });

    if (error) {
      console.error("[App] Failed to send message:", error);
      setToastMsg("Failed to send message. Please try again.");
    }
  }

  return (
    <ErrorBoundary>
      <React.Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6">
            <div className="w-32 h-6 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full mt-4">
            <div className="w-2/3 max-w-md h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="w-1/2 max-w-sm h-6 bg-slate-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="h-48 bg-slate-200 rounded-3xl animate-pulse" />
              <div className="h-48 bg-slate-200 rounded-3xl animate-pulse shadow-sm" />
              <div className="h-48 bg-slate-200 rounded-3xl animate-pulse" />
            </div>
          </div>
        </div>
      }>
        <div className="min-h-screen bg-white">
          {isMaintenance && !isAuthorized ? (
            <MaintenancePage />
          ) : (
            <>
            <TopNav
              route={route}
              setRoute={changeRoute}
              user={user}
              setUser={setUser}
              authOpen={authOpen}
              setAuthOpen={setAuthOpen}
              authIntent={authIntent}
              setAuthIntent={setAuthIntent}
              unreadChefMessages={unreadChefMessages}
              hasActiveSubscription={!!activeSubscription || !!(user?.isPro)}
              dashboardTab={dashboardTab}
              setDashboardTab={setDashboardTab}
            />

            <main className="flex-1 overflow-x-hidden pt-4 pb-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={route}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full"
                >
                  {route === "kitchen" ? (
                    <KitchenPage user={user} onBack={() => changeRoute("home")} showToast={showToast} />
                  ) : route === "admin" ? (
                    isAdminPortalActive ? (
                      <AdminPage user={user} onBack={() => changeRoute("home")} showToast={showToast} />
                    ) : (
                      <MaintenancePage title="Admin Portal Disabled" message="Access to the Administrative Console has been restricted by the system owner." />
                    )
                  ) : route === "checkout-regular" ? (
                    <CheckoutRegularPage 
                      user={user} 
                      setUser={setUser} 
                      regularCart={regularCart} 
                      setRegularCart={setRegularCart} 
                      setRoute={setRoute} 
                      setLastOrder={setLastOrder} 
                      showToast={showToast}
                    />
                  ) : route === "checkout-personal" ? (
                    <CheckoutPersonalPage 
                      user={user} 
                      setUser={setUser} 
                      subscription={subscription} 
                      planMap={planMap} 
                      setPlanMap={setPlanMap}
                      holds={holds} 
                      setHolds={setHolds}
                      setRoute={setRoute} 
                      setLastOrder={setLastOrder} 
                      startDates={startDates} 
                      setStartDates={setStartDates}
                      targetMap={targetMap} 
                      setTargetMap={setTargetMap}
                      showToast={showToast}
                    />
                  ) : route === "checkout-group" ? (
                    <CheckoutGroupPage 
                      user={user} 
                      setUser={setUser} 
                      groupCart={groupCart} 
                      setGroupCart={setGroupCart}
                      groupDraft={groupDraft} 
                      setGroupDraft={setGroupDraft}
                      setRoute={setRoute} 
                      setLastOrder={setLastOrder} 
                      showToast={showToast}
                    />
                  ) : route === "order-confirmation" ? (
                    <OrderConfirmationPage
                      lastOrder={lastOrder}
                      onGoHome={() => changeRoute("home")}
                      onGoDashboard={() => { setDashboardTab("personal"); changeRoute("app"); }}
                      onModify={(kind) => {
                        if (kind === "group") { setDashboardTab("group"); changeRoute("app"); }
                        else if (kind === "personalized") { setDashboardTab("personal"); changeRoute("app"); }
                        else { changeRoute("home"); setTimeout(() => { const el = document.getElementById("regular-orders"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }
                      }}
                    />
                  ) : route === "app" || route === "dashboard" ? (
                    <DashboardPage
                      user={user}
                      activeSubscription={activeSubscription}
                      isSubLoading={isSubLoading}
                      todayOrder={todayOrder}
                      subscription={subscription}
                      setSubscription={setSubscription}
                      dashboardTab={dashboardTab}
                      viewMode={route === "dashboard" ? "tracking" : "planner"}
                      holds={holds}
                      setHolds={setHolds}
                      chefNote={chefNote}
                      planMap={planMap}
                      setPlanMap={setPlanMap}
                      thread={chefThreads}
                      sendMessage={handleSendMessage}
                      setRoute={changeRoute}
                      groupCart={groupCart}
                      setGroupCart={setGroupCart}
                      groupDraft={groupDraft}
                      setGroupDraft={setGroupDraft}
                      startDates={startDates}
                      setStartDates={setStartDates}
                      targetMap={targetMap}
                      setTargetMap={setTargetMap}
                      clearUnread={() => setUnreadChefMessages(0)}
                      showToast={showToast}
                    />
                  ) : route === "profile" ? (
                    <ErrorBoundary>
                    <UserSettingsPage 
                      user={user} 
                      setUser={setUser} 
                      setRoute={changeRoute} 
                      setRegularCart={setRegularCart}
                      showToast={showToast}
                    />
                    </ErrorBoundary>
                  ) : route === "orders" ? (
                    <OrderTrackingPage user={user} setRoute={changeRoute} showToast={showToast} />
                  ) : route === "delivery" ? (
                    <ErrorBoundary>
                    <DeliveryPage user={user} onBack={() => changeRoute("home")} showToast={showToast} />
                    </ErrorBoundary>
                  ) : route === "manager" ? (
                    isManagerPortalActive ? (
                      <ErrorBoundary>
                      <ManagerPage user={user} onBack={() => changeRoute("home")} showToast={showToast} />
                      </ErrorBoundary>
                    ) : (
                      <MaintenancePage title="Manager Portal Disabled" message="The Operations Hub is currently offline. Please contact an administrator if this is unexpected." />
                    )
                  ) : route === "about" ? (
                    <AboutPage onBack={() => changeRoute("home")} />
                  ) : route === "contact" ? (
                    <ContactPage onBack={() => changeRoute("home")} />
                  ) : route === "privacy" ? (
                    <PrivacyPolicyPage onBack={() => changeRoute("home")} />
                  ) : route === "terms" ? (
                    <TermsPage onBack={() => changeRoute("home")} />
                  ) : route === "refunds" ? (
                    <RefundsPage onBack={() => changeRoute("home")} />
                  ) : route === "shipping" ? (
                    <ShippingPage onBack={() => changeRoute("home")} />
                  ) : route === "404" ? (
                    <NotFoundPage onBack={() => changeRoute("home")} />
                  ) : route === "home" ? (
                    <LandingPage
                      user={user}
                      setRoute={changeRoute}
                      subscription={subscription}
                      setSubscription={setSubscription}
                      setAuthOpen={setAuthOpen}
                      setAuthIntent={setAuthIntent}
                      regularCart={regularCart}
                      setRegularCart={setRegularCart}
                      setDashboardTab={setDashboardTab}
                      showToast={showToast}
                      activeSubscription={activeSubscription}
                    />
                  ) : (
                    <NotFoundPage onBack={() => changeRoute("home")} />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </>
        )}

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        user={user}
        setUser={setUser}
        intent={authIntent}
      />

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] rounded-2xl bg-slate-900 border border-slate-700 text-white px-5 py-3 shadow-2xl shadow-slate-900/40 font-medium text-sm sm:min-w-[300px] text-center"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <OfflineOverlay isOffline={isOffline} />
          </div>
      </React.Suspense>
    </ErrorBoundary>
  );
}

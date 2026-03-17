import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppUser, Route, AuthIntent, DashboardTab, GroupCart, GroupOrderDraft, HoldsMap, OrderReceipt, PlanMap, StartDateMap, TargetMap, ThreadMsg, UserRole, MenuItem, Slot } from "./types";
import { subscriptionId, runDevTests } from "./data/menu";
import { supabase } from "./lib/supabase";
import { dayKey, addDays, parseDateKeyToDate } from "./lib/format";
import { useOrderNotifications, requestNotificationPermission } from "./hooks/useOrderNotifications";
import { useAppSetting, useAppSettingString } from "./hooks/useAppSettings";

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

// Pages
import { LandingPage } from "./pages/LandingPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { DashboardPage } from "./pages/DashboardPage";
import { KitchenPage } from "./pages/KitchenPage";
import { AdminPage } from "./pages/AdminPage";
import { CheckoutRegularPage, CheckoutPersonalPage, CheckoutGroupPage, OrderConfirmationPage } from "./pages/CheckoutPages";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { OrderTrackingPage } from "./pages/OrderTrackingPage";

// Auth
import { AuthModal } from "./components/auth/AuthModal";

// Optional: for development tests
// function runDevTests() { ... } // Assuming this can be removed or placed elsewhere.

export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash.replace('#', '');
    return (hash as Route) || "home";
  });
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem("tfb_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("[App] Failed to parse user from localStorage", e);
      return null;
    }
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
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [isSubLoading, setIsSubLoading] = useState(false);
  const [todayOrder, setTodayOrder] = useState<OrderReceipt | null>(null);
  
  // Global Toast State
  const [toastMsg, setToastMsg] = useState("");

  // Guard to prevent infinite profile fetch loops
  const lastFetchRef = useRef<{ id: string; time: number } | null>(null);
  const { value: isMaintenance } = useAppSetting("maintenance_mode", false);
  const { value: bypassEmailsStr } = useAppSettingString("maintenance_bypass_emails", "info@thefreshbox.in, admin@thefreshbox.in");
  
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'kitchen') return true;
    
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

  useEffect(() => {
    if (user) {
      localStorage.setItem("tfb_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("tfb_user");
    }
  }, [user]);

  // A robust, decoupled function to fetch the profile and build the AppUser
  async function fetchUserProfile(sessionUser: any) {
    if (!sessionUser?.id) return;
    
    // Guard against rapid re-fetching for the same user
    const now = Date.now();
    if (lastFetchRef.current?.id === sessionUser.id && (now - (lastFetchRef.current?.time || 0) < 5000)) {
      console.log("[App] Skipping redundant profile fetch (throttled)");
      return;
    }
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsSubLoading(true);
      console.log("[App] Fetching profile for authenticated user:", sessionUser.id);
      lastFetchRef.current = { id: sessionUser.id, time: now };
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionUser.id)
        .single();

      if (error) {
        console.error("[App] Profile fetch error:", error);
        return;
      }

      if (profile) {
        console.log("[App] Profile loaded into App state:", profile);
        const loggedInUser: AppUser = {
          id: profile.id,
          name: profile.full_name || "Valued Customer",
          phone: profile.phone_number || "",
          email: sessionUser.email || "",
          role: (profile.role as UserRole) || "customer",
          isPro: profile.is_pro || false,
          defaultDelivery: profile.default_delivery || undefined,
          savedAddresses: Array.isArray(profile.saved_addresses) ? profile.saved_addresses : [],
        };
        setUser(loggedInUser);
        
        // Ask for push notification permission once logged in
        requestNotificationPermission();

        if (loggedInUser.role === "customer") {
          const { data: threadsData, error: threadsErr } = await supabase
            .from("chef_threads")
            .select("*")
            .eq("customer_id", loggedInUser.id)
            .order("created_at", { ascending: true });
          
          if (!threadsErr && threadsData) {
            setChefThreads(
              threadsData.map((t: any) => ({
                id: t.id,
                by: t.sender_name,
                text: t.text,
                at: new Date(t.created_at).getTime(),
                sender_id: t.sender_id,
              }))
            );
          }

          // ── Fetch active subscription from the dedicated subscriptions table ──
          console.log("[App] Fetching subscription for user:", loggedInUser.id);
          const { data: subData, error: subErr } = await supabase
            .from("subscriptions")        // dedicated subscriptions table
            .select("*")
            .eq("user_id", loggedInUser.id)
            .eq("status", "active")       // single clean filter — no exclusion lists
            .maybeSingle();               // at most 1 active subscription per user

          if (subErr) console.error("[App] Subscription fetch error:", subErr);

          if (subData) {
            console.log("[App] Active subscription found:", subData.id, subData.plan_name);
            setActiveSubscription(subData);
          } else {
            console.warn("[App] No active subscription found — clearing state & cache.");
            setActiveSubscription(null);
            setPlanMap({});
            setHolds({});
            localStorage.removeItem("tfb_plan_map");
            localStorage.removeItem("tfb_holds");
          }

          // ── Fetch todayOrder(s) — Independent of subscription ──
          const todayDt = new Date();
          todayDt.setHours(todayDt.getHours() + 5);
          todayDt.setMinutes(todayDt.getMinutes() + 30);
          const todayStr = todayDt.toISOString().slice(0, 10);

          const { data: todayOrdersData } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("user_id", loggedInUser.id)
            .eq("delivery_date", todayStr)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false });

          if (todayOrdersData && todayOrdersData.length > 0) {
            const nowHour = new Date().getHours();
            let currentSlot = "Any";
            if (nowHour >= 4 && nowHour < 8) currentSlot = "Breakfast";
            else if (nowHour >= 11 && nowHour < 13) currentSlot = "Lunch";
            else if (nowHour >= 17 && nowHour < 20) currentSlot = "Dinner";

            const { data: menuData } = await supabase.from('menu_items').select('*');
            const menuImages: Record<string, string> = {};
            (menuData || []).forEach(m => { if (m.image_url) menuImages[m.id] = m.image_url; });

            const mappedTodayOrders = todayOrdersData.map((tod: any): OrderReceipt => {
              const firstDbItem = tod.order_items?.[0];
              const image = firstDbItem ? menuImages[firstDbItem.menu_item_id] : undefined;
              return {
                id: tod.id, userId: tod.user_id, orderNumber: tod.order_number,
                kind: tod.kind as any, createdAt: new Date(tod.created_at).getTime(),
                status: (
                  tod.status === 'pending' ? 'New' : tod.status === 'preparing' ? 'Preparing' :
                  tod.status === 'ready' ? 'Ready' : tod.status === 'out_for_delivery' ? 'Out for delivery' :
                  tod.status === 'delivered' ? 'Delivered' : 'New'
                ) as any,
                headline: "Order",
                deliveryAtLabel: tod.delivery_date,
                customer: tod.delivery_details, payment: tod.payment_status,
                image,
                lines: (tod.order_items || []).map((dbItem: any) => ({
                  itemId: dbItem.menu_item_id, label: dbItem.item_name || "Item",
                  qty: dbItem.quantity, unitPriceAtOrder: dbItem.unit_price
                }))
              };
            });

            let bestMatch = mappedTodayOrders.find(o =>
              (o.kind === 'personalized' || o.kind === 'subscription') &&
              o.lines.some(l => l.label.includes(`[${currentSlot}]`))
            ) || mappedTodayOrders.find(o => o.kind === 'personalized' || o.kind === 'subscription')
              || mappedTodayOrders[0];

            if (bestMatch) setTodayOrder(bestMatch);
          }

          // ── Build planMap from subscription schedule ──
          if (subData) {
            const { data: menuData } = await supabase.from('menu_items').select('*');
            const menuItems: MenuItem[] = (menuData || []).map(m => ({
              id: m.id, category: m.category as any, name: m.name,
              description: m.description, image: m.image_url,
              calories: m.calories, protein: m.protein, carbs: m.carbs,
              fat: m.fat, fiber: m.fiber, priceINR: m.price_inr, available: m.available
            }));

            // Fetch swaps & holds
            const { data: swapsData } = await supabase
              .from('subscription_swaps').select('*').eq('subscription_id', subData.id);
            const { data: holdsData } = await supabase
              .from('subscription_holds').select('*').eq('subscription_id', subData.id);

            const newPlanMap: PlanMap = {};

            // Build from schedule (new subscriptions table format: schedule is JSONB array)
            // Also support legacy meta.scheduleLines for backwards compat
            const scheduleLines: any[] = subData.schedule?.length
              ? subData.schedule
              : (subData.meta?.scheduleLines || []);

            const baseDate = subData.start_date
              ? parseDateKeyToDate(subData.start_date)
              : subData.delivery_date ? parseDateKeyToDate(subData.delivery_date) : null;

            scheduleLines.forEach(line => {
              let targetDateKey: string;
              if (typeof line.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(line.day)) {
                targetDateKey = line.day;
              } else if (typeof line.day === 'number' && baseDate) {
                targetDateKey = dayKey(addDays(baseDate, line.day - 1));
              } else { return; }

              if (!newPlanMap[targetDateKey]) newPlanMap[targetDateKey] = {};
              const item = menuItems.find(m => m.id === line.itemId);
              if (item) newPlanMap[targetDateKey][line.slot as Slot] = item;
              else if (line.label) {
                newPlanMap[targetDateKey][line.slot as Slot] = {
                  id: line.itemId, name: line.label,
                  calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                  category: "Lunch", priceINR: line.unitPriceAtOrder || 0
                } as any;
              }
            });

            // Overlay swaps
            (swapsData || []).forEach(s => {
              if (!newPlanMap[s.date]) newPlanMap[s.date] = {};
              const item = menuItems.find(m => m.id === s.menu_item_id);
              if (item) newPlanMap[s.date][s.slot as Slot] = item;
            });

            // Build holds map
            const newHoldsMap: HoldsMap = {};
            (holdsData || []).forEach(h => {
              newHoldsMap[h.hold_date] = { day: h.is_full_day, slots: h.slots || {} };
            });

            setPlanMap(newPlanMap);
            setHolds(newHoldsMap);
          }
        }

        // Optional: Redirect based on portal param + role 
        const params = new URLSearchParams(window.location.search);
        const portal = params.get("portal");
        if (portal === "admin" && loggedInUser.role === "admin") {
          changeRoute("admin");
        } else if (portal === "kitchen" && (loggedInUser.role === "kitchen" || loggedInUser.role === "admin")) {
          changeRoute("kitchen");
        }
      }
    } catch (err) {
      console.error("[App] Exception fetching profile:", err);
    } finally {
      isFetchingRef.current = false;
      setIsSubLoading(false);
    }
  }

  // Helper to log route changes - memoized to prevent re-render loops in children
  const changeRoute = useCallback((newRoute: Route) => {
    if (newRoute === route) return;
    
    console.log(`[App] Navigating: ${route} -> ${newRoute}`);
    if (newRoute === "home" && route !== "home") {
      console.trace("[App] changeRoute(home) trace");
    }
    setRoute(newRoute);
  }, [route]);

  // ✅ Listen for Supabase auth events (OTP verify, token refresh, etc.)
  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[App] Global Auth Event:", event, !!session?.user);
      
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
         fetchUserProfile(session.user);
      } else if (event === "SIGNED_OUT") {
        console.log("[App] User signed out, clearing state.");
        setUser(null);
        setChefThreads([]);
        setActiveSubscription(null);
      }
    });

    const channel = supabase
      .channel('public:chef_threads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chef_threads' }, payload => {
        const newRow = payload.new;
        if (newRow.sender_id !== newRow.customer_id) {
           setUnreadChefMessages(prev => prev + 1);
        }
        setChefThreads(prev => {
          if (prev.some(p => p.id === newRow.id)) return prev;
          return [...prev, {
            id: newRow.id,
            by: newRow.sender_name,
            text: newRow.text,
            at: new Date(newRow.created_at).getTime(),
            sender_id: newRow.sender_id,
          }];
        });
      })
      .subscribe();

    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync state to local storage
  useEffect(() => {
    if (user) localStorage.setItem("tfb_user", JSON.stringify(user));
    else localStorage.removeItem("tfb_user");
  }, [user]);

  useEffect(() => {
    localStorage.setItem("tfb_subscription", subscription);
  }, [subscription]);

  useEffect(() => {
    localStorage.setItem("tfb_regular_cart", JSON.stringify(regularCart));
  }, [regularCart]);

  useEffect(() => {
    localStorage.setItem("tfb_holds", JSON.stringify(holds));
  }, [holds]);

  useEffect(() => {
    localStorage.setItem("tfb_plan_map", JSON.stringify(planMap));
  }, [planMap]);

  useEffect(() => {
    localStorage.setItem("tfb_group_cart", JSON.stringify(groupCart));
  }, [groupCart]);

  useEffect(() => {
    localStorage.setItem("tfb_group_draft", JSON.stringify(groupDraft));
  }, [groupDraft]);

  useEffect(() => {
    localStorage.setItem("tfb_start_dates", JSON.stringify(startDates));
  }, [startDates]);

  useEffect(() => {
    localStorage.setItem("tfb_target_map", JSON.stringify(targetMap));
  }, [targetMap]);

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
        setActiveSubscription(null);
        setPlanMap({});
        setHolds({});
        localStorage.removeItem("tfb_plan_map");
        localStorage.removeItem("tfb_holds");
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
    <div className="min-h-screen bg-white">
      <ErrorBoundary>
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
                    <AdminPage user={user} onBack={() => changeRoute("home")} showToast={showToast} />
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
                      onGoDashboard={() => changeRoute("app")}
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
                    <OrderTrackingPage user={user} setRoute={changeRoute} />
                  ) : (
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
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </>
        )}
      </ErrorBoundary>

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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900 border border-slate-700 text-white px-5 py-3 shadow-2xl shadow-slate-900/40 font-medium text-sm sm:min-w-[300px] text-center"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, User, Mail, Phone,
  ShieldCheck, ArrowRight, ChefHat, Lock
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import type { AppUser, AuthIntent, UserRole } from "../../types";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "email" | "otp" | "profile" | "success";

// ─── Constants ────────────────────────────────────────────────────────────────
const PORTAL_CONFIG: Record<string, { title: string; subtitle: string; icon: any; requiredRoles: UserRole[] }> = {
  admin: {
    title: "Admin Portal",
    subtitle: "Sign in to access the Command Center.",
    icon: ShieldCheck,
    requiredRoles: ["admin"],
  },
  kitchen: {
    title: "Kitchen Portal",
    subtitle: "Sign in to access the Kitchen Dashboard.",
    icon: ChefHat,
    requiredRoles: ["kitchen", "admin"],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AuthModal({
  isOpen,
  onClose,
  user,
  setUser,
  intent,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  intent: AuthIntent;
}) {
  // Determine mode
  const isPortal = intent === "admin" || intent === "kitchen";

  const portalCfg = isPortal ? PORTAL_CONFIG[intent] : null;
  const PortalIcon = portalCfg?.icon ?? ShieldCheck;

  // ── State ─────────────────────────────────────────────────────────────────
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [authMethod,  setAuthMethod]  = useState<"email" | "phone">("email");
  const [password,    setPassword]    = useState("");
  const [name,        setName]        = useState("");
  const [step,        setStep]        = useState<Step>("email");
  const [successMsg,  setSuccessMsg]  = useState("");
  const [loading,     setLoading]     = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");

  // OTP
  const [otp,          setOtp]           = useState(["", "", "", "", "", ""]);
  const [resendTimer,  setResendTimer]   = useState(0);
  const otpRefs   = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const emailRef  = useRef<HTMLInputElement | null>(null);

  // Auto-focus email field after modal animation (150ms delay)
  useEffect(() => {
    if (isOpen && step === "email") {
      const t = setTimeout(() => emailRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen, step]);

  // Handle global sign-in via App.tsx 
  // (Since App.tsx is now cleanly listening without SDK deadlocks)
  useEffect(() => {
    if (isOpen && user && step !== "success" && step !== "profile") {
      setSuccessMsg(`Welcome, ${user.name}!`);
      setStep("success");
      setLoading(false);
      const t = setTimeout(onClose, 1500);
      return () => clearTimeout(t);
    }
  }, [isOpen, user, step, onClose]);

  // Reset on close / intent change
  useEffect(() => {
    if (!isOpen) {
      setStep("email");
      setEmail("");
      setName("");
      setErrorMsg("");
      setOtp(["", "", "", "", "", ""]);
      setResendTimer(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [isOpen]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function startCooldown(s = 60) {
    setResendTimer(s);
    timerRef.current = setInterval(() => {
      setResendTimer(v => {
        if (v <= 1) { clearInterval(timerRef.current!); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  // ── Admin/Kitchen Portal Auth Flow (Email + Password) ─────────────────────
  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!email.includes("@")) return setErrorMsg("Please enter a valid email address.");
    if (!password) return setErrorMsg("Please enter your password.");

    setLoading(true);
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !authData.user) {
      setLoading(false);
      return setErrorMsg(signInError?.message || "Invalid email or password.");
    }

    await checkAndResolveProfile(authData.user.id, authData.user.email ?? email);
  }

  // ── Standard Supabase Auth Flow ───────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!email.includes("@")) return setErrorMsg("Please enter a valid email address.");
    
    // Testing bypass
    if (email === "test2@example.com") {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: "testpassword1" });
      if (!error && data.user) {
        await checkAndResolveProfile(data.user.id, data.user.email ?? email);
      } else {
        setLoading(false);
        setErrorMsg("Test login failed: " + error?.message);
      }
      return;
    }

    setLoading(true);
    
    const params: any = {
      options: { shouldCreateUser: true },
    };

    if (authMethod === "email") {
      if (!email.includes("@")) {
        setLoading(false);
        return setErrorMsg("Please enter a valid email address.");
      }
      params.email = email;
    } else {
      if (phone.length < 10) {
        setLoading(false);
        return setErrorMsg("Please enter a valid 10-digit phone number.");
      }
      params.phone = `+91${phone}`;
    }

    const { error } = await supabase.auth.signInWithOtp(params);
    setLoading(false);
    
    if (error) {
      if (error.message.toLowerCase().includes("sending") || error.message.toLowerCase().includes("smtp")) {
         return setErrorMsg("Could not send OTP. Please wait 60 seconds or try again.");
      }
      return setErrorMsg(error.message);
    }
    
    startCooldown();
    setStep("otp");
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const token = otp.join("");
    if (token.length < 6) return setErrorMsg("Please enter all 6 digits.");
    
    setErrorMsg("");
    setLoading(true);

    const verifyParams: any = {
      token,
      type: authMethod === "email" ? "email" : "sms",
    };
    if (authMethod === "email") verifyParams.email = email;
    else verifyParams.phone = `+91${phone}`;

    // Standard Native Call
    const { data: authData, error: verifyError } = await supabase.auth.verifyOtp(verifyParams);

    if (verifyError || !authData.user) {
      setLoading(false);
      return setErrorMsg(verifyError?.message || "Invalid or expired code.");
    }

    // Success! We must now ensure they have a profile explicitly.
    await checkAndResolveProfile(authData.user.id, authData.user.email ?? email, authData.user.phone ?? `+91${phone}`);
  }


  // Common Profile Resolution for Both Flows
  async function checkAndResolveProfile(userId: string, userEmail: string, userPhone: string = "") {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
         // The global trigger probably hasn't run yet or failed in edge cases.
         console.warn("[AuthModal] Explicit Profile missing. Trigger should have handled this.");
      }

      // Enforce portal roles
      if (isPortal && profile) {
        const allowed = portalCfg!.requiredRoles as string[];
        if (!allowed.includes(profile.role)) {
          setErrorMsg("Access denied. Your account does not have the required permissions.");
          setLoading(false);
          await supabase.auth.signOut();
          if (!isPortal) setStep("email");
          return;
        }
      }

      // If name is blank or profile genuinely didn't get inserted by the trigger:
      if (!profile || !profile.full_name) {
        setLoading(false);
        setStep("profile"); // Route them to explicit setup
        return;
      }

      // The global `App.tsx` listener will catch the SIGNED_IN event and close this modal automatically.
      // But we can eagerly update state here as a fallback.
      const u: AppUser = {
        id: profile.id,
        name: profile.full_name,
        phone: profile.phone_number || userPhone || "",
        email: userEmail,
        role: (profile.role as UserRole) || "customer",
        isPro: profile.is_pro || false,
        defaultDelivery: profile.default_delivery || undefined,
        savedAddresses: profile.saved_addresses || [],
      };
      
      setUser(u);
      setSuccessMsg(`Welcome back, ${u.name}!`);
      setStep("success");
      setLoading(false);
      setTimeout(onClose, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred checking your profile.");
      setLoading(false);
    }
  }

  // ── Explicit Profile save (If Trigger missed name or failed) ───────────────
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrorMsg("Please enter your name.");
    
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return setErrorMsg("Session expired. Please try again."); }

    // Use UPSERT just in case the trigger genuinely failed to insert
    const { error } = await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: name.trim(),
      email: authUser.email,
      phone_number: authUser.phone,
      role: 'customer' // Safe default, portals will block access if wrong anyway.
    });

    if (error) { setLoading(false); return setErrorMsg("Error saving profile: " + error.message); }

    const u: AppUser = { 
      id: authUser.id, 
      name: name.trim(), 
      phone: authUser.phone || "", 
      email: authUser.email || "", 
      role: "customer",
      isPro: false,
      savedAddresses: []
    };
    setUser(u);
    setSuccessMsg("Welcome to TFB!");
    setStep("success");
    setLoading(false);
    setTimeout(onClose, 1500);
  }

  // ── OTP input handlers ────────────────────────────────────────────────────
  function handleOtpChange(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = d; setOtp(next);
    
    if (d && i < 5) {
      otpRefs.current[i + 1]?.focus();
    } else if (d && i === 5) {
      // Do not auto-submit to prevent rapid re-rendering states. Just light up the button.
    }
  }
  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  // ── Derived titles ────────────────────────────────────────────────────────
  const modalTitle = step === "otp"
    ? (authMethod === "email" ? "Check your email" : "Check your phone")
    : isPortal
    ? portalCfg!.title
    : "Sign in or Sign up";

  const modalSubtitle = step === "otp"
    ? `We sent a 6-digit code to ${authMethod === "email" ? email : '+91 ' + phone}`
    : isPortal
    ? portalCfg!.subtitle
    : intent === "personal" ? "Sign in to save your personalized meal plan."
    : intent === "group"    ? "Sign in to complete your group order."
    : `Enter your ${authMethod} to get a quick sign-in code.`; 

  // ── Step Variants ─────────────────────────────────────────────────────────
  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Header section */}
            <div className="bg-slate-50 px-6 sm:px-8 pt-6 sm:pt-8 pb-6 border-b border-slate-100 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPortal ? "bg-tfb-red/10 text-tfb-red" : "bg-tfb-green/10 text-tfb-green"
                )}>
                  <PortalIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-heading">{modalTitle}</h2>
                  <p className="text-sm text-slate-500">{modalSubtitle}</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  variants={stepVariants}
                  initial="initial"
                  animate="enter"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {errorMsg && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2 leading-tight">
                      <div className="w-4 h-4 mt-0.5 shrink-0 animate-pulse bg-red-600 rounded-full flex justify-center items-center text-[10px] text-white font-bold">!</div>
                      {errorMsg}
                    </motion.div>
                  )}

                  {/* STEP 1: INITIAL LOGIN (Email/Password for Portals, OTP for Customers) */}
                  {step === "email" && (
                    <form onSubmit={isPortal ? handlePasswordSignIn : handleSendOtp} className="space-y-6">
                      {!isPortal && (
                        <div className="flex p-1 bg-slate-100 rounded-xl mb-6 relative">
                          <motion.div
                            layoutId="authToggle"
                            className="absolute inset-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm"
                            initial={false}
                            animate={{ x: authMethod === "email" ? 0 : "100%" }}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                          />
                          <button
                            type="button"
                            onClick={() => setAuthMethod("email")}
                            className={cn(
                              "relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
                              authMethod === "email" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            <Mail className="w-4 h-4" />
                            Email
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMethod("phone")}
                            className={cn(
                              "relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
                              authMethod === "phone" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            <Phone className="w-4 h-4" />
                            Phone
                          </button>
                        </div>
                      )}

                      <div className="space-y-4">
                        {authMethod === "email" || isPortal ? (
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Email address</label>
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tfb-green transition-colors" />
                              <Input
                                ref={emailRef}
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all ring-offset-0"
                                autoCapitalize="none"
                                autoCorrect="off" 
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Phone number</label>
                            <div className="relative group">
                              <div className="absolute left-0 top-0 bottom-0 flex items-center gap-2 pl-4 pr-3 text-slate-500 font-bold border-r border-slate-200 h-12 my-auto">
                                <span className="text-sm">+91</span>
                              </div>
                              <Input
                                type="tel"
                                placeholder="00000 00000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                className="pl-16 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all ring-offset-0 font-medium tracking-wide"
                                required
                                autoFocus
                              />
                            </div>
                          </div>
                        )}
                        
                        {isPortal && (
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tfb-red transition-colors" />
                              <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all ring-offset-0"
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Button 
                        type="submit" 
                        disabled={loading} 
                        className={cn(
                          "w-full h-12 text-base font-bold text-white shadow-sm transition-all active:scale-[0.98]", 
                          isPortal ? "bg-tfb-red hover:bg-red-700" : "bg-tfb-green hover:bg-green-700"
                        )}
                      >
                        {loading ? (isPortal ? "Signing in..." : "Sending...") : (isPortal ? "Sign In" : "Send code")}
                        {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                      </Button>
                    </form>
                  )}

                  {/* STEP 2: OTP */}
                  {step === "otp" && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="flex justify-between gap-1.5 sm:gap-2">
                        {otp.map((d, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={d}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            onPaste={handleOtpPaste}
                            className="w-full h-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-tfb-red focus:bg-white focus:ring-1 focus:ring-tfb-red outline-none transition-all"
                          />
                        ))}
                      </div>
                      <Button type="submit" disabled={loading || otp.join("").length < 6} className={cn("w-full h-12 text-base font-bold text-white transition-all active:scale-[0.98]", isPortal ? "bg-tfb-red hover:bg-red-700" : "bg-tfb-green hover:bg-green-700")}>
                        {loading ? "Verifying..." : "Verify Code"}
                      </Button>
                      <p className="text-center text-sm text-slate-500">
                        Didn't get it?{" "}
                        {resendTimer > 0 ? (
                          <span className="text-slate-400 font-medium text-xs">Resend in {resendTimer}s</span>
                        ) : (
                          <button type="button" onClick={handleSendOtp} className={cn("font-bold hover:underline", isPortal ? "text-tfb-red" : "text-tfb-green")}>
                            Resend now
                          </button>
                        )}
                      </p>
                    </form>
                  )}

                  {/* STEP 3: SETUP PROFILE */}
                  {step === "profile" && (
                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-700 ml-1">What should we call you?</label>
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tfb-green transition-colors" />
                          <Input
                            type="text"
                            placeholder="Your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all ring-offset-0"
                            autoFocus
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full h-12 text-base font-bold bg-slate-900 border-b-4 border-slate-950 hover:bg-slate-800 active:border-b-0 active:translate-y-1 transition-all">
                        {loading ? "Saving..." : "Start my journey"}
                        {!loading && <Sparkles className="w-4 h-4 ml-2" />}
                      </Button>
                    </form>
                  )}

                  {/* STEP 4: SUCCESS */}
                  {step === "success" && (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg", isPortal ? "bg-tfb-red shadow-tfb-red/30" : "bg-tfb-green shadow-tfb-green/30")}>
                        <Sparkles className="w-8 h-8" />
                      </motion.div>
                      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xl font-bold text-slate-900 leading-tight">
                        {successMsg}
                      </motion.h3>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

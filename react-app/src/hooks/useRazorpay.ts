import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";

// Extend the Window interface to include Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
  amount: number;          // in INR (not paise)
  orderNumber: string;     // our internal TFB order ID
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess: (paymentId: string, razorpayOrderId: string) => void;
  onFailure: (reason: string) => void;
}

/**
 * useRazorpay
 * 1. Lazily loads the Razorpay checkout script.
 * 2. Tries to call the Supabase Edge Function to create a server-side Razorpay order.
 * 3. Falls back to direct frontend init if Edge Function isn't deployed yet.
 * 4. Opens the Razorpay modal for the user to pay.
 */
export function useRazorpay() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptLoaded = useRef(false);

  // Load the Razorpay JS SDK once on mount
  useEffect(() => {
    if (scriptLoaded.current || document.getElementById("razorpay-sdk")) return;
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.body.appendChild(script);
  }, []);

  async function openPayment(opts: RazorpayOptions) {
    setLoading(true);
    setError(null);

    try {
      // --- Try to get order from Edge Function, fall back to direct mode ---
      let keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
      let razorpayOrderId: string | undefined;

      try {
        const { data, error: fnError } = await api.v1.createOrder({
          amount: opts.amount,
          currency: "INR",
          receipt: opts.orderNumber,
          notes: { order_number: opts.orderNumber },
        });

        if (!fnError && data) {
          const resBody = data as any;
          if (!resBody.error) {
            // Edge Function succeeded — use the server-created order
            keyId = resBody.key_id;
            razorpayOrderId = resBody.razorpay_order_id;
          } else {
            console.warn("Edge Function returned an error:", resBody.error);
          }
        } else if (fnError) {
          console.warn("Edge Function call failed:", fnError.message);
        }
      } catch {
        console.warn("Edge Function call failed, falling back to direct Razorpay mode.");
      }

      if (!keyId) {
        throw new Error("Razorpay Key ID not configured. Add VITE_RAZORPAY_KEY_ID to your .env file.");
      }

      // --- Open the Razorpay modal ---
      await new Promise<void>((resolve, reject) => {
        const openModal = () => {
          const options: Record<string, any> = {
            key: keyId,
            amount: Math.round(opts.amount * 100), // paise
            currency: "INR",
            name: "The Fit Bowls",
            description: `Order ${opts.orderNumber}`,
            image: "/logo.png",
            notes: {
              order_number: opts.orderNumber
            },
            prefill: {
              name: opts.customerName,
              email: opts.customerEmail,
              contact: opts.customerPhone.slice(-10),
            },
            theme: { color: "#16a34a" }, // Emerald green to match TFB brand
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled by user.")),
            },
            handler: (response: any) => {
              opts.onSuccess(response.razorpay_payment_id, response.razorpay_order_id ?? "");
              resolve();
            },
          };

          // Only add order_id if we got one from the Edge Function
          if (razorpayOrderId) {
            options.order_id = razorpayOrderId;
          }

          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", (res: any) => {
            reject(new Error(res.error?.description ?? "Payment failed."));
          });
          rzp.open();
        };

        if (window.Razorpay) {
          openModal();
        } else {
          // Wait for SDK script to load (max 5 seconds)
          const interval = setInterval(() => {
            if (window.Razorpay) { clearInterval(interval); openModal(); }
          }, 100);
          setTimeout(() => {
            clearInterval(interval);
            reject(new Error("Razorpay SDK failed to load. Please check your internet connection and refresh."));
          }, 5000);
        }
      });

    } catch (err: any) {
      const msg = err.message || "Payment failed.";
      setError(msg);
      opts.onFailure(msg);
    } finally {
      setLoading(false);
    }
  }

  return { openPayment, loading, error, clearError: () => setError(null) };
}

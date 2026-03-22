import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../types";

interface OrderUpdate {
  order_number: string;
  status: string;
  customer_name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  preparing: "Being Prepared 👨‍🍳",
  ready: "Ready for Pickup ✅",
  out_for_delivery: "Out for Delivery 🛵",
  delivered: "Delivered! 🎉",
  cancelled: "Order Cancelled",
};

// Request browser notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showBrowserNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "tfb-order-update"
    });
  } catch {
    // Safari / some browsers block Notification from service workers context
  }
}


/**
 * useOrderNotifications
 * Subscribes to Supabase Realtime for the current user's orders.
 * On status UPDATE → shows an in-app toast + browser Notification.
 */
export function useOrderNotifications(
  user: AppUser | null,
  showToast: (msg: string) => void
) {
  const prevStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user?.id) return;

    // --- Delivery boy: subscribe to new assignments ---
    if (user.role === "delivery") {
      // First fetch the delivery_boy record to get the ID
      let channel: any;
      (async () => {
        const { data: dbRow } = await supabase
          .from("delivery_boys")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (!dbRow?.id) return;

        channel = supabase
          .channel(`delivery-notify-${user.id}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "delivery_assignments",
            filter: `delivery_boy_id=eq.${dbRow.id}`,
          }, () => {
            showToast("🛵 New delivery assigned! Check your portal.");
            showBrowserNotification("New Delivery Assignment", "You have a new delivery to complete.");
          })
          .subscribe();
      })();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }

    // --- Customer: subscribe to order status updates ---
    const channel = supabase
      .channel(`order-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const order = payload.new as OrderUpdate;
          const prev = prevStatuses.current[order.order_number];
          // Only notify if status actually changed
          if (prev && prev !== order.status) {
            const statusLabel = STATUS_LABELS[order.status] || order.status;
            const msg = `🍱 Your order #${order.order_number}: ${statusLabel}`;
            showToast(msg);
            showBrowserNotification("The Fit Bowls — Order Update", msg);
          }
          prevStatuses.current[order.order_number] = order.status;
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const order = payload.new as OrderUpdate;
          prevStatuses.current[order.order_number] = order.status;
          showToast(`✅ Order #${order.order_number} placed! We'll notify you as it's prepared.`);
          showBrowserNotification("The Fit Bowls — New Order", `Order #${order.order_number} placed!`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);
}


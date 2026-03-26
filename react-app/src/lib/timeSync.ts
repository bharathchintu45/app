import { supabase } from './supabase';

let clockOffsetMs = 0;
let isSynced = false;

/**
 * Initializes the trusted server time offset by fetching it exactly once from Supabase.
 * If this hasn't been called, getTrustedDate() mathematically defaults to local time.
 */
export async function syncServerTimeOffset() {
  if (isSynced) return;
  
  try {
    const t0 = Date.now();
    const { data: serverTimeStr, error } = await supabase.rpc('get_server_time');
    const t1 = Date.now();
    
    if (error || !serverTimeStr) return;
    
    const latency = (t1 - t0) / 2;
    const serverTimeMs = new Date(serverTimeStr).getTime() + latency;
    
    clockOffsetMs = serverTimeMs - Date.now();
    isSynced = true;
    console.log(`[TrustedTime] Server clock sync complete. Offset: ${clockOffsetMs}ms`);
  } catch (err) {
    console.warn("Failed to sync server time:", err);
  }
}

/**
 * Safely generates a trusted Date object.
 * Replaces `new Date()` calls that shouldn't be vulnerable to client-side clock tampering.
 */
export function getTrustedDate(val?: string | number | Date) {
  if (val !== undefined) {
    // If a specific value is provided, we assume it's an absolute timestamp and do not shift it.
    return new Date(val);
  }
  return new Date(Date.now() + clockOffsetMs);
}

/**
 * Trusted alternative to Date.now()
 */
export function getTrustedNow() {
  return Date.now() + clockOffsetMs;
}

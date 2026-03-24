-- THE FINAL FIX: Execute this to perfectly reset your timeline.
-- This will fix the "extra buffer days" and make the popup start at the correct 26th.

UPDATE subscriptions 
SET end_date = '2026-03-25' 
WHERE status = 'active';

DELETE FROM subscription_holds;
DELETE FROM subscription_swaps;

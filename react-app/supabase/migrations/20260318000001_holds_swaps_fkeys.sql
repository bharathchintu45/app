-- 1. Remove orphaned holds and swaps that reference old orders instead of the new subscriptions table
DELETE FROM public.subscription_holds WHERE subscription_id NOT IN (SELECT id FROM public.subscriptions);
DELETE FROM public.subscription_swaps WHERE subscription_id NOT IN (SELECT id FROM public.subscriptions);

-- 2. Update foreign key for subscription_holds
ALTER TABLE public.subscription_holds
  DROP CONSTRAINT IF EXISTS subscription_holds_subscription_id_fkey;

ALTER TABLE public.subscription_holds
  ADD CONSTRAINT subscription_holds_subscription_id_fkey 
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;

-- 3. Update foreign key for subscription_swaps
ALTER TABLE public.subscription_swaps
  DROP CONSTRAINT IF EXISTS subscription_swaps_subscription_id_fkey;

ALTER TABLE public.subscription_swaps
  ADD CONSTRAINT subscription_swaps_subscription_id_fkey 
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;

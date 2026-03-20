-- Performance Indexes for 5,000+ daily traffic
-- Created: 2026-03-20

-- Index for searching today's order on the dashboard
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders (delivery_date);

-- Index for fetching a user's order history
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);

-- Index for joining orders and order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- Index for subscription status lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);

-- Index for chat messages
CREATE INDEX IF NOT EXISTS idx_chef_threads_customer_id ON public.chef_threads (customer_id);
CREATE INDEX IF NOT EXISTS idx_chef_threads_created_at ON public.chef_threads (created_at DESC);

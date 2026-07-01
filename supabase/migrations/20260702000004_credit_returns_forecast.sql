-- 1. Patients Table Adjustments (Credit Limit)
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_due numeric DEFAULT 0;

-- 2. Customer Transactions (Credit Ledger)
CREATE TABLE IF NOT EXISTS public.customer_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL,
    transaction_type text CHECK (transaction_type IN ('credit_sale', 'payment', 'adjustment', 'write_off')) NOT NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS for customer_transactions
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read for users based on restaurant_id" ON public.customer_transactions FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Enable insert for users based on restaurant_id" ON public.customer_transactions FOR INSERT WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_customer_tx_restaurant ON public.customer_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_tx_patient ON public.customer_transactions(patient_id);

-- 3. Returns and Return Items
CREATE TABLE IF NOT EXISTS public.returns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
    refund_method text CHECK (refund_method IN ('cash', 'pos', 'transfer', 'store_credit')) NOT NULL,
    total_refunded numeric NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS for returns
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read for users based on restaurant_id" ON public.returns FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Enable insert for users based on restaurant_id" ON public.returns FOR INSERT WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.return_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id uuid REFERENCES public.returns(id) ON DELETE CASCADE NOT NULL,
    order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE NOT NULL,
    menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
    qty integer NOT NULL,
    returned_to_stock boolean NOT NULL DEFAULT true
);

-- RLS for return_items
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read for users based on restaurant_id" ON public.return_items FOR SELECT USING (return_id IN (SELECT id FROM public.returns WHERE restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Enable insert for users based on restaurant_id" ON public.return_items FOR INSERT WITH CHECK (return_id IN (SELECT id FROM public.returns WHERE restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update order_items to track total returned
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS returned_qty integer DEFAULT 0;

-- 4. Inventory Forecasting Alert Setting
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS forecast_alert_threshold integer DEFAULT 7;

-- 5. RPC for forecasting
CREATE OR REPLACE FUNCTION public.get_inventory_forecast(p_restaurant_id uuid)
RETURNS TABLE (
    menu_item_id uuid,
    item_name text,
    current_stock integer,
    run_rate_7d numeric,
    estimated_days_remaining numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH item_sales AS (
        SELECT 
            oi.menu_item_id,
            SUM(oi.qty) as total_sold,
            MIN(o.created_at) as first_sale_date,
            MAX(o.created_at) as last_sale_date
        FROM public.order_items oi
        JOIN public.orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = p_restaurant_id
          AND o.payment_status IN ('confirmed', 'completed', 'cash_paid', 'pos_paid', 'cash_pos') -- Count all valid sales
          AND o.status NOT IN ('cancelled', 'rejected') -- ignore fully rejected/cancelled
          AND o.created_at >= (now() - interval '30 days')
        GROUP BY oi.menu_item_id
    ),
    item_velocity AS (
        SELECT 
            s.menu_item_id,
            s.total_sold,
            -- Calculate active days (min 1 to avoid div by zero)
            GREATEST(EXTRACT(EPOCH FROM (now() - s.first_sale_date)) / 86400, 1.0) as active_days
        FROM item_sales s
    ),
    calculated_forecast AS (
        SELECT 
            v.menu_item_id,
            m.name as item_name,
            m.stock_quantity as current_stock,
            (v.total_sold / v.active_days) as run_rate_7d
        FROM item_velocity v
        JOIN public.menu_items m ON v.menu_item_id = m.id
        WHERE m.track_inventory = true 
          AND m.stock_quantity > 0
          AND (v.total_sold / v.active_days) > 0 -- Ensure velocity is > 0 to avoid division by zero later
    )
    SELECT 
        f.menu_item_id,
        f.item_name,
        f.current_stock,
        ROUND(f.run_rate_7d::numeric, 2) as run_rate_7d,
        ROUND((f.current_stock / f.run_rate_7d)::numeric, 1) as estimated_days_remaining
    FROM calculated_forecast f
    ORDER BY estimated_days_remaining ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

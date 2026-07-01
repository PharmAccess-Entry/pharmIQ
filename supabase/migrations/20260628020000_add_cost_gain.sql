ALTER TABLE public.stock_reconciliation_items ADD COLUMN cost_gain NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.stock_reconciliation_items ADD COLUMN revenue_gain NUMERIC(10,2) DEFAULT 0;

-- ============================================================
-- MIGRATION 07: Fix shift expected POS/Transfers calculation
-- ============================================================
-- Includes start_pos and start_transfers in the expected totals.

CREATE OR REPLACE FUNCTION public.get_shift_expected_totals(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift         RECORD;
  v_cash_sales    NUMERIC := 0;
  v_pos_sales     NUMERIC := 0;
  v_transfer_sales NUMERIC := 0;
  v_cash_refunds  NUMERIC := 0;
  v_pos_refunds   NUMERIC := 0;
  v_transfer_refunds NUMERIC := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found: %', p_shift_id;
  END IF;

  -- Sum sales by payment channel (exclude refunded orders from revenue)
  SELECT
    COALESCE(SUM(CASE WHEN payment_status = 'cash_paid' AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_status IN ('pos_paid','cash_pos') AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_status = 'confirmed' AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0)
  INTO v_cash_sales, v_pos_sales, v_transfer_sales
  FROM public.orders
  WHERE shift_id = p_shift_id;

  -- Sum cash given OUT for refunds (where refund was processed during this shift)
  SELECT
    COALESCE(SUM(CASE WHEN o_orig.payment_status = 'cash_paid' THEN o_ref.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o_orig.payment_status IN ('pos_paid','cash_pos') THEN o_ref.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o_orig.payment_status = 'confirmed' THEN o_ref.total ELSE 0 END), 0)
  INTO v_cash_refunds, v_pos_refunds, v_transfer_refunds
  FROM public.orders o_ref
  JOIN public.orders o_orig ON o_orig.id = o_ref.id  -- same order, just checking its original payment method
  WHERE o_ref.refund_shift_id = p_shift_id
    AND o_ref.status = 'refunded';

  RETURN jsonb_build_object(
    'start_cash',          v_shift.start_cash,
    'start_pos',           COALESCE(v_shift.start_pos, 0),
    'start_transfers',     COALESCE(v_shift.start_transfers, 0),
    'cash_sales',          v_cash_sales,
    'pos_sales',           v_pos_sales,
    'transfer_sales',      v_transfer_sales,
    'cash_refunds',        v_cash_refunds,
    'pos_refunds',         v_pos_refunds,
    'transfer_refunds',    v_transfer_refunds,
    'expected_cash',       COALESCE(v_shift.start_cash, 0) + v_cash_sales - v_cash_refunds,
    'expected_pos',        COALESCE(v_shift.start_pos, 0) + v_pos_sales - v_pos_refunds,
    'expected_transfers',  COALESCE(v_shift.start_transfers, 0) + v_transfer_sales - v_transfer_refunds
  );
END;
$$;

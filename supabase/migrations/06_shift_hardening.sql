-- ============================================================
-- MIGRATION 06: PharmIQ Shift System Hardening & Auditing
-- ============================================================
-- Objective:
--   1. Add status transition check constraints to prevent invalid states
--   2. Implement shift lifecycle audit triggers
-- ============================================================

-- ============================================================
-- SECTION 1: Status Validation
-- ============================================================
-- Ensure shifts status can only be active, completed, or settled
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_status_check;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_status_check CHECK (status IN ('active', 'completed', 'settled'));

-- ============================================================
-- SECTION 2: Audit Logging Trigger
-- ============================================================
-- We want to automatically track when a shift is opened, closed, or settled.
-- The audit_logs table already exists.

CREATE OR REPLACE FUNCTION public.log_shift_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Shift Opened
    INSERT INTO public.audit_logs (
      restaurant_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
      NEW.restaurant_id, NEW.user_id, 'SHIFT_STARTED', 'shift', NEW.id,
      jsonb_build_object(
        'start_cash', NEW.start_cash,
        'start_pos', NEW.start_pos,
        'start_transfers', NEW.start_transfers
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Shift Closed (status changes to 'completed')
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      INSERT INTO public.audit_logs (
        restaurant_id, user_id, action, entity_type, entity_id, details
      ) VALUES (
        NEW.restaurant_id, NEW.user_id, 'SHIFT_ENDED', 'shift', NEW.id,
        jsonb_build_object(
          'expected_cash', NEW.expected_cash,
          'actual_cash', NEW.actual_cash,
          'expected_pos', NEW.expected_pos,
          'actual_pos', NEW.actual_pos,
          'expected_transfers', NEW.expected_transfers,
          'actual_transfers', NEW.actual_transfers,
          'notes', NEW.notes
        )
      );
    END IF;

    -- Shift Settled (status changes to 'settled')
    IF OLD.status = 'completed' AND NEW.status = 'settled' THEN
      INSERT INTO public.audit_logs (
        restaurant_id, user_id, action, entity_type, entity_id, details
      ) VALUES (
        NEW.restaurant_id, NEW.settled_by, 'SHIFT_SETTLED', 'shift', NEW.id,
        jsonb_build_object(
          'settled_at', NEW.settled_at,
          'variance_cash', COALESCE(NEW.actual_cash,0) - COALESCE(NEW.expected_cash,0)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_shift_activity ON public.shifts;
CREATE TRIGGER trigger_log_shift_activity
  AFTER INSERT OR UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_shift_activity();

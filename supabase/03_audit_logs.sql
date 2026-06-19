-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their restaurant"
    ON public.audit_logs FOR SELECT
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert audit logs for their restaurant"
    ON public.audit_logs FOR INSERT
    WITH CHECK (restaurant_id IN (
        SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
    ));

GRANT ALL ON public.audit_logs TO authenticated;

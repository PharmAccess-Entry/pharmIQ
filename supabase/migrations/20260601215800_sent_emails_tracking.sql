-- Create a table to track sent emails to prevent spam and duplicates
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    template_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup when edge functions check if an email was sent
CREATE INDEX IF NOT EXISTS sent_emails_email_template_idx ON public.sent_emails(email, template_key);

-- Add a unique constraint to ensure the backend can't accidentally insert duplicates if called concurrently
ALTER TABLE public.sent_emails ADD CONSTRAINT sent_emails_unique_email_template UNIQUE (email, template_key);

-- Enable RLS (Row Level Security)
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- Allow read/write ONLY from the service role (backend edge functions)
-- Authenticated or anonymous users should NOT be able to read or write to this table
CREATE POLICY "Service role has full access to sent_emails" 
ON public.sent_emails 
TO service_role 
USING (true) 
WITH CHECK (true);

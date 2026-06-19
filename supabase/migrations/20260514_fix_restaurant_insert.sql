-- Fix missing INSERT policy for the restaurants table
-- This allows new users to auto-create their restaurant profile upon signup.

CREATE POLICY "restaurants_insert_owner" ON public.restaurants 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

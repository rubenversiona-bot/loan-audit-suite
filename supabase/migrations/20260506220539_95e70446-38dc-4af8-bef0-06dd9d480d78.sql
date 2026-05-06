ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS expediente_ref text,
  ADD COLUMN IF NOT EXISTS expediente_date date;
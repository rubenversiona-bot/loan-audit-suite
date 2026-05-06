
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS index_lookback_months integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.bank_amortization_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  document_id uuid NOT NULL,
  period integer NOT NULL,
  due_date date,
  payment numeric,
  interest numeric,
  principal numeric,
  balance numeric,
  rate numeric,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_amortization_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bar_owner_all ON public.bank_amortization_rows;
CREATE POLICY bar_owner_all ON public.bank_amortization_rows
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS bar_loan_idx ON public.bank_amortization_rows(loan_id);
CREATE INDEX IF NOT EXISTS bar_doc_idx ON public.bank_amortization_rows(document_id);

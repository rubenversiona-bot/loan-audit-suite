
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'perito', 'user');
CREATE TYPE public.amort_system AS ENUM ('frances', 'aleman');
CREATE TYPE public.rate_type AS ENUM ('fijo', 'variable', 'mixto');
CREATE TYPE public.loan_event_type AS ENUM ('pago_programado','amortizacion_anticipada','cambio_tasa','comision','mora','novacion');
CREATE TYPE public.index_source AS ENUM ('manual','csv','bde_api');
CREATE TYPE public.discrepancy_category AS ENUM ('interes_excedente','comision_indebida','capital_mal_aplicado','irph_vs_euribor','clausula_suelo','otro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  colegiado TEXT,
  despacho TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin'));

-- ============ TRIGGER AUTO-PROFILE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'perito');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REFERENCE INDEXES ============
CREATE TABLE public.reference_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  bde_series_code TEXT,
  bde_dataset TEXT,
  is_official BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reference_indexes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_idx_read_all_auth" ON public.reference_indexes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_idx_admin_write" ON public.reference_indexes FOR ALL USING (public.has_role(auth.uid(),'admin'));

-- ============ INDEX VALUES ============
CREATE TABLE public.index_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES public.reference_indexes(id) ON DELETE CASCADE,
  value_date DATE NOT NULL,
  value NUMERIC(10,6) NOT NULL,
  source public.index_source NOT NULL DEFAULT 'manual',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(index_id, value_date)
);
CREATE INDEX idx_index_values_lookup ON public.index_values(index_id, value_date DESC);
ALTER TABLE public.index_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "idx_values_read_all_auth" ON public.index_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "idx_values_admin_write" ON public.index_values FOR ALL USING (public.has_role(auth.uid(),'admin'));
-- Permitir que peritos también inserten valores manualmente (para sus análisis):
CREATE POLICY "idx_values_auth_insert" ON public.index_values FOR INSERT TO authenticated WITH CHECK (true);

-- ============ LOANS ============
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_name TEXT NOT NULL,
  bank_name TEXT,
  loan_number TEXT,
  signed_date DATE NOT NULL,
  initial_capital NUMERIC(14,2) NOT NULL,
  term_months INT NOT NULL,
  amort_system public.amort_system NOT NULL DEFAULT 'frances',
  rate_type public.rate_type NOT NULL DEFAULT 'variable',
  initial_tin NUMERIC(8,5),
  index_id UUID REFERENCES public.reference_indexes(id),
  spread NUMERIC(6,4),
  review_period_months INT DEFAULT 12,
  fixed_period_months INT,
  day_count_basis TEXT NOT NULL DEFAULT '30/360',
  payment_frequency_months INT NOT NULL DEFAULT 1,
  opening_fee_pct NUMERIC(6,4),
  early_repay_fee_pct NUMERIC(6,4),
  cancellation_fee_pct NUMERIC(6,4),
  floor_rate NUMERIC(8,5),
  ceiling_rate NUMERIC(8,5),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loans_owner ON public.loans(owner_id);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_owner_all" ON public.loans FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER loans_touch BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ LOAN EVENTS ============
CREATE TABLE public.loan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type public.loan_event_type NOT NULL,
  amount NUMERIC(14,2),
  new_rate NUMERIC(8,5),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_events_loan ON public.loan_events(loan_id, event_date);
ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_events_owner_all" ON public.loan_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.owner_id = auth.uid()));

-- ============ BANK STATEMENTS ============
CREATE TABLE public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT,
  source_format TEXT,
  period_start DATE,
  period_end DATE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_stmt_owner_all" ON public.bank_statements FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.statement_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL,
  balance NUMERIC(14,2),
  matched_event_id UUID REFERENCES public.loan_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stmt_mov ON public.statement_movements(statement_id, movement_date);
ALTER TABLE public.statement_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stmt_mov_owner_all" ON public.statement_movements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bank_statements s WHERE s.id = statement_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bank_statements s WHERE s.id = statement_id AND s.owner_id = auth.uid()));

-- ============ DISCREPANCIES ============
CREATE TABLE public.discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discrepancy_date DATE NOT NULL,
  category public.discrepancy_category NOT NULL,
  description TEXT,
  theoretical_amount NUMERIC(14,2),
  actual_amount NUMERIC(14,2),
  delta NUMERIC(14,2) NOT NULL,
  in_favor_of TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disc_loan ON public.discrepancies(loan_id, discrepancy_date);
ALTER TABLE public.discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_owner_all" ON public.discrepancies FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  doc_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_owner_all" ON public.documents FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('loan-documents','loan-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bank-statements','bank-statements', false) ON CONFLICT DO NOTHING;

CREATE POLICY "loan_docs_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "loan_docs_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "loan_docs_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "loan_docs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "bank_stmt_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bank_stmt_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bank_stmt_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bank_stmt_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ SEED REFERENCE INDEXES ============
INSERT INTO public.reference_indexes (code, name, description, bde_series_code, bde_dataset, is_official) VALUES
  ('EURIBOR_12M','Euríbor 12 meses','Tipo de referencia oficial publicado por el BCE/BDE','SI_1_5.1.M','TI','t'),
  ('EURIBOR_6M','Euríbor 6 meses','Euríbor a 6 meses', NULL, 'TI','t'),
  ('EURIBOR_3M','Euríbor 3 meses','Euríbor a 3 meses', NULL, 'TI','t'),
  ('EURIBOR_1M','Euríbor 1 mes','Euríbor a 1 mes', NULL, 'TI','t'),
  ('IRPH_CAJAS','IRPH Cajas','Índice de Referencia de Préstamos Hipotecarios - Cajas (histórico, sustituido)', NULL, 'TI','t'),
  ('IRPH_BANCOS','IRPH Bancos','Índice de Referencia de Préstamos Hipotecarios - Bancos (histórico, sustituido)', NULL, 'TI','t'),
  ('IRPH_CONJUNTO','IRPH Conjunto Entidades','Tipo medio de préstamos hipotecarios a más de 3 años, conjunto de entidades de crédito','SI_1_5.1.M','TI','t'),
  ('MIBOR','MIBOR','Tipo interbancario español (histórico)', NULL, 'TI','t');

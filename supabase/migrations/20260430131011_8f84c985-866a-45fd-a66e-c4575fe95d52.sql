
-- Fijar search_path en todas las funciones
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restringir inserción de valores de índice solo a admins (la política previa era WITH CHECK true)
DROP POLICY IF EXISTS "idx_values_auth_insert" ON public.index_values;

-- Revocar EXECUTE público de funciones SECURITY DEFINER (handle_new_user no debe ser llamada por usuarios)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- has_role: solo backend / RLS. Revocamos público pero permitimos a authenticated (lo usan políticas)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

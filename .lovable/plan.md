
## Objetivo

1. Permitir **ver y editar** los datos de un préstamo ya creado.
2. Permitir **borrar** un préstamo (con todos sus registros relacionados).
3. Resolver el **error de tamaño** al subir el PDF en `prestamos/nuevo` para admitir al menos 25 MB.

---

## 1. Editar préstamo

Actualmente `src/routes/prestamos.$id.tsx` solo muestra una cabecera de solo lectura. Reutilizamos la estructura del formulario de `prestamos.nuevo.tsx`.

**Cambios:**
- Extraer el formulario de `prestamos.nuevo.tsx` a un componente reusable `src/components/loan-form.tsx` con props:
  - `initial: FormState`
  - `mode: "create" | "edit"`
  - `onSubmit(values)` — el componente padre decide si hace `insert` o `update`.
  - Mantiene la sección opcional de extracción IA solo en modo `create`.
- En `prestamos.$id.tsx` añadir una pestaña nueva **"Datos"** (la primera) con `<LoanForm mode="edit" initial={...} onSubmit={...} />` que hace `supabase.from("loans").update(...).eq("id", id)`.
- `prestamos.nuevo.tsx` se simplifica para usar el mismo componente.

## 2. Borrar préstamo

- Añadir botón **"Eliminar préstamo"** (variant destructive) en la cabecera de `prestamos.$id.tsx`, protegido con `AlertDialog` de confirmación.
- Acción: borrar en orden:
  1. `discrepancies` where `loan_id = id`
  2. `loan_events` where `loan_id = id`
  3. `statement_movements` (vía `bank_statements`) y `bank_statements` where `loan_id = id`
  4. `documents` where `loan_id = id` (+ borrar archivos del bucket `loan-documents` con `supabase.storage.from(...).remove([...])`)
  5. `loans` where `id = id`
- Tras éxito → `toast` y `navigate({ to: "/prestamos" })`.
- En la lista `prestamos.index.tsx`: añadir botón de borrado por fila (también con confirmación) reutilizando la misma función helper `deleteLoanCascade(id)` colocada en `src/lib/loans.ts`.

## 3. Subida de PDF hasta 25 MB

**Causa raíz:** hoy el PDF se envía como JSON base64 dentro del cuerpo de un `createServerFn`. El runtime del Worker / proxy limita el body a ~1 MB en JSON serializado, por eso falla con archivos grandes. Base64 además infla el tamaño un ~33%.

**Solución:** subir primero a Supabase Storage desde el navegador (sin pasar por el Worker), y enviar al servidor solo la ruta del archivo. El servidor lo descarga con `supabaseAdmin` y lo procesa.

**Cambios:**
- `src/routes/prestamos.nuevo.tsx`:
  - Validar `file.size <= 25 * 1024 * 1024`; mostrar toast claro si se excede.
  - Subir el PDF al bucket `loan-documents` en `tmp-extract/{user_id}/{uuid}.pdf` con `supabase.storage.from("loan-documents").upload(path, file)`.
  - Llamar a `extractLoanFromPdf({ data: { storagePath } })` en lugar de mandar base64.
- `src/server/extract.functions.ts`:
  - Cambiar el schema a `{ storagePath: string }`.
  - Usar `supabaseAdmin.storage.from("loan-documents").download(storagePath)` para obtener el `Blob`, convertirlo a base64 dentro del handler y pasarlo al gateway IA igual que ahora.
  - Borrar el archivo temporal tras procesarlo (`.remove([path])`).
- `supabase/config.toml`: nada que tocar (el límite por request en Storage es de varios GB; suficiente para 25 MB).
- Verificar que las RLS del bucket `loan-documents` permiten `INSERT/SELECT/DELETE` al `owner_id == auth.uid()` para la ruta `tmp-extract/{user_id}/...`. Si no existen, añadir migración con políticas en `storage.objects`.

## Detalles técnicos

```text
src/
  components/loan-form.tsx       (nuevo)  — formulario reusable create/edit
  lib/loans.ts                   (nuevo)  — deleteLoanCascade(id)
  routes/
    prestamos.$id.tsx            (edit)   — pestaña "Datos" + botón eliminar
    prestamos.index.tsx          (edit)   — botón eliminar por fila
    prestamos.nuevo.tsx          (edit)   — usa LoanForm + upload a Storage
  server/extract.functions.ts    (edit)   — recibe storagePath en vez de base64
```

Migración SQL (solo si las políticas del bucket no existen ya):

```sql
create policy "loan_docs_owner_rw"
on storage.objects for all to authenticated
using (bucket_id = 'loan-documents' and owner = auth.uid())
with check (bucket_id = 'loan-documents' and owner = auth.uid());
```

## Resultado para el usuario

- Desde la ficha de un préstamo se podrán editar todos los campos y borrarlo por completo.
- Desde el listado se podrá borrar un préstamo con confirmación.
- La subida de contratos PDF admitirá hasta 25 MB sin error de tamaño.

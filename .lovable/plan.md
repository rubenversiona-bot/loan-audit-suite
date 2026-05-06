## Plan (actualizado)

Mismas mejoras del plan anterior + **destacar visualmente las filas de revisión** en el cuadro de amortización.

### 1. Cuadro de amortización con revisiones reales
- Migración: `loans.index_lookback_months int not null default 2`.
- `src/lib/mortgage/calculator.ts`:
  - Extender `LoanInput` con `indexValues`, `spread`, `reviewPeriodMonths`, `lookbackMonths`.
  - `buildRateAt(date)`: busca último valor del índice con `value_date ≤ date − lookbackMonths`, devuelve `value + spread`. Fallback: congelar último valor conocido.
  - `generateSchedule`: aplicar nuevo TIN solo en periodos de revisión y **recalcular cuota francesa** con saldo restante.
  - Añadir flag `isRevision: boolean` en cada `AmortRow` (true en periodo 1, fin del tramo fijo y cada revisión posterior).

### 2. Campo "desfase del índice" (1 / 2 meses)
- `loan-form.tsx`: `<Select>` visible si `rate_type !== "fijo"`.
- `extract.functions.ts`: añadir `index_lookback_months: 1|2` (default 2) al schema y al prompt.
- `prestamos.nuevo.tsx`: incluir en el insert.

### 3. Visor PDF con paginación + búsqueda
- `bun add react-pdf`.
- `src/components/pdf-viewer.tsx`: controles ←/→, input de página, input de búsqueda con `customTextRenderer` que envuelve coincidencias en `<mark>`. Worker cargado solo en cliente.
- Tab nuevo **"Contrato"** en `prestamos.$id.tsx` con signed URL del documento `contrato`.

### 4. Documentos adicionales con extracción IA
- `src/lib/loan-documents.ts`: `uploadLoanDocument`, `deleteLoanDocument`.
- Tipos: `contrato`, `cuadro_banco`, `recibo`, `escritura`, `otro`.
- Tab **"Documentos"** con listado, subida (selector `doc_type`), borrado con confirmación y botón "Extraer datos".
- Server fn `extractFromDocument({ documentId })`:
  - `cuadro_banco` → filas a tabla nueva `bank_amortization_rows` para comparar con el cuadro recalculado.
  - `recibo` → inserta movimientos en `loan_events`.
  - `contrato`/`escritura`/`otro` → propone diff de campos del préstamo.
- Migración: tabla `bank_amortization_rows` con RLS owner.

### 5. NUEVO — Resaltar filas de revisión en el cuadro

`src/routes/prestamos.$id.tsx`, en el render del cuadro recalculado:

- Mantener estilo coherente con shadcn (sin colores fuertes, solo tono de superficie).
- Aplicar a `<TableRow>` cuando `row.isRevision`:
  ```tsx
  className={cn(row.isRevision && "bg-muted/60 hover:bg-muted border-l-2 border-l-primary/60 font-medium")}
  ```
  - `bg-muted/60`: fondo suave que respeta el tema (claro y oscuro).
  - Borde izquierdo `border-l-primary/60` como acento sutil.
  - Texto en `font-medium` para distinguir sin gritar.
- Añadir `<Badge variant="secondary" className="ml-2">Revisión</Badge>` al lado del periodo en esas filas.
- Leyenda discreta encima de la tabla: cuadrito `bg-muted/60` + "Periodos de revisión del tipo".
- Si existe comparativa con `bank_amortization_rows`, las celdas Δ con desviación > 0,5% se marcan en `text-destructive`/`text-emerald-600` (independiente del resaltado de revisión).

### Archivos

```text
src/lib/mortgage/calculator.ts        edit  — isRevision + buildRateAt
src/lib/loan-documents.ts             new
src/components/loan-form.tsx          edit  — campo lookback
src/components/pdf-viewer.tsx         new
src/routes/prestamos.$id.tsx          edit  — tabs + filas resaltadas + leyenda
src/routes/prestamos.nuevo.tsx        edit
src/server/extract.functions.ts       edit  — lookback + extractFromDocument
supabase/migrations/<ts>.sql          new   — index_lookback_months + bank_amortization_rows
```

Una vez aprobado, lo implemento todo de una vez.

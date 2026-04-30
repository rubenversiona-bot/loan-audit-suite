
# Plan: Mortgage Audit & Balance Adjustment Tool

Herramienta profesional para peritos y abogados especializados en auditoría hipotecaria. Permite cargar contratos de préstamo, recalcular cuadros de amortización, detectar discrepancias contra extractos bancarios y generar informes periciales en PDF. Adaptada al mercado español/europeo (Euríbor, IRPH).

## 1. Autenticación y modelo de datos

- Login/registro con Supabase (email + contraseña, recuperación de clave).
- Tabla `profiles` (nombre, colegiado, despacho, avatar) creada por trigger al registrarse.
- Tabla `user_roles` separada (`admin`, `perito`, `user`) con función `has_role()` SECURITY DEFINER. Sin roles en `profiles`.
- Tablas principales:
  - `loans`: datos del préstamo (capital, fecha firma, plazo, sistema amortización, tipo fijo/variable, índice, diferencial, periodicidad de revisión, comisiones).
  - `loan_events`: eventos cronológicos (pago programado, amortización anticipada, modificación de tasa, mora, comisión, novación).
  - `reference_indexes`: catálogo de índices (Euríbor 12M/6M/3M/1M, IRPH Cajas, IRPH Bancos, IRPH Conjunto, MIBOR).
  - `index_values`: valores por fecha (mensuales), con campo `source` (`manual`, `csv`, `bde_api`) y `synced_at`.
  - `bank_statements` y `statement_movements`: extractos cargados y movimientos parseados.
  - `discrepancies`: diferencias detectadas (fecha, concepto, monto teórico, real, delta, categoría).
  - `documents`: PDFs en Storage (contratos, escrituras, extractos).

Storage buckets privados: `loan-documents`, `bank-statements`, con RLS por `owner_id`.

## 2. Dashboard

- Listado de préstamos del usuario (deudor, capital, fecha firma, estado, % discrepancia).
- Botón "Nuevo préstamo" → wizard.
- Métricas: nº préstamos analizados, importe reclamable agregado, último análisis.
- Acceso a "Índices de referencia".

## 3. Alta de préstamo (wizard híbrido OCR + manual)

1. Subir contrato/escritura (PDF) → Storage.
2. Extracción IA (Lovable AI Gateway / Gemini) con schema JSON: capital, fecha firma, plazo, TIN, tipo, índice, diferencial, periodicidad revisión, sistema francés/alemán, comisiones, cláusulas suelo/techo.
3. Revisión y confirmación: formulario prellenado, badges "sugerido por IA" hasta validar.
4. Guardar → genera cuadro de amortización teórico inicial.

## 4. Motor de cálculo

Módulo TypeScript puro en `src/lib/mortgage/` (testeable con vitest):
- Sistema **francés** (cuota constante) y **alemán** (capital constante).
- Tipo **fijo**, **variable** (revisión periódica con Euríbor/IRPH + diferencial) y **mixto**.
- Recalcula con eventos: amortizaciones parciales, cambios de tasa, novaciones, comisiones.
- Redondeos bancarios y bases (30/360, actual/365).
- Detección de cláusulas abusivas: suelo activado, comparativa IRPH vs Euríbor.

## 5. Gestión de índices europeos + autocarga Banco de España

Sección dedicada con catálogo precargado: Euríbor 12M/6M/3M/1M, IRPH Cajas, IRPH Bancos, IRPH Conjunto, MIBOR.

**Fuentes de datos**:
- Carga manual (fecha + valor).
- Importación masiva CSV.
- **Sincronización automática con APIs oficiales del Banco de España (BDE)**:
  - Server function `syncBdeIndex(indexCode, fromDate?)` que consulta el portal de estadísticas del BDE (BE Statistical Data Portal — endpoints CSV/JSON públicos por código de serie, p. ej. series mensuales de Euríbor 12M y los IRPH oficiales/sustitutivos publicados mensualmente en el BOE).
  - Cada índice del catálogo guarda su `bde_series_code`.
  - Botón "Sincronizar con BDE" por índice (one-click) y job programado mensual (cron en `/api/public/cron/sync-indexes` con verificación de secret) que trae solo valores nuevos desde `MAX(date)`.
  - UI muestra última fecha sincronizada, fuente de cada valor (badge `BDE` / `Manual` / `CSV`) y permite override manual.
  - Tolerancia a fallos: si el endpoint cambia de formato o no responde, se registra el error y se mantiene la carga manual/CSV como fallback (mostrado al usuario con aviso).
- Visualización en gráfica histórica (Recharts) con overlay de varios índices.

Nota técnica: las APIs del BDE son públicas y no requieren API key, pero el formato puede variar entre series. Se implementa un adaptador por serie con su parser específico y tests de regresión sobre respuestas grabadas.

## 6. Carga y comparación de extractos bancarios

- Subida en CSV/XLSX (mapeo asistido de columnas: fecha, concepto, importe, saldo) **o PDF** (extracción IA con Gemini → tabla editable de movimientos antes de confirmar).
- Conciliación automática: empareja cargo bancario con evento teórico más cercano (fecha ±5 días, concepto similar).
- Tabla de discrepancias con categoría: interés excedente, comisión indebida, capital mal aplicado, IRPH vs Euríbor.

## 7. Visualización de discrepancias

Pantalla de análisis del préstamo con tabs: Resumen | Cuadro original | Cuadro recalculado | Eventos | Discrepancias | Documentos.
- Gráficos (Recharts): barras de discrepancias mensuales acumuladas, líneas de capital pendiente teórico vs real, comparativa cuota IRPH vs Euríbor.
- KPIs: total reclamable, intereses excedentes, comisiones indebidas, fecha primera discrepancia.

## 8. Reporte pericial PDF (completo)

Server function que genera el PDF (layout con `pdf-lib` + redacción asistida por AI Gateway para conclusiones):
- Carátula (perito, deudor, entidad, nº préstamo, fecha).
- Antecedentes y metodología (criterios de cálculo, índices y fuente BDE aplicada).
- Cuadro de amortización original (tabla completa).
- Cuadro recalculado (tabla completa).
- Listado detallado de eventos.
- Análisis de discrepancias con gráficos embebidos.
- Conclusión pericial (totales, importe reclamable, cláusulas abusivas).
- Anexos con documentos referenciados.
- Descarga directa + guardado en Storage del préstamo.

## 9. Diseño y UX

- Estética profesional LegalTech: minimalista, alta densidad de información.
- Tipografía serif para textos largos del informe, sans-serif para UI.
- Paleta sobria: fondo claro, azul marino primario, acentos ámbar (alertas) y rojo (cláusulas abusivas).
- Modo oscuro disponible.
- Sidebar colapsable (shadcn): Dashboard, Préstamos, Índices, Documentos, Configuración.
- Responsive con prioridad escritorio, funcional en tablet.

## Detalles técnicos

- **Stack**: TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Supabase (Lovable Cloud) + Lovable AI Gateway (Gemini) + Recharts + pdf-lib.
- **Server functions** (`src/server/*.functions.ts`):
  - `extractLoanFromPdf`, `extractStatementFromPdf` (IA)
  - `recalculateLoan` (motor puro reutilizable client-side)
  - `syncBdeIndex` (autocarga índices BDE)
  - `generateExpertReport` (PDF)
- **Cron público**: `src/routes/api/public/cron/sync-indexes.ts` con verificación de header secreto, invocable mensualmente (pg_cron o scheduler externo).
- **Seguridad**: RLS por `owner_id = auth.uid()` en todas las tablas. Service role solo en jobs internos. Documentos en buckets privados con signed URLs. `user_roles` separada con `has_role()`.
- **Tests** del motor de cálculo y de los parsers BDE (vitest).

## Fuera de alcance (fase 2)

- Multi-tenant / equipos y permisos avanzados.
- Firma electrónica del informe.
- App móvil nativa.

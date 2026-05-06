## Mejoras de estilo del cuadro de amortización (PDF)

Se reescribe la sección "6. CUADRO DE AMORTIZACIÓN RECALCULADO" en `src/server/report.functions.ts` usando primitivas de dibujo de `pdf-lib` (rectángulos + texto posicionado) en lugar de texto monoespaciado.

### Cambios visuales

1. **Encabezado de tabla destacado y repetido en cada página**
   - Banda gris medio (`rgb(0.85, 0.85, 0.88)`) de ~18 px de alto que ocupa el ancho útil de la página.
   - Texto en `Helvetica-Bold` 9 pt, color oscuro.
   - Se redibuja automáticamente al saltar de página (helper `drawTableHeader()` invocado tras cada `addPage`).

2. **Columnas con anchos fijos y alineación**
   - Definición declarativa de columnas con `{ key, label, width, align }`.
   - `#` centrado; `Fecha` a la izquierda; `TIN%`, `Cuota`, `Interés`, `Capital`, `Pendiente` alineadas a la derecha (calculando `x = colRight - font.widthOfTextAtSize(text, size)`).
   - Anchos pensados para A4 con márgenes de 50 px (≈495 px útiles).

3. **Filas de revisión resaltadas**
   - Antes de dibujar el texto de la fila, si `isRevision` es `true` se pinta un rectángulo de fondo gris claro (`rgb(0.93, 0.93, 0.95)`) que abarca toda la fila.
   - Se mantiene el asterisco `*` al final de la fila como indicador adicional.

4. **Detalles de pulido**
   - Línea separadora fina bajo la cabecera.
   - Interlineado de fila ligeramente mayor (12 px) para legibilidad.
   - Pie de tabla: leyenda "(*) Periodos de revisión del tipo." en gris.
   - Control de salto de página: si `y < margin + rowH`, se añade página y se redibuja el encabezado.

### Detalle técnico

```text
COLS = [
  { key:'period',   label:'#',         w: 28, align:'right' },
  { key:'date',     label:'Fecha',     w: 70, align:'left'  },
  { key:'rate',     label:'TIN %',     w: 50, align:'right' },
  { key:'payment',  label:'Cuota',     w: 75, align:'right' },
  { key:'interest', label:'Interés',   w: 75, align:'right' },
  { key:'principal',label:'Capital',   w: 75, align:'right' },
  { key:'balance',  label:'Pendiente', w: 90, align:'right' },
]
```

Helpers internos:
- `drawTableHeader(page, y)` → pinta banda + labels y devuelve nuevo `y`.
- `drawRow(page, y, row)` → pinta fondo (si revisión), celdas alineadas y `*` al final.
- `ensureSpace(rowH)` → si no cabe, `addPage()` + `drawTableHeader()`.

No se tocan otras secciones del informe ni la lógica de cálculo (`generateSchedule` se sigue usando tal cual).

### Archivos modificados

- `src/server/report.functions.ts` — reemplazar el bloque de la sección 6 por el nuevo render tabular.
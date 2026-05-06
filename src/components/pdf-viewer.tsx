import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

// Cargar worker desde el paquete instalado
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  fileUrl: string;
}

export function PdfViewer({ fileUrl }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [search, setSearch] = useState("");
  const [pageInput, setPageInput] = useState("1");
  const [width, setWidth] = useState<number>(800);

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  useEffect(() => {
    function handle() {
      const w = Math.min(900, window.innerWidth - 80);
      setWidth(w);
    }
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const fileMemo = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  const customTextRenderer = useMemo(() => {
    if (!search.trim()) return undefined;
    const term = search.trim();
    const pattern = new RegExp(`(${escapeRegex(term)})`, "gi");
    return ({ str }: { str: string }) =>
      str.replace(pattern, '<mark class="bg-primary/30 rounded px-0.5">$1</mark>');
  }, [search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border rounded-md p-2 bg-card">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 text-sm">
          <Input
            className="w-14 h-8 text-center"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => {
              const n = Math.max(1, Math.min(numPages || 1, Number(pageInput) || 1));
              setPageNumber(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Math.max(1, Math.min(numPages || 1, Number(pageInput) || 1));
                setPageNumber(n);
              }
            }}
          />
          <span className="text-muted-foreground">/ {numPages || "—"}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
          disabled={pageNumber >= numPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en el documento…"
            className="pl-8 h-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="border rounded-md overflow-auto bg-muted/30 max-h-[80vh] flex justify-center p-4">
        <Document
          file={fileMemo}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="text-sm text-muted-foreground">Cargando PDF…</div>}
          error={<div className="text-sm text-destructive">No se pudo cargar el PDF.</div>}
        >
          <Page
            pageNumber={pageNumber}
            width={width}
            customTextRenderer={customTextRenderer}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

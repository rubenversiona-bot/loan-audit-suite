import { supabase } from "@/integrations/supabase/client";

export const LOAN_DOC_TYPES = [
  { value: "contrato", label: "Contrato / Escritura inicial" },
  { value: "cuadro_banco", label: "Cuadro de amortización del banco" },
  { value: "recibo", label: "Recibo bancario" },
  { value: "escritura", label: "Escritura / Novación" },
  { value: "otro", label: "Otro" },
] as const;

export type LoanDocType = (typeof LOAN_DOC_TYPES)[number]["value"];

export async function uploadLoanDocument(
  loanId: string,
  file: File,
  docType: LoanDocType,
): Promise<{ id: string; path: string }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión no válida");
  const path = `${u.user.id}/${loanId}/${crypto.randomUUID()}-${file.name}`;
  const up = await supabase.storage
    .from("loan-documents")
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      loan_id: loanId,
      owner_id: u.user.id,
      bucket: "loan-documents",
      file_path: path,
      file_name: file.name,
      doc_type: docType,
      size_bytes: file.size,
    })
    .select("id, file_path")
    .single();
  if (error) {
    await supabase.storage.from("loan-documents").remove([path]);
    throw error;
  }
  return { id: data.id, path: data.file_path };
}

export async function deleteLoanDocument(doc: {
  id: string;
  bucket: string | null;
  file_path: string | null;
}): Promise<void> {
  if (doc.bucket && doc.file_path) {
    await supabase.storage.from(doc.bucket).remove([doc.file_path]);
  }
  // borrar también filas extraídas asociadas (cuadro_banco)
  await supabase.from("bank_amortization_rows").delete().eq("document_id", doc.id);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function getDocumentSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("No se pudo generar URL");
  return data.signedUrl;
}

/**
 * Descarga el archivo desde Storage y devuelve una URL `blob:` local.
 * Evita problemas con bloqueadores de contenido (ERR_BLOCKED_BY_CLIENT)
 * que filtran dominios de Supabase, ya que el navegador nunca solicita
 * directamente la URL firmada al abrirla.
 */
export async function getDocumentBlobUrl(
  bucket: string,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("No se pudo descargar el archivo");
  return URL.createObjectURL(data);
}

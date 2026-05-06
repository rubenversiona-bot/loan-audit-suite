import { supabase } from "@/integrations/supabase/client";

export async function deleteLoanCascade(loanId: string): Promise<void> {
  // discrepancies
  {
    const { error } = await supabase.from("discrepancies").delete().eq("loan_id", loanId);
    if (error) throw error;
  }
  // loan_events
  {
    const { error } = await supabase.from("loan_events").delete().eq("loan_id", loanId);
    if (error) throw error;
  }
  // bank_statements (movimientos vinculados se borran al borrar el statement si hay FK; sino, manualmente)
  {
    const { data: stmts } = await supabase
      .from("bank_statements")
      .select("id, file_path")
      .eq("loan_id", loanId);
    if (stmts && stmts.length > 0) {
      const ids = stmts.map((s) => s.id);
      await supabase.from("statement_movements").delete().in("statement_id", ids);
      const paths = stmts.map((s) => s.file_path).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("bank-statements").remove(paths);
      const { error } = await supabase.from("bank_statements").delete().eq("loan_id", loanId);
      if (error) throw error;
    }
  }
  // documents + storage
  {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, bucket, file_path")
      .eq("loan_id", loanId);
    if (docs && docs.length > 0) {
      const byBucket = new Map<string, string[]>();
      for (const d of docs) {
        if (!d.bucket || !d.file_path) continue;
        const arr = byBucket.get(d.bucket) ?? [];
        arr.push(d.file_path);
        byBucket.set(d.bucket, arr);
      }
      for (const [bucket, paths] of byBucket) {
        if (paths.length) await supabase.storage.from(bucket).remove(paths);
      }
      const { error } = await supabase.from("documents").delete().eq("loan_id", loanId);
      if (error) throw error;
    }
  }
  // loan
  {
    const { error } = await supabase.from("loans").delete().eq("id", loanId);
    if (error) throw error;
  }
}

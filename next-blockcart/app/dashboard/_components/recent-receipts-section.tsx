import type { Receipt as ReceiptType } from "@/lib/types"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { fetchRecentReceipts } from "@/lib/supabase/dashboard"
import { RecentReceiptsTable } from "@/components/recent-receipts-table"

function mapStatus(status: string | null): ReceiptType["status"] {
  if (status === "approved" || status === "rejected") {
    return status
  }
  return "pending"
}

function mapReceipt(row: any): ReceiptType {
  const profile = row.profiles ?? row.profile ?? null
  const fullName = profile?.full_name ?? profile?.name ?? null
  const email = profile?.email ?? row.user_email ?? null

  return {
    id: row.id,
    user_id: row.user_id ?? "",
    user_email: email ?? row.user_id ?? "Unknown user",
    user_name: row.user_name ?? fullName ?? email ?? row.user_id ?? "Unknown user",
    image_url: row.image_url ?? "",
    total_amount: Number(row.total ?? row.total_amount ?? 0),
    store_name: row.store ?? row.store_name ?? "Unknown store",
    purchase_date: row.receipt_date ?? row.purchase_date ?? row.created_at ?? new Date().toISOString(),
    status: mapStatus(row.status ?? null),
    reviewer_id: row.reviewed_by ?? row.reviewer_id ?? undefined,
    reviewer_name: row.reviewer_name ?? undefined,
    reviewed_at: row.reviewed_at ?? undefined,
    rejection_reason: row.rejection_reason ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

export async function RecentReceiptsSection() {
  const supabase = await getSupabaseServerClient()
  const rows = await fetchRecentReceipts(supabase)
  const receipts: ReceiptType[] = rows.map(mapReceipt)
  return <RecentReceiptsTable receipts={receipts} />
}

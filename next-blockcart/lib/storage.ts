import type { SupabaseClient } from "@supabase/supabase-js"

const RECEIPT_BUCKET = "receipts"
const SIGNED_URL_TTL_SECONDS = 60 * 60

function extractReceiptObjectPath(imageUrl: string): string | null {
  if (!imageUrl) {
    return null
  }

  const sanitized = imageUrl.split(/[?#]/)[0]
  const bucketPrefix = `${RECEIPT_BUCKET}/`
  const lastIndex = sanitized.lastIndexOf(bucketPrefix)

  if (lastIndex !== -1) {
    const extracted = sanitized.slice(lastIndex + bucketPrefix.length).replace(/^\/+/, "")
    return extracted.length > 0 ? extracted : null
  }

  if (!sanitized.startsWith("http")) {
    const trimmed = sanitized.replace(/^\/+/, "")
    const withoutBucket = trimmed.startsWith(bucketPrefix)
      ? trimmed.slice(bucketPrefix.length)
      : trimmed
    return withoutBucket.length > 0 ? withoutBucket : null
  }

  return null
}

export async function getSignedReceiptUrl(
  supabase: SupabaseClient,
  imageUrl: string | null | undefined,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!imageUrl) {
    return null
  }

  const objectPath = extractReceiptObjectPath(imageUrl)

  if (!objectPath) {
    return imageUrl
  }

  try {
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(objectPath, expiresInSeconds)

    if (error) {
      console.warn("Failed to create signed receipt URL", error)
    }

    if (data?.signedUrl) {
      return data.signedUrl
    }
  } catch (error) {
    console.warn("Unexpected error while creating signed receipt URL", error)
  }

  const { data: publicData } = supabase.storage
    .from(RECEIPT_BUCKET)
    .getPublicUrl(objectPath)

  return publicData?.publicUrl ?? imageUrl
}


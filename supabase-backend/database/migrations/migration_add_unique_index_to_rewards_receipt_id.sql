-- Remove duplicate rewards records based on receipt_id, keeping the lowest id
DELETE FROM public.rewards r
USING public.rewards dup
WHERE r.id > dup.id
  AND r.receipt_id IS NOT NULL
  AND dup.receipt_id IS NOT NULL
  AND r.receipt_id = dup.receipt_id;

-- Enforce uniqueness of receipt_id within rewards
CREATE UNIQUE INDEX IF NOT EXISTS rewards_receipt_id_key ON public.rewards(receipt_id);

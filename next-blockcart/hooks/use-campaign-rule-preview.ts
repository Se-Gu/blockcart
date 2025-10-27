"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignRule } from "@/lib/types";
import { buildCampaignRulePayload, stableStringify } from "@/lib/campaign-rules";
import type { CampaignRuleFormState } from "@/lib/campaign-rules";

export interface CampaignRulePreviewResult {
  eligible_receipts: number;
  eligible_users: number;
  total_receipts: number;
  total_users: number;
}

interface UseCampaignRulePreviewOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useCampaignRulePreview(
  supabase: SupabaseClient,
  form: CampaignRuleFormState,
  extras: Record<string, unknown>,
  { debounceMs = 500, enabled = true }: UseCampaignRulePreviewOptions = {}
) {
  const [preview, setPreview] = useState<CampaignRulePreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: CampaignRule = useMemo(
    () => buildCampaignRulePayload(form, extras),
    [form, extras]
  );

  const payloadKey = useMemo(() => stableStringify(payload), [payload]);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("preview_campaign_rule", {
        rule: payload as Record<string, unknown>,
      });

      if (!isCurrent) {
        return;
      }

      if (rpcError) {
        console.error("Failed to preview campaign rule", rpcError);
        setError(rpcError.message);
        setPreview(null);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setPreview({
            eligible_receipts: Number(row.eligible_receipts ?? 0),
            eligible_users: Number(row.eligible_users ?? 0),
            total_receipts: Number(row.total_receipts ?? 0),
            total_users: Number(row.total_users ?? 0),
          });
        } else {
          setPreview({ eligible_receipts: 0, eligible_users: 0, total_receipts: 0, total_users: 0 });
        }
      }

      setIsLoading(false);
    }, debounceMs);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [supabase, payloadKey, debounceMs, payload, enabled]);

  return { preview, isLoading, error };
}

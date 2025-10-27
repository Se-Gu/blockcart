"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Campaign } from "@/lib/types";
import {
  CAMPAIGN_RULE_TEMPLATES,
  applyTemplateToForm,
  buildCampaignRulePayload,
  cloneRuleFormState,
  createDraftFromCampaign,
  defaultRuleFormState,
  type CampaignRuleFormState,
  type CampaignRuleTemplate,
} from "@/lib/campaign-rules";
import { CampaignRuleBuilder } from "@/components/campaign-rule-builder";
import { useCampaignRulePreview } from "@/hooks/use-campaign-rule-preview";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface CampaignFormDialogProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (campaign: Partial<Campaign>) => Promise<void> | void;
  storeOptions: string[];
  supabaseClient?: SupabaseClient;
  templates?: CampaignRuleTemplate[];
}

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.split("T")[0] ?? "";
  }
  return date.toISOString().slice(0, 10);
}

export function CampaignFormDialog({
  campaign,
  open,
  onOpenChange,
  onSave,
  storeOptions,
  supabaseClient,
  templates = CAMPAIGN_RULE_TEMPLATES,
}: CampaignFormDialogProps) {
  const supabase = useMemo(() => supabaseClient ?? getSupabaseBrowserClient(), [supabaseClient]);

  const [formData, setFormData] = useState({
    brand: "",
    multiplier: "1",
    start_date: "",
    end_date: "",
  });
  const [ruleForm, setRuleForm] = useState<CampaignRuleFormState>(() =>
    defaultRuleFormState()
  );
  const [ruleExtras, setRuleExtras] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (campaign && open) {
      const draft = createDraftFromCampaign(campaign);
      setFormData({
        brand: campaign.brand ?? "",
        multiplier: campaign.multiplier != null ? String(campaign.multiplier) : "1",
        start_date: normalizeDateInput(campaign.start_date),
        end_date: normalizeDateInput(campaign.end_date),
      });
      setRuleForm(cloneRuleFormState(draft.form));
      setRuleExtras({ ...draft.extras });
    } else if (open) {
      setFormData({ brand: "", multiplier: "1", start_date: "", end_date: "" });
      setRuleForm(defaultRuleFormState());
      setRuleExtras({});
    }
  }, [campaign, open]);

  const { preview, isLoading: previewLoading } = useCampaignRulePreview(
    supabase,
    ruleForm,
    ruleExtras,
    { enabled: open }
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const multiplierValue = Number.parseFloat(formData.multiplier);
    const normalizedMultiplier = Number.isFinite(multiplierValue) ? multiplierValue : 1;

    const campaignData: Partial<Campaign> = {
      brand: formData.brand.trim(),
      multiplier: normalizedMultiplier,
      rule_json: buildCampaignRulePayload(ruleForm, ruleExtras),
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    if (campaign?.id) {
      campaignData.id = campaign.id;
    }

    try {
      await onSave?.(campaignData);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save campaign", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
              placeholder="Blockcart Fresh"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="multiplier">Multiplier</Label>
              <Input
                id="multiplier"
                type="number"
                step="0.01"
                min="0"
                value={formData.multiplier}
                onChange={(e) => setFormData((prev) => ({ ...prev, multiplier: e.target.value }))}
                placeholder="1.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label>Campaign rules</Label>
            <CampaignRuleBuilder
              value={ruleForm}
              onChange={setRuleForm}
              storeOptions={storeOptions}
              templates={templates}
              onApplyTemplate={(template) => {
                const draft = applyTemplateToForm(template, ruleExtras);
                setRuleForm(cloneRuleFormState(draft.form));
                setRuleExtras({ ...draft.extras });
              }}
              preview={preview}
              previewLoading={previewLoading}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : campaign ? "Update Campaign" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

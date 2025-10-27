"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignFormDialog } from "@/components/campaign-form-dialog";
import type { Campaign } from "@/lib/types";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildCampaignRulePayload,
  cloneRuleFormState,
  createDraftFromCampaign as createRuleDraft,
  stableStringify,
  CAMPAIGN_RULE_TEMPLATES,
  applyTemplateToForm,
  type CampaignRuleFormState,
} from "@/lib/campaign-rules";
import type { CampaignRuleTemplate } from "@/lib/campaign-rules";
import { CampaignRuleBuilder } from "@/components/campaign-rule-builder";
import { useCampaignRulePreview } from "@/hooks/use-campaign-rule-preview";

type CampaignStatus = "active" | "inactive" | "completed";

type CampaignWithStatus = Campaign & { status: CampaignStatus };

type CampaignDraft = {
  brand: string;
  multiplier: string;
  start_date: string;
  end_date: string;
  ruleForm: CampaignRuleFormState;
  ruleExtras: Record<string, unknown>;
};

type CampaignEligibilitySnapshot = {
  campaign_id: string;
  eligible_receipts: number;
  eligible_users: number;
  total_receipts: number;
  total_users: number;
  calculated_at: string | null;
};

function computeCampaignStatus(campaign: Campaign): CampaignStatus {
  const now = new Date();
  const start = campaign.start_date ? new Date(campaign.start_date) : null;
  const end = campaign.end_date ? new Date(campaign.end_date) : null;

  if (start && start > now) {
    return "inactive";
  }

  if (end && end < now) {
    return "completed";
  }

  return "active";
}

function formatDate(value: string | null, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
}

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.split("T")[0] ?? "";
  }
  return date.toISOString().slice(0, 10);
}

function sanitizeCampaign(entry: any): Campaign {
  return {
    id: String(entry.id),
    brand: String(entry.brand ?? "Untitled Campaign"),
    multiplier: Number.isFinite(Number(entry.multiplier))
      ? Number(entry.multiplier)
      : 1,
    rule_json: entry.rule_json ?? null,
    start_date: entry.start_date ?? null,
    end_date: entry.end_date ?? null,
    updated_at: entry.updated_at ?? null,
    version: typeof entry.version === "number" ? entry.version : null,
  };
}

function createDraftFromCampaign(campaign: Campaign): CampaignDraft {
  const ruleDraft = createRuleDraft(campaign);
  return {
    brand: campaign.brand ?? "",
    multiplier: campaign.multiplier != null ? String(campaign.multiplier) : "1",
    start_date: normalizeDateInput(campaign.start_date),
    end_date: normalizeDateInput(campaign.end_date),
    ruleForm: cloneRuleFormState(ruleDraft.form),
    ruleExtras: { ...ruleDraft.extras },
  };
}

function hasDraftChanges(draft: CampaignDraft, campaign: Campaign) {
  const normalizedMultiplier = Number.isFinite(Number(draft.multiplier))
    ? Number(draft.multiplier)
    : campaign.multiplier;
  const draftRulePayload = buildCampaignRulePayload(
    draft.ruleForm,
    draft.ruleExtras
  );
  const campaignRulePayload = campaign.rule_json ?? {};

  return (
    draft.brand.trim() !== campaign.brand ||
    normalizedMultiplier !== campaign.multiplier ||
    draft.start_date !== normalizeDateInput(campaign.start_date) ||
    draft.end_date !== normalizeDateInput(campaign.end_date) ||
    stableStringify(draftRulePayload) !== stableStringify(campaignRulePayload)
  );
}

function sortCampaignsByUpdatedAt(list: Campaign[]): Campaign[] {
  return [...list].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });
}

function extractVersion(campaign: Campaign): number | null {
  if (typeof campaign.version === "number") {
    return campaign.version;
  }
  const ruleJson = campaign.rule_json as Record<string, unknown> | null;
  const ruleVersion = ruleJson?.version;
  return typeof ruleVersion === "number" ? ruleVersion : null;
}

interface CampaignRowProps {
  campaign: CampaignWithStatus;
  draft: CampaignDraft;
  onDraftChange: (campaignId: string, field: keyof CampaignDraft, value: string) => void;
  onRuleChange: (campaignId: string, form: CampaignRuleFormState) => void;
  onTemplateApply: (campaignId: string, template: CampaignRuleTemplate) => void;
  onAutoSave: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
  saving: boolean;
  supabase: SupabaseClient;
  storeOptions: string[];
  templates: CampaignRuleTemplate[];
  eligibility?: CampaignEligibilitySnapshot | null;
}

function CampaignRow({
  campaign,
  draft,
  onDraftChange,
  onRuleChange,
  onTemplateApply,
  onAutoSave,
  onDelete,
  saving,
  supabase,
  storeOptions,
  templates,
  eligibility,
}: CampaignRowProps) {
  const { preview, isLoading: previewLoading } = useCampaignRulePreview(
    supabase,
    draft.ruleForm,
    draft.ruleExtras
  );

  const version = extractVersion(campaign);
  const statusVariants: Record<CampaignStatus, string> = {
    active: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    inactive: "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20",
    completed: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  };

  const statusBadge = campaign.status ? (
    <Badge variant="secondary" className={statusVariants[campaign.status]}>
      {campaign.status}
    </Badge>
  ) : null;

  return (
    <TableRow key={campaign.id} className="hover:bg-muted/50">
      <TableCell className="align-top">
        <div className="space-y-2">
          <Input
            value={draft.brand}
            placeholder="Campaign brand"
            onChange={(event) => onDraftChange(campaign.id, "brand", event.target.value)}
            onBlur={() => onAutoSave(campaign.id)}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {version ? (
              <Badge variant="secondary" className="bg-muted text-xs font-normal">
                v{version}
              </Badge>
            ) : null}
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {campaign.id.slice(0, 8)}…
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <CampaignRuleBuilder
          value={draft.ruleForm}
          onChange={(next) => onRuleChange(campaign.id, next)}
          onCommit={() => onAutoSave(campaign.id)}
          storeOptions={storeOptions}
          templates={templates}
          onApplyTemplate={(template) => {
            onTemplateApply(campaign.id, template);
            onAutoSave(campaign.id);
          }}
          preview={preview}
          previewLoading={previewLoading}
          layout="inline"
        />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <Input
            type="date"
            value={draft.start_date}
            onChange={(event) => onDraftChange(campaign.id, "start_date", event.target.value)}
            onBlur={() => onAutoSave(campaign.id)}
          />
          <Input
            type="date"
            value={draft.end_date}
            onChange={(event) => onDraftChange(campaign.id, "end_date", event.target.value)}
            onBlur={() => onAutoSave(campaign.id)}
          />
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={draft.multiplier}
          onChange={(event) => onDraftChange(campaign.id, "multiplier", event.target.value)}
          onBlur={() => onAutoSave(campaign.id)}
        />
      </TableCell>
      <TableCell className="align-top">
        {eligibility ? (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">{eligibility.eligible_users}</span>
              {" / "}
              {eligibility.total_users}
              {" users"}
            </p>
            <p>
              <span className="font-medium text-foreground">{eligibility.eligible_receipts}</span>
              {" / "}
              {eligibility.total_receipts}
              {" receipts"}
            </p>
            {eligibility.calculated_at ? (
              <p>as of {new Date(eligibility.calculated_at).toLocaleString()}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Snapshot unavailable</p>
        )}
      </TableCell>
      <TableCell className="align-top">{statusBadge}</TableCell>
      <TableCell className="align-top">
        <div className="text-sm">
          <p>{campaign.updated_at ? formatDate(campaign.updated_at) : "—"}</p>
          {campaign.updated_at ? (
            <p className="text-xs text-muted-foreground">
              {new Date(campaign.updated_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {saving ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right align-top">
        <Button variant="ghost" size="icon" onClick={() => onDelete(campaign.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function CampaignsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [draftCampaigns, setDraftCampaigns] = useState<
    Record<string, CampaignDraft>
  >({});
  const [savingCampaigns, setSavingCampaigns] = useState<
    Record<string, boolean>
  >({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [storeOptions, setStoreOptions] = useState<string[]>([]);
  const [eligibilitySnapshots, setEligibilitySnapshots] = useState<
    Record<string, CampaignEligibilitySnapshot>
  >({});
  const templates = useMemo(() => CAMPAIGN_RULE_TEMPLATES, []);

  const fetchEligibilitySnapshots = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaign_eligibility_snapshots")
      .select(
        "campaign_id, eligible_receipts, eligible_users, total_receipts, total_users, calculated_at"
      );

    if (error) {
      console.error("Failed to fetch eligibility snapshots", error);
      return;
    }

    const mapped = (data ?? []).reduce<Record<string, CampaignEligibilitySnapshot>>(
      (acc, entry) => {
        if (!entry?.campaign_id) return acc;
        acc[entry.campaign_id] = {
          campaign_id: entry.campaign_id,
          eligible_receipts: Number(entry.eligible_receipts ?? 0),
          eligible_users: Number(entry.eligible_users ?? 0),
          total_receipts: Number(entry.total_receipts ?? 0),
          total_users: Number(entry.total_users ?? 0),
          calculated_at: entry.calculated_at ?? null,
        };
        return acc;
      },
      {}
    );

    setEligibilitySnapshots(mapped);
  }, [supabase]);

  const refreshEligibilityForCampaign = useCallback(
    async (campaignId: string) => {
      const { data, error } = await supabase
        .from("campaign_eligibility_snapshots")
        .select(
          "campaign_id, eligible_receipts, eligible_users, total_receipts, total_users, calculated_at"
        )
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (error) {
        console.error("Failed to refresh eligibility snapshot", error);
        return;
      }

      if (!data) {
        setEligibilitySnapshots((previous) => {
          const { [campaignId]: _removed, ...rest } = previous;
          return rest;
        });
        return;
      }

      setEligibilitySnapshots((previous) => ({
        ...previous,
        [campaignId]: {
          campaign_id: data.campaign_id,
          eligible_receipts: Number(data.eligible_receipts ?? 0),
          eligible_users: Number(data.eligible_users ?? 0),
          total_receipts: Number(data.total_receipts ?? 0),
          total_users: Number(data.total_users ?? 0),
          calculated_at: data.calculated_at ?? null,
        },
      }));
    },
    [supabase]
  );

  const fetchStoreOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaign_available_stores")
      .select("store_name")
      .order("store_name", { ascending: true });

    if (error) {
      console.error("Failed to load store options", error);
      return;
    }

    const stores = (data ?? [])
      .map((entry) => (entry?.store_name ? String(entry.store_name) : null))
      .filter((value): value is string => Boolean(value));

    setStoreOptions(stores);
  }, [supabase]);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, brand, multiplier, rule_json, start_date, end_date, updated_at, version"
      )
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Failed to fetch campaigns", error);
      toast.error("Failed to load campaigns", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    const sanitized: Campaign[] = (data ?? []).map((entry: any) =>
      sanitizeCampaign(entry)
    );
    const drafts = sanitized.reduce<Record<string, CampaignDraft>>(
      (acc, campaign) => {
        acc[campaign.id] = createDraftFromCampaign(campaign);
        return acc;
      },
      {}
    );

    setCampaigns(sanitized);
    setDraftCampaigns(drafts);
    setIsLoading(false);
    await fetchEligibilitySnapshots();
  }, [supabase, fetchEligibilitySnapshots]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    fetchStoreOptions();
  }, [fetchStoreOptions]);

  const handleSave = useCallback(
    async (campaignData: Partial<Campaign>) => {
      const payload = {
        brand: campaignData.brand?.trim(),
        multiplier:
          typeof campaignData.multiplier === "number" &&
          Number.isFinite(campaignData.multiplier)
            ? campaignData.multiplier
            : 1,
        rule_json: campaignData.rule_json ?? null,
        start_date: campaignData.start_date ?? null,
        end_date: campaignData.end_date ?? null,
      };

      if (!payload.brand) {
        toast.error("Campaign brand is required");
        throw new Error("Campaign brand is required");
      }

      const rpcName = campaignData.id ? "update_campaign" : "create_campaign";
      const { data, error } = await supabase.rpc(rpcName, {
        campaign_id: campaignData.id ?? null,
        campaign_data: payload,
      });

      if (error) {
        console.error(
          `Failed to ${campaignData.id ? "update" : "create"} campaign`,
          error
        );
        toast.error(
          `Unable to ${campaignData.id ? "update" : "create"} campaign`,
          {
            description: error.message,
          }
        );
        throw new Error(error.message);
      }

      const returned = Array.isArray(data) ? data?.[0] : data;
      if (!returned) {
        await fetchCampaigns();
        return;
      }

      const updatedCampaign = sanitizeCampaign(returned);

      setCampaigns((previous) => {
        const withoutCurrent = previous.filter(
          (item) => item.id !== updatedCampaign.id
        );
        return sortCampaignsByUpdatedAt([updatedCampaign, ...withoutCurrent]);
      });

      setDraftCampaigns((previous) => ({
        ...previous,
        [updatedCampaign.id]: createDraftFromCampaign(updatedCampaign),
      }));

      setSavingCampaigns((previous) => ({
        ...previous,
        [updatedCampaign.id]: false,
      }));

      await refreshEligibilityForCampaign(updatedCampaign.id);

      toast.success(`Campaign ${campaignData.id ? "updated" : "created"}`);
    },
    [fetchCampaigns, refreshEligibilityForCampaign, supabase]
  );

  const handleDraftChange = useCallback(
    (campaignId: string, field: keyof CampaignDraft, value: string) => {
      const campaign = campaigns.find((item) => item.id === campaignId);
      if (!campaign) return;

      setDraftCampaigns((previous) => {
        const currentDraft =
          previous[campaignId] ?? createDraftFromCampaign(campaign);
        return {
          ...previous,
          [campaignId]: {
            ...currentDraft,
            [field]: value,
          },
        };
      });
    },
    [campaigns]
  );

  const handleRuleDraftChange = useCallback(
    (campaignId: string, nextForm: CampaignRuleFormState) => {
      setDraftCampaigns((previous) => {
        const campaign = campaigns.find((item) => item.id === campaignId);
        const baseDraft =
          previous[campaignId] ?? (campaign ? createDraftFromCampaign(campaign) : null);
        if (!baseDraft) return previous;
        return {
          ...previous,
          [campaignId]: {
            ...baseDraft,
            ruleForm: cloneRuleFormState(nextForm),
          },
        };
      });
    },
    [campaigns]
  );

  const handleTemplateApply = useCallback(
    (campaignId: string, template: CampaignRuleTemplate) => {
      setDraftCampaigns((previous) => {
        const campaign = campaigns.find((item) => item.id === campaignId);
        const baseDraft =
          previous[campaignId] ?? (campaign ? createDraftFromCampaign(campaign) : null);
        if (!baseDraft) return previous;
        const applied = applyTemplateToForm(template, baseDraft.ruleExtras);
        return {
          ...previous,
          [campaignId]: {
            ...baseDraft,
            ruleForm: cloneRuleFormState(applied.form),
            ruleExtras: { ...applied.extras },
          },
        };
      });
    },
    [campaigns]
  );

  const handleInlineBlur = useCallback(
    async (campaignId: string) => {
      const campaign = campaigns.find((item) => item.id === campaignId);
      const draft = draftCampaigns[campaignId];

      if (!campaign || !draft) return;

      if (!hasDraftChanges(draft, campaign)) {
        return;
      }

      if (!draft.brand.trim()) {
        toast.error("Campaign brand is required");
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }));
        return;
      }

      const multiplierValue = Number.parseFloat(draft.multiplier);
      const normalizedMultiplier = Number.isFinite(multiplierValue)
        ? multiplierValue
        : campaign.multiplier;

      if (normalizedMultiplier <= 0) {
        toast.error("Multiplier must be greater than zero");
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }));
        return;
      }

      const payload = {
        brand: draft.brand.trim(),
        multiplier: normalizedMultiplier,
        rule_json: buildCampaignRulePayload(draft.ruleForm, draft.ruleExtras),
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
      };

      setSavingCampaigns((previous) => ({ ...previous, [campaignId]: true }));

      const { data, error } = await supabase.rpc("update_campaign", {
        campaign_id: campaignId,
        campaign_data: payload,
      });

      setSavingCampaigns((previous) => ({ ...previous, [campaignId]: false }));

      if (error) {
        console.error("Failed to update campaign", error);
        toast.error("Unable to update campaign", {
          description: error.message,
        });
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }));
        return;
      }

      const returned = Array.isArray(data) ? data?.[0] : data;

      if (!returned) {
        await fetchCampaigns();
        return;
      }

      const updatedCampaign = sanitizeCampaign(returned);

      setCampaigns((previous) => {
        const withoutCurrent = previous.filter(
          (item) => item.id !== campaignId
        );
        return sortCampaignsByUpdatedAt([updatedCampaign, ...withoutCurrent]);
      });

      setDraftCampaigns((previous) => ({
        ...previous,
        [campaignId]: createDraftFromCampaign(updatedCampaign),
      }));

      await refreshEligibilityForCampaign(campaignId);

      toast.success("Campaign updated");
    },
    [campaigns, draftCampaigns, fetchCampaigns, refreshEligibilityForCampaign, supabase]
  );

  const queueInlineSave = useCallback(
    (campaignId: string) => {
      if (typeof window === "undefined") {
        void handleInlineBlur(campaignId);
        return;
      }

      window.setTimeout(() => {
        void handleInlineBlur(campaignId);
      }, 0);
    },
    [handleInlineBlur]
  );

  const handleDelete = useCallback(
    async (campaignId: string) => {
      if (!confirm("Are you sure you want to delete this campaign?")) return;

      const { error } = await supabase.rpc("delete_campaign", {
        campaign_id: campaignId,
      });

      if (error) {
        console.error("Failed to delete campaign", error);
        toast.error("Unable to delete campaign", {
          description: error.message,
        });
        return;
      }

      toast.success("Campaign deleted");
      setCampaigns((previous) =>
        previous.filter((campaign) => campaign.id !== campaignId)
      );
      setDraftCampaigns((previous) => {
        const { [campaignId]: _removed, ...rest } = previous;
        return rest;
      });
      setSavingCampaigns((previous) => {
        const { [campaignId]: _removed, ...rest } = previous;
        return rest;
      });
      setEligibilitySnapshots((previous) => {
        const { [campaignId]: _removedSnapshot, ...rest } = previous;
        return rest;
      });
    },
    [supabase]
  );

  const filteredCampaigns: CampaignWithStatus[] = campaigns
    .map((campaign) => ({
      ...campaign,
      status: computeCampaignStatus(campaign),
    }))
    .filter((campaign) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        campaign.brand.toLowerCase().includes(query) ||
        JSON.stringify(campaign.rule_json ?? {})
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reward campaigns
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as CampaignStatus | "all")
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Multiplier</TableHead>
              <TableHead>Eligibility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground h-32"
                >
                  Loading campaigns...
                </TableCell>
              </TableRow>
            ) : filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground h-32"
                >
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => {
                const draft =
                  draftCampaigns[campaign.id] ??
                  createDraftFromCampaign(campaign);
                return (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    draft={draft}
                    onDraftChange={handleDraftChange}
                    onRuleChange={handleRuleDraftChange}
                    onTemplateApply={handleTemplateApply}
                    onAutoSave={queueInlineSave}
                    onDelete={handleDelete}
                    saving={Boolean(savingCampaigns[campaign.id])}
                    supabase={supabase}
                    storeOptions={storeOptions}
                    templates={templates}
                    eligibility={eligibilitySnapshots[campaign.id]}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Campaign Form Dialog */}
      <CampaignFormDialog
        campaign={null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        storeOptions={storeOptions}
        supabaseClient={supabase}
        templates={templates}
      />
    </div>
  );
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search, Plus, Trash2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CampaignFormDialog } from "@/components/campaign-form-dialog"
import type { Campaign } from "@/lib/types"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Textarea } from "@/components/ui/textarea"

type CampaignStatus = "active" | "inactive" | "completed"

type CampaignWithStatus = Campaign & { status: CampaignStatus }

type CampaignDraft = {
  brand: string
  multiplier: string
  start_date: string
  end_date: string
  ruleJsonText: string
}

function computeCampaignStatus(campaign: Campaign): CampaignStatus {
  const now = new Date()
  const start = campaign.start_date ? new Date(campaign.start_date) : null
  const end = campaign.end_date ? new Date(campaign.end_date) : null

  if (start && start > now) {
    return "inactive"
  }

  if (end && end < now) {
    return "completed"
  }

  return "active"
}

function formatDate(value: string | null, fallback = "—") {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString()
}

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.split("T")[0] ?? ""
  }
  return date.toISOString().slice(0, 10)
}

function stringifyRuleJson(rule: Record<string, unknown> | null | undefined): string {
  if (!rule) return ""
  try {
    return JSON.stringify(rule, null, 2)
  } catch (error) {
    console.error("Failed to stringify rule_json", error)
    return String(rule)
  }
}

function sanitizeCampaign(entry: any): Campaign {
  return {
    id: String(entry.id),
    brand: String(entry.brand ?? "Untitled Campaign"),
    multiplier: Number.isFinite(Number(entry.multiplier)) ? Number(entry.multiplier) : 1,
    rule_json: entry.rule_json ?? null,
    start_date: entry.start_date ?? null,
    end_date: entry.end_date ?? null,
    updated_at: entry.updated_at ?? null,
    version: typeof entry.version === "number" ? entry.version : null,
  }
}

function createDraftFromCampaign(campaign: Campaign): CampaignDraft {
  return {
    brand: campaign.brand ?? "",
    multiplier: campaign.multiplier != null ? String(campaign.multiplier) : "1",
    start_date: normalizeDateInput(campaign.start_date),
    end_date: normalizeDateInput(campaign.end_date),
    ruleJsonText: stringifyRuleJson(campaign.rule_json as Record<string, unknown> | null),
  }
}

function hasDraftChanges(draft: CampaignDraft, campaign: Campaign) {
  const normalizedMultiplier = Number.isFinite(Number(draft.multiplier))
    ? Number(draft.multiplier)
    : campaign.multiplier

  const draftRuleText = draft.ruleJsonText.trim()
  const campaignRuleText = stringifyRuleJson(campaign.rule_json as Record<string, unknown> | null).trim()

  return (
    draft.brand.trim() !== campaign.brand ||
    normalizedMultiplier !== campaign.multiplier ||
    draft.start_date !== normalizeDateInput(campaign.start_date) ||
    draft.end_date !== normalizeDateInput(campaign.end_date) ||
    draftRuleText !== campaignRuleText
  )
}

function sortCampaignsByUpdatedAt(list: Campaign[]): Campaign[] {
  return [...list].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return bTime - aTime
  })
}

function extractVersion(campaign: Campaign): number | null {
  if (typeof campaign.version === "number") {
    return campaign.version
  }
  const ruleJson = campaign.rule_json as Record<string, unknown> | null
  const ruleVersion = ruleJson?.version
  return typeof ruleVersion === "number" ? ruleVersion : null
}

export default function CampaignsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [draftCampaigns, setDraftCampaigns] = useState<Record<string, CampaignDraft>>({})
  const [savingCampaigns, setSavingCampaigns] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all")
  const [isLoading, setIsLoading] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true)

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, brand, multiplier, rule_json, start_date, end_date, updated_at, version")
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("Failed to fetch campaigns", error)
      toast.error("Failed to load campaigns", {
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    const sanitized: Campaign[] = (data ?? []).map((entry: any) => sanitizeCampaign(entry))
    const drafts = sanitized.reduce<Record<string, CampaignDraft>>((acc, campaign) => {
      acc[campaign.id] = createDraftFromCampaign(campaign)
      return acc
    }, {})

    setCampaigns(sanitized)
    setDraftCampaigns(drafts)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleSave = useCallback(
    async (campaignData: Partial<Campaign>) => {
      const payload = {
        brand: campaignData.brand?.trim(),
        multiplier:
          typeof campaignData.multiplier === "number" && Number.isFinite(campaignData.multiplier)
            ? campaignData.multiplier
            : 1,
        rule_json: campaignData.rule_json ?? null,
        start_date: campaignData.start_date ?? null,
        end_date: campaignData.end_date ?? null,
      }

      if (!payload.brand) {
        toast.error("Campaign brand is required")
        throw new Error("Campaign brand is required")
      }

      const rpcName = campaignData.id ? "update_campaign" : "create_campaign"
      const { data, error } = await supabase.rpc(rpcName, {
        campaign_id: campaignData.id ?? null,
        campaign_data: payload,
      })

      if (error) {
        console.error(`Failed to ${campaignData.id ? "update" : "create"} campaign`, error)
        toast.error(`Unable to ${campaignData.id ? "update" : "create"} campaign`, {
          description: error.message,
        })
        throw new Error(error.message)
      }

      const returned = Array.isArray(data) ? data?.[0] : data
      if (!returned) {
        await fetchCampaigns()
        return
      }

      const updatedCampaign = sanitizeCampaign(returned)

      setCampaigns((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== updatedCampaign.id)
        return sortCampaignsByUpdatedAt([updatedCampaign, ...withoutCurrent])
      })

      setDraftCampaigns((previous) => ({
        ...previous,
        [updatedCampaign.id]: createDraftFromCampaign(updatedCampaign),
      }))

      setSavingCampaigns((previous) => ({
        ...previous,
        [updatedCampaign.id]: false,
      }))

      toast.success(`Campaign ${campaignData.id ? "updated" : "created"}`)
    },
    [fetchCampaigns, supabase],
  )

  const handleDraftChange = useCallback(
    (campaignId: string, field: keyof CampaignDraft, value: string) => {
      const campaign = campaigns.find((item) => item.id === campaignId)
      if (!campaign) return

      setDraftCampaigns((previous) => {
        const currentDraft = previous[campaignId] ?? createDraftFromCampaign(campaign)
        return {
          ...previous,
          [campaignId]: {
            ...currentDraft,
            [field]: value,
          },
        }
      })
    },
    [campaigns],
  )

  const handleInlineBlur = useCallback(
    async (campaignId: string) => {
      const campaign = campaigns.find((item) => item.id === campaignId)
      const draft = draftCampaigns[campaignId]

      if (!campaign || !draft) return

      if (!hasDraftChanges(draft, campaign)) {
        return
      }

      if (!draft.brand.trim()) {
        toast.error("Campaign brand is required")
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }))
        return
      }

      const multiplierValue = Number.parseFloat(draft.multiplier)
      const normalizedMultiplier = Number.isFinite(multiplierValue) ? multiplierValue : campaign.multiplier

      if (normalizedMultiplier <= 0) {
        toast.error("Multiplier must be greater than zero")
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }))
        return
      }

      let parsedRuleJson: Record<string, unknown> | null = null
      const trimmedRule = draft.ruleJsonText.trim()

      if (trimmedRule.length > 0) {
        try {
          const candidate = JSON.parse(trimmedRule)

          if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") {
            throw new Error("rule_json must be a JSON object")
          }

          parsedRuleJson = candidate as Record<string, unknown>
        } catch (error) {
          toast.error("Invalid campaign rules", {
            description: error instanceof Error ? error.message : String(error),
          })
          setDraftCampaigns((previous) => ({
            ...previous,
            [campaignId]: createDraftFromCampaign(campaign),
          }))
          return
        }
      }

      const payload = {
        brand: draft.brand.trim(),
        multiplier: normalizedMultiplier,
        rule_json: parsedRuleJson,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
      }

      setSavingCampaigns((previous) => ({ ...previous, [campaignId]: true }))

      const { data, error } = await supabase.rpc("update_campaign", {
        campaign_id: campaignId,
        campaign_data: payload,
      })

      setSavingCampaigns((previous) => ({ ...previous, [campaignId]: false }))

      if (error) {
        console.error("Failed to update campaign", error)
        toast.error("Unable to update campaign", { description: error.message })
        setDraftCampaigns((previous) => ({
          ...previous,
          [campaignId]: createDraftFromCampaign(campaign),
        }))
        return
      }

      const returned = Array.isArray(data) ? data?.[0] : data

      if (!returned) {
        await fetchCampaigns()
        return
      }

      const updatedCampaign = sanitizeCampaign(returned)

      setCampaigns((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== campaignId)
        return sortCampaignsByUpdatedAt([updatedCampaign, ...withoutCurrent])
      })

      setDraftCampaigns((previous) => ({
        ...previous,
        [campaignId]: createDraftFromCampaign(updatedCampaign),
      }))

      toast.success("Campaign updated")
    },
    [campaigns, draftCampaigns, fetchCampaigns, supabase],
  )

  const handleDelete = useCallback(
    async (campaignId: string) => {
      if (!confirm("Are you sure you want to delete this campaign?")) return

      const { error } = await supabase.rpc("delete_campaign", { campaign_id: campaignId })

      if (error) {
        console.error("Failed to delete campaign", error)
        toast.error("Unable to delete campaign", {
          description: error.message,
        })
        return
      }

      toast.success("Campaign deleted")
      setCampaigns((previous) => previous.filter((campaign) => campaign.id !== campaignId))
      setDraftCampaigns((previous) => {
        const { [campaignId]: _removed, ...rest } = previous
        return rest
      })
      setSavingCampaigns((previous) => {
        const { [campaignId]: _removed, ...rest } = previous
        return rest
      })
    },
    [supabase],
  )

  const filteredCampaigns: CampaignWithStatus[] = campaigns
    .map((campaign) => ({
      ...campaign,
      status: computeCampaignStatus(campaign),
    }))
    .filter((campaign) => {
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        query.length === 0 ||
        campaign.brand.toLowerCase().includes(query) ||
        JSON.stringify(campaign.rule_json ?? {})
          .toLowerCase()
          .includes(query)

      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter

      return matchesSearch && matchesStatus
    })

  const getStatusBadge = (status: CampaignStatus) => {
    const variants: Record<CampaignStatus, string> = {
      active: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
      inactive: "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20",
      completed: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Create and manage reward campaigns</p>
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

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CampaignStatus | "all")}>
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
              <TableHead>Status</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                  Loading campaigns...
                </TableCell>
              </TableRow>
            ) : filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => {
                const draft = draftCampaigns[campaign.id] ?? createDraftFromCampaign(campaign)
                return (
                  <TableRow key={campaign.id} className="hover:bg-muted/50">
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <Input
                          value={draft.brand}
                          placeholder="Campaign brand"
                          onChange={(event) => handleDraftChange(campaign.id, "brand", event.target.value)}
                          onBlur={() => handleInlineBlur(campaign.id)}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {(() => {
                            const version = extractVersion(campaign)
                            return version ? (
                              <Badge variant="secondary" className="bg-muted text-xs font-normal">
                                v{version}
                              </Badge>
                            ) : null
                          })()}
                          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {campaign.id.slice(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Textarea
                        value={draft.ruleJsonText}
                        onChange={(event) => handleDraftChange(campaign.id, "ruleJsonText", event.target.value)}
                        onBlur={() => handleInlineBlur(campaign.id)}
                        spellCheck={false}
                        rows={6}
                        className="font-mono text-xs"
                        placeholder="{\n  \"version\": 1\n}"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">Updates save automatically on blur.</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <Input
                          type="date"
                          value={draft.start_date}
                          onChange={(event) => handleDraftChange(campaign.id, "start_date", event.target.value)}
                          onBlur={() => handleInlineBlur(campaign.id)}
                        />
                        <Input
                          type="date"
                          value={draft.end_date}
                          onChange={(event) => handleDraftChange(campaign.id, "end_date", event.target.value)}
                          onBlur={() => handleInlineBlur(campaign.id)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.multiplier}
                        onChange={(event) => handleDraftChange(campaign.id, "multiplier", event.target.value)}
                        onBlur={() => handleInlineBlur(campaign.id)}
                      />
                    </TableCell>
                    <TableCell className="align-top">{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{campaign.updated_at ? formatDate(campaign.updated_at) : "—"}</p>
                        {campaign.updated_at ? (
                          <p className="text-xs text-muted-foreground">
                            {new Date(campaign.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        ) : null}
                        {savingCampaigns[campaign.id] ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
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
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CampaignFormDialog } from "@/components/campaign-form-dialog"
import type { Campaign } from "@/lib/types"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type CampaignStatus = "active" | "inactive" | "completed"

type CampaignWithStatus = Campaign & { status: CampaignStatus }

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
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
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

    const sanitized: Campaign[] = (data ?? []).map((entry: any) => ({
      id: String(entry.id),
      brand: String(entry.brand ?? "Untitled Campaign"),
      multiplier: Number.isFinite(Number(entry.multiplier)) ? Number(entry.multiplier) : 1,
      rule_json: entry.rule_json ?? null,
      start_date: entry.start_date ?? null,
      end_date: entry.end_date ?? null,
      updated_at: entry.updated_at ?? null,
      version: typeof entry.version === "number" ? entry.version : null,
    }))

    setCampaigns(sanitized)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleSave = useCallback(
    async (campaignData: Partial<Campaign>) => {
      const payload = {
        brand: campaignData.brand,
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
      const { error } = await supabase.rpc(rpcName, {
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

      toast.success(`Campaign ${campaignData.id ? "updated" : "created"}`)
      await fetchCampaigns()
    },
    [fetchCampaigns, supabase],
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
      await fetchCampaigns()
    },
    [fetchCampaigns, supabase],
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
        <Button
          onClick={() => {
            setSelectedCampaign(null)
            setDialogOpen(true)
          }}
        >
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
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  Loading campaigns...
                </TableCell>
              </TableRow>
            ) : filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => (
                <TableRow key={campaign.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{campaign.brand}</p>
                        {(() => {
                          const version = extractVersion(campaign)
                          return version ? (
                            <Badge variant="secondary" className="bg-muted text-xs font-normal">
                              v{version}
                            </Badge>
                          ) : null
                        })()}
                      </div>
                      {campaign.rule_json ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 font-mono">
                          {JSON.stringify(campaign.rule_json)}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <p>{formatDate(campaign.start_date)}</p>
                      <p className="text-muted-foreground">to {formatDate(campaign.end_date)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{campaign.multiplier.toFixed(2)}x</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{campaign.updated_at ? formatDate(campaign.updated_at) : "—"}</p>
                      {campaign.updated_at ? (
                        <p className="text-xs text-muted-foreground">
                          {new Date(campaign.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCampaign(campaign)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Campaign Form Dialog */}
      <CampaignFormDialog
        campaign={selectedCampaign}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedCampaign(null)
          }
        }}
        onSave={handleSave}
      />
    </div>
  )
}

"use client"

import { useState } from "react"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CampaignFormDialog } from "@/components/campaign-form-dialog"
import type { Campaign } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockCampaigns: Campaign[] = [
  {
    id: "c1",
    name: "Summer Grocery Rewards",
    description: "Earn $10 for every grocery receipt submitted during summer",
    start_date: "2025-06-01",
    end_date: "2025-08-31",
    reward_amount: 10.0,
    max_participants: 1000,
    current_participants: 456,
    status: "active",
    created_at: "2025-05-01T00:00:00Z",
  },
  {
    id: "c2",
    name: "Back to School Special",
    description: "Special rewards for school supply purchases",
    start_date: "2025-08-01",
    end_date: "2025-09-15",
    reward_amount: 15.0,
    current_participants: 0,
    status: "inactive",
    created_at: "2025-07-15T00:00:00Z",
  },
  {
    id: "c3",
    name: "Spring Savings",
    description: "Spring promotion for all grocery purchases",
    start_date: "2025-03-01",
    end_date: "2025-05-31",
    reward_amount: 8.0,
    max_participants: 500,
    current_participants: 500,
    status: "completed",
    created_at: "2025-02-01T00:00:00Z",
  },
  {
    id: "c4",
    name: "Holiday Bonus",
    description: "Extra rewards during the holiday season",
    start_date: "2025-11-15",
    end_date: "2025-12-31",
    reward_amount: 20.0,
    current_participants: 0,
    status: "inactive",
    created_at: "2025-10-01T00:00:00Z",
  },
]

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">("all")

  const handleSave = async (campaignData: Partial<Campaign>) => {
    console.log("[v0] Saving campaign:", campaignData)
    // Placeholder for Supabase insert/update

    if (campaignData.id) {
      // Update existing campaign
      setCampaigns((prev) => prev.map((c) => (c.id === campaignData.id ? { ...c, ...campaignData } : c)))
    } else {
      // Create new campaign
      const newCampaign: Campaign = {
        id: `c${campaigns.length + 1}`,
        name: campaignData.name!,
        description: campaignData.description!,
        start_date: campaignData.start_date!,
        end_date: campaignData.end_date!,
        reward_amount: campaignData.reward_amount!,
        max_participants: campaignData.max_participants,
        current_participants: 0,
        status: campaignData.status!,
        created_at: new Date().toISOString(),
      }
      setCampaigns((prev) => [newCampaign, ...prev])
    }
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return

    console.log("[v0] Deleting campaign:", campaignId)
    // Placeholder for Supabase delete
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
  }

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Campaign["status"]) => {
    const variants = {
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

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Campaign["status"] | "all")}>
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
              <TableHead>Campaign Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.length === 0 ? (
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
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <p>{new Date(campaign.start_date).toLocaleDateString()}</p>
                      <p className="text-muted-foreground">to {new Date(campaign.end_date).toLocaleDateString()}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">${campaign.reward_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{campaign.current_participants}</p>
                      {campaign.max_participants && (
                        <p className="text-muted-foreground">of {campaign.max_participants}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
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
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
    </div>
  )
}

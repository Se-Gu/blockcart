"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Campaign } from "@/lib/types"

interface CampaignFormDialogProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (campaign: Partial<Campaign>) => void
}

export function CampaignFormDialog({ campaign, open, onOpenChange, onSave }: CampaignFormDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    reward_amount: "",
    max_participants: "",
    status: "active" as Campaign["status"],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        reward_amount: campaign.reward_amount.toString(),
        max_participants: campaign.max_participants?.toString() || "",
        status: campaign.status,
      })
    } else {
      setFormData({
        name: "",
        description: "",
        start_date: "",
        end_date: "",
        reward_amount: "",
        max_participants: "",
        status: "active",
      })
    }
  }, [campaign, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const campaignData: Partial<Campaign> = {
      ...formData,
      reward_amount: Number.parseFloat(formData.reward_amount),
      max_participants: formData.max_participants ? Number.parseInt(formData.max_participants) : undefined,
    }

    if (campaign) {
      campaignData.id = campaign.id
    }

    await onSave?.(campaignData)
    setIsSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Summer Grocery Rewards"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Earn rewards on all grocery purchases this summer"
              rows={3}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reward_amount">Reward Amount ($)</Label>
              <Input
                id="reward_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.reward_amount}
                onChange={(e) => setFormData({ ...formData, reward_amount: e.target.value })}
                placeholder="10.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_participants">Max Participants (Optional)</Label>
              <Input
                id="max_participants"
                type="number"
                min="1"
                value={formData.max_participants}
                onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                placeholder="Leave empty for unlimited"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as Campaign["status"] })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : campaign ? "Update Campaign" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

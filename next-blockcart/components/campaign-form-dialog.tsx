"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Campaign } from "@/lib/types"

interface CampaignFormDialogProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (campaign: Partial<Campaign>) => Promise<void> | void
}

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.split("T")[0] ?? ""
  }
  return date.toISOString().slice(0, 10)
}

export function CampaignFormDialog({ campaign, open, onOpenChange, onSave }: CampaignFormDialogProps) {
  const [formData, setFormData] = useState({
    brand: "",
    multiplier: "1",
    start_date: "",
    end_date: "",
    ruleJsonText: "{}",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ruleJsonError, setRuleJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (campaign && open) {
      setFormData({
        brand: campaign.brand ?? "",
        multiplier: campaign.multiplier != null ? String(campaign.multiplier) : "1",
        start_date: normalizeDateInput(campaign.start_date),
        end_date: normalizeDateInput(campaign.end_date),
        ruleJsonText: campaign.rule_json ? JSON.stringify(campaign.rule_json, null, 2) : "{}",
      })
    } else if (open) {
      setFormData({
        brand: "",
        multiplier: "1",
        start_date: "",
        end_date: "",
        ruleJsonText: "{}",
      })
    }
    setRuleJsonError(null)
  }, [campaign, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    let parsedRuleJson: Record<string, unknown> | null = null
    const trimmedRule = formData.ruleJsonText.trim()

    if (trimmedRule.length > 0) {
      try {
        parsedRuleJson = JSON.parse(trimmedRule)
        setRuleJsonError(null)
      } catch (error) {
        setRuleJsonError((error as Error).message)
        setIsSubmitting(false)
        return
      }
    }

    const multiplierValue = Number.parseFloat(formData.multiplier)
    const normalizedMultiplier = Number.isFinite(multiplierValue) ? multiplierValue : 1

    const campaignData: Partial<Campaign> = {
      brand: formData.brand.trim(),
      multiplier: normalizedMultiplier,
      rule_json: parsedRuleJson,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    }

    if (campaign?.id) {
      campaignData.id = campaign.id
    }

    try {
      await onSave?.(campaignData)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save campaign", error)
      return
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule_json">Campaign Rules (JSON)</Label>
            <Textarea
              id="rule_json"
              value={formData.ruleJsonText}
              onChange={(e) => {
                setFormData({ ...formData, ruleJsonText: e.target.value })
                if (ruleJsonError) {
                  setRuleJsonError(null)
                }
              }}
              spellCheck={false}
              className="font-mono text-sm"
              rows={12}
            />
            <p className="text-xs text-muted-foreground">
              Provide structured configuration used by the receipt validator (e.g. reward limits, qualifiers).
            </p>
            {ruleJsonError ? <p className="text-xs text-destructive">Invalid JSON: {ruleJsonError}</p> : null}
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

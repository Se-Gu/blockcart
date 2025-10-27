"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";

import type {
  CampaignRuleFormState,
  CampaignRuleTemplate,
  CampaignGenderOption,
} from "@/lib/campaign-rules";
import {
  CAMPAIGN_RULE_TEMPLATES,
  DEFAULT_GENDER_OPTIONS,
  cloneRuleFormState,
} from "@/lib/campaign-rules";
import type { CampaignRulePreviewResult } from "@/hooks/use-campaign-rule-preview";
import { cn } from "@/lib/utils";

interface CampaignRuleBuilderProps {
  value: CampaignRuleFormState;
  onChange: (value: CampaignRuleFormState) => void;
  onCommit?: () => void;
  storeOptions: string[];
  templates?: CampaignRuleTemplate[];
  onApplyTemplate?: (template: CampaignRuleTemplate) => void;
  preview?: CampaignRulePreviewResult | null;
  previewLoading?: boolean;
  layout?: "inline" | "dialog";
}

function StoreMultiSelect({
  options,
  value,
  onChange,
  onCommit,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  onCommit?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);

  const toggleOption = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    onChange(Array.from(next));
  };

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value.length > 0 ? `${value.length} selected` : "Select stores"}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search stores..." />
          <CommandList>
            <CommandEmpty>No stores found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option);
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => {
                      toggleOption(option);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t border-border p-2 text-right">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setOpen(false);
              onCommit?.();
            }}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TemplateSelector({
  onApply,
  templates = CAMPAIGN_RULE_TEMPLATES,
}: {
  onApply: (template: CampaignRuleTemplate) => void;
  templates?: CampaignRuleTemplate[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Browse Templates
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Search templates..." />
          <CommandList>
            <CommandEmpty>No templates found.</CommandEmpty>
            <CommandGroup heading="Campaign patterns">
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  onSelect={() => {
                    onApply(template);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-1"
                >
                  <span className="text-sm font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {template.description}
                  </span>
                  {template.recommendedMultiplier ? (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Suggested multiplier: x{template.recommendedMultiplier}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GenderSelector({
  options,
  value,
  onChange,
  onCommit,
}: {
  options: CampaignGenderOption[];
  value: CampaignGenderOption[];
  onChange: (next: CampaignGenderOption[]) => void;
  onCommit?: () => void;
}) {
  const toggleGender = (gender: CampaignGenderOption) => {
    const set = new Set(value);
    if (set.has(gender)) {
      set.delete(gender);
    } else {
      set.add(gender);
    }
    onChange(Array.from(set));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = value.includes(option);
        return (
          <Badge
            key={option}
            variant={isSelected ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => {
              toggleGender(option);
              onCommit?.();
            }}
          >
            {option === "unspecified" ? "Prefer not to say" : option}
          </Badge>
        );
      })}
    </div>
  );
}

export function CampaignRuleBuilder({
  value,
  onChange,
  onCommit,
  storeOptions,
  templates,
  onApplyTemplate,
  preview,
  previewLoading,
  layout = "dialog",
}: CampaignRuleBuilderProps) {
  const form = value;

  const applyTemplate = (template: CampaignRuleTemplate) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    } else {
      onChange(cloneRuleFormState(template.rule));
    }
    onCommit?.();
  };

  const alignment =
    layout === "inline" ? "grid grid-cols-1 gap-4" : "space-y-4";

  return (
    <div className={alignment}>
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <Label>Reward type</Label>
          <Select
            value={form.rewardType}
            onValueChange={(next) => {
              const updated = cloneRuleFormState(form);
              updated.rewardType = next as CampaignRuleFormState["rewardType"];
              if (next === "multiplier") {
                updated.rewardValue = "";
                updated.referral = {
                  ...updated.referral,
                  required: false,
                  bonusAmount: "",
                };
              }
              if (next === "fixed_bonus") {
                updated.referral = { ...updated.referral, required: false };
              }
              onChange(updated);
              onCommit?.();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select reward type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiplier">Multiplier</SelectItem>
              <SelectItem value="fixed_bonus">Fixed bonus</SelectItem>
              <SelectItem value="referral_boost">Referral boost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TemplateSelector onApply={applyTemplate} templates={templates} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="min-spend">Minimum spend</Label>
          <Input
            id="min-spend"
            type="number"
            min="0"
            step="0.01"
            value={form.minSpend}
            onChange={(event) => {
              const updated = cloneRuleFormState(form);
              updated.minSpend = event.target.value;
              onChange(updated);
            }}
            onBlur={onCommit}
            placeholder="0"
          />
        </div>

        {(form.rewardType === "fixed_bonus" ||
          form.rewardType === "referral_boost") && (
          <div className="space-y-1">
            <Label htmlFor="reward-value">Reward value</Label>
            <Input
              id="reward-value"
              type="number"
              min="0"
              step="0.01"
              value={form.rewardValue}
              onChange={(event) => {
                const updated = cloneRuleFormState(form);
                updated.rewardValue = event.target.value;
                onChange(updated);
              }}
              onBlur={onCommit}
              placeholder={
                form.rewardType === "fixed_bonus"
                  ? "Bonus amount"
                  : "Referral bonus"
              }
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Eligible stores</Label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id="include-all-stores"
              checked={form.includeAllStores}
              onCheckedChange={(checked) => {
                const updated = cloneRuleFormState(form);
                updated.includeAllStores = checked;
                if (checked) {
                  updated.eligibleStores = [];
                }
                onChange(updated);
                onCommit?.();
              }}
            />
            <Label htmlFor="include-all-stores" className="text-xs font-normal">
              All stores
            </Label>
          </div>
        </div>
        <StoreMultiSelect
          options={storeOptions}
          value={form.eligibleStores}
          onChange={(next) => {
            const updated = cloneRuleFormState(form);
            updated.eligibleStores = next;
            updated.includeAllStores = next.length === 0;
            onChange(updated);
          }}
          onCommit={onCommit}
          disabled={form.includeAllStores}
        />
        {form.eligibleStores.length > 0 ? (
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {form.eligibleStores.map((store) => (
              <Badge key={store} variant="outline">
                {store}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <Label>Multiplier options</Label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id="double-multiplier"
              checked={form.multiplierDouble}
              onCheckedChange={(checked) => {
                const updated = cloneRuleFormState(form);
                updated.multiplierDouble = checked;
                onChange(updated);
                onCommit?.();
              }}
            />
            <Label htmlFor="double-multiplier" className="text-xs font-normal">
              Double base rewards
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            id="stack-multiplier"
            checked={form.multiplierStack}
            onCheckedChange={(checked) => {
              const updated = cloneRuleFormState(form);
              updated.multiplierStack = checked;
              onChange(updated);
              onCommit?.();
            }}
          />
          <Label htmlFor="stack-multiplier" className="text-xs font-normal">
            Allow stacking with other campaigns
          </Label>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <div className="space-y-1">
          <Label>Demographics</Label>
          <p className="text-xs text-muted-foreground">
            Filter participants by age, gender, or verification state.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="age-min">Minimum age</Label>
            <Input
              id="age-min"
              type="number"
              min="0"
              value={form.demographics.ageMin}
              onChange={(event) => {
                const updated = cloneRuleFormState(form);
                updated.demographics.ageMin = event.target.value;
                onChange(updated);
              }}
              onBlur={onCommit}
              placeholder="Any"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="age-max">Maximum age</Label>
            <Input
              id="age-max"
              type="number"
              min="0"
              value={form.demographics.ageMax}
              onChange={(event) => {
                const updated = cloneRuleFormState(form);
                updated.demographics.ageMax = event.target.value;
                onChange(updated);
              }}
              onBlur={onCommit}
              placeholder="Any"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Genders</Label>
          <GenderSelector
            options={DEFAULT_GENDER_OPTIONS}
            value={form.demographics.genders}
            onChange={(next) => {
              const updated = cloneRuleFormState(form);
              updated.demographics.genders = next;
              onChange(updated);
            }}
            onCommit={onCommit}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            id="kyc-verified"
            checked={form.demographics.kycVerified}
            onCheckedChange={(checked) => {
              const updated = cloneRuleFormState(form);
              updated.demographics.kycVerified = checked;
              onChange(updated);
              onCommit?.();
            }}
          />
          <Label htmlFor="kyc-verified" className="text-xs font-normal">
            Require verified identity
          </Label>
        </div>
      </div>

      {form.rewardType === "referral_boost" ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="flex items-center justify-between">
            <Label>Referral requirements</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                id="referral-required"
                checked={form.referral.required}
                onCheckedChange={(checked) => {
                  const updated = cloneRuleFormState(form);
                  updated.referral.required = checked;
                  onChange(updated);
                  onCommit?.();
                }}
              />
              <Label
                htmlFor="referral-required"
                className="text-xs font-normal"
              >
                Referral must exist
              </Label>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="referral-bonus">Referral bonus amount</Label>
            <Input
              id="referral-bonus"
              type="number"
              min="0"
              step="0.01"
              value={form.referral.bonusAmount}
              onChange={(event) => {
                const updated = cloneRuleFormState(form);
                updated.referral.bonusAmount = event.target.value;
                updated.rewardValue = event.target.value;
                onChange(updated);
              }}
              onBlur={onCommit}
              placeholder="10"
            />
          </div>
        </div>
      ) : null}

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            Eligibility preview
          </span>
          {previewLoading ? <span>Calculating…</span> : null}
        </div>
        {preview ? (
          <div className="flex flex-wrap gap-3">
            <span>
              <span className="font-medium text-foreground">
                {preview.eligible_users}
              </span>{" "}
              eligible users
              {preview.total_users ? ` of ${preview.total_users}` : ""}
            </span>
            <span>
              <span className="font-medium text-foreground">
                {preview.eligible_receipts}
              </span>{" "}
              eligible receipts
              {preview.total_receipts ? ` of ${preview.total_receipts}` : ""}
            </span>
          </div>
        ) : (
          <span>No data yet.</span>
        )}
      </div>
    </div>
  );
}

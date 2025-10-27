"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  Modal,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
  IconButton,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useToast } from "../components/ToastProvider";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Campaign, ReceiptStatus } from "../types";
import { colors, spacing, borderRadius } from "../theme/colors";
import { useActiveCampaigns } from "../hooks/useCampaignPromotions";

const DAILY_RECEIPT_LIMIT = 2;

type BonusPreview = {
  campaign: Campaign;
  potentialBonus: number | null;
  multiplier: number | null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseCurrencyValue = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const sanitized = value.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  if (!sanitized) {
    return null;
  }
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
};

const matchesStoreRule = (campaign: Campaign, store: string): boolean => {
  const trimmedStore = store.trim().toLowerCase();
  if (!trimmedStore) {
    return true;
  }

  const rules = campaign.rule_json;
  if (!rules) {
    return true;
  }

  const storeKeys = [
    (rules as Record<string, unknown>).stores,
    (rules as Record<string, unknown>).eligibleStores,
    (rules as Record<string, unknown>).eligible_stores,
    (rules as Record<string, unknown>).allowedStores,
  ];

  const validLists = storeKeys.filter(Array.isArray) as unknown[][];
  if (validLists.length === 0) {
    return true;
  }

  return validLists.some((list) =>
    list.some((item) =>
      typeof item === "string" && trimmedStore.includes(item.toLowerCase()),
    ),
  );
};

const computePotentialBonus = (
  campaign: Campaign,
  total: number,
): { bonus: number | null; multiplier: number | null } => {
  const rewardAmount = parseNumber(campaign.reward_amount);
  const multiplier = parseNumber(campaign.multiplier);

  if (rewardAmount && rewardAmount > 0) {
    return { bonus: rewardAmount, multiplier };
  }

  if (multiplier && multiplier > 1) {
    return {
      bonus: Number((total * (multiplier - 1)).toFixed(2)),
      multiplier,
    };
  }

  if (multiplier && multiplier > 0) {
    return {
      bonus: Number((total * multiplier).toFixed(2)),
      multiplier,
    };
  }

  return { bonus: null, multiplier };
};

type Props = NativeStackScreenProps<ReceiptsStackParamList, "UploadReceipt">;

export default function UploadReceiptScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const { handleError } = useErrorHandler({ context: "Receipt Upload" });
  const { showSuccess, showWarning } = useToast();
  const { campaigns } = useActiveCampaigns();
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<ReceiptStatus | null>(
    null
  );
  const [eta, setEta] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [receiptTotal, setReceiptTotal] = useState("");
  const [bonusPreview, setBonusPreview] = useState<BonusPreview | null>(null);
  const [successCampaign, setSuccessCampaign] = useState<
    { name: string | null; bonusText: string | null } | null
  >(null);

  const handleStoreChange = useCallback((value: string) => {
    setStoreName(value);
  }, []);

  const handleTotalChange = useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, "");
    setReceiptTotal(sanitized);
  }, []);

  const pickImage = useCallback(async () => {
    const mediaLibraryPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!mediaLibraryPermission.granted) {
      showWarning(
        "Gallery access required. Please enable photo permissions."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  }, [showWarning]);

  const captureImage = useCallback(async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      showWarning("Camera access required. Please enable camera permissions.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  }, [showWarning]);

  const checkDailyLimit = useCallback(async () => {
    if (!session?.user) {
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const { count, error } = await supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("created_at", today.toISOString());

      if (error) {
        throw error;
      }

      if ((count ?? 0) >= DAILY_RECEIPT_LIMIT) {
        showWarning(
          `Daily limit reached. You can submit up to ${DAILY_RECEIPT_LIMIT} receipts per day.`
        );
        return false;
      }

      return true;
    } catch (error) {
      handleError(error, "Checking daily limit");
      return false;
    }
  }, [session?.user, showWarning, handleError]);

  const handleSubmit = useCallback(async () => {
    if (!session?.user) {
      showWarning("You must be signed in to upload receipts.");
      return;
    }

    if (!selectedImage) {
      showWarning("Please select or capture a receipt first.");
      return;
    }

    setSuccessMessage(null);
    setSuccessStatus(null);
    setEta(null);
    setSuccessCampaign(null);
    setSubmitting(true);

    try {
      const canUpload = await checkDailyLimit();
      if (!canUpload) {
        return;
      }

      const response = await fetch(selectedImage.uri);
      const blob = await response.blob();
      const path = `${session.user.id}/${uuidv4()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(path);

      const { data: functionData, error: functionError } =
        await supabase.functions.invoke("upload-receipt", {
          body: {
            user_id: session.user.id,
            image_url: publicUrl,
            storage_path: path,
            bucket: "receipts",
          },
        });

      if (functionError) {
        const message =
          typeof functionError === "object" && functionError !== null &&
          "message" in functionError &&
          typeof (functionError as { message?: unknown }).message === "string"
            ? ((functionError as { message?: string }).message as string)
            : "Unable to start receipt review.";
        showWarning(message);
        return;
      }

      const result = (functionData ?? {}) as {
        success?: boolean;
        message?: string;
        status?: ReceiptStatus;
        eta?: string;
        reward?: {
          amount?: number;
          bonus_amount?: number;
          campaign_id?: string | null;
          campaign_name?: string | null;
          campaign_multiplier?: number | null;
          campaign_reward_amount?: number | null;
          campaign_brand?: string | null;
        };
        campaign?: (Campaign & { bonus_amount?: number | null }) | null;
      };

      if (result.success === false) {
        const message =
          result.message ?? "Unable to start receipt review for this receipt.";
        showWarning(message);
        return;
      }

      const rewardDetails = result.reward ?? null;
      const rewardCampaign = result.campaign ?? null;
      const bonusAmount =
        parseNumber(rewardDetails?.bonus_amount) ??
        parseNumber(rewardDetails?.campaign_reward_amount) ??
        parseNumber(rewardCampaign?.reward_amount);
      const multiplier =
        parseNumber(rewardDetails?.campaign_multiplier) ??
        parseNumber(rewardCampaign?.multiplier);
      const campaignName =
        rewardDetails?.campaign_name ??
        rewardCampaign?.name ??
        rewardDetails?.campaign_brand ??
        rewardCampaign?.brand ??
        null;

      const campaignInfo =
        campaignName || (bonusAmount && bonusAmount > 0) || (multiplier && multiplier > 1)
          ? {
              name: campaignName,
              bonusText:
                bonusAmount && bonusAmount > 0
                  ? `Bonus: +${bonusAmount.toFixed(2)} BTC$`
                  : multiplier && multiplier > 1
                    ? `${multiplier.toFixed(2)}x rewards applied`
                    : null,
            }
          : null;

      const baseMessage =
        result.message ??
        "Receipt uploaded successfully. Pending review will begin shortly.";
      const status = result.status ?? "pending_review";

      const message = campaignInfo
        ? `${baseMessage} — ${campaignInfo.name ?? "Campaign"}${
            campaignInfo.bonusText ? ` • ${campaignInfo.bonusText}` : " bonus applied"
          }`
        : baseMessage;

      showSuccess(message);
      setSuccessMessage(message);
      setSuccessStatus(status);
      setEta(result.eta ?? null);
      setSuccessCampaign(campaignInfo);
      setSuccessVisible(true);
      setSelectedImage(null);
      setStoreName("");
      setReceiptTotal("");
      setBonusPreview(null);
    } catch (error) {
      handleError(error, "Uploading receipt");
    } finally {
      setSubmitting(false);
    }
  }, [
    checkDailyLimit,
    selectedImage,
    session?.user,
    showWarning,
    showSuccess,
    handleError,
  ]);

  const formattedEta = useMemo(() => {
    if (!eta) {
      return null;
    }
    const etaDate = new Date(eta);
    if (isNaN(etaDate.getTime())) {
      return null;
    }
    return etaDate.toLocaleString();
  }, [eta]);

  useEffect(() => {
    const totalValue = parseCurrencyValue(receiptTotal);
    if (!totalValue || totalValue <= 0) {
      setBonusPreview(null);
      return;
    }

    const eligibleCampaigns = campaigns.filter((campaign) =>
      matchesStoreRule(campaign, storeName),
    );

    if (eligibleCampaigns.length === 0) {
      setBonusPreview(null);
      return;
    }

    let best: BonusPreview | null = null;

    for (const campaign of eligibleCampaigns) {
      const { bonus, multiplier } = computePotentialBonus(campaign, totalValue);
      const normalizedBonus = bonus ?? 0;

      if (!best) {
        best = { campaign, potentialBonus: bonus, multiplier };
        continue;
      }

      const bestValue = best.potentialBonus ?? 0;

      if (normalizedBonus > bestValue) {
        best = { campaign, potentialBonus: bonus, multiplier };
        continue;
      }

      if (
        normalizedBonus === bestValue &&
        (multiplier ?? 0) > (best.multiplier ?? 0)
      ) {
        best = { campaign, potentialBonus: bonus, multiplier };
      }
    }

    setBonusPreview(best);
  }, [campaigns, receiptTotal, storeName]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface style={styles.uploadCard} elevation={3}>
        <LinearGradient
          colors={[`${colors.primary}15`, `${colors.accent}10`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconContainer}>
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerIcon}
            >
              <IconButton
                icon="receipt-text"
                size={28}
                iconColor="#FFFFFF"
                style={{ margin: 0 }}
              />
            </LinearGradient>
          </View>

          <Text variant="headlineSmall" style={styles.title}>
            Upload Receipt
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Capture a clear photo of your receipt to earn BTC$ rewards
          </Text>
        </LinearGradient>

        <View style={styles.imageSection}>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <IconButton
                  icon="close-circle"
                  size={36}
                  iconColor="#FFFFFF"
                  style={styles.removeButton}
                  onPress={() => setSelectedImage(null)}
                />
              </View>
            </View>
          ) : (
            <View
              style={[styles.dropZone, { borderColor: theme.colors.outline }]}
            >
              <LinearGradient
                colors={[`${colors.primary}10`, `${colors.accent}05`]}
                style={styles.dropZoneGradient}
              >
                <View style={styles.dropZoneIconContainer}>
                  <IconButton
                    icon="cloud-upload"
                    size={56}
                    iconColor={colors.primary}
                    style={{ margin: 0 }}
                  />
                </View>
                <Text variant="titleLarge" style={styles.dropZoneTitle}>
                  Upload Your Receipt
                </Text>
                <Text variant="bodyMedium" style={styles.dropZoneSubtitle}>
                  Take a photo or choose from gallery
                </Text>
              </LinearGradient>
            </View>
          )}
        </View>

        <View style={styles.detailsSection}>
          <Text variant="titleMedium" style={styles.detailsTitle}>
            Receipt details
          </Text>
          <TextInput
            mode="outlined"
            label="Store"
            value={storeName}
            onChangeText={handleStoreChange}
            style={styles.textInput}
            autoCapitalize="words"
            left={<TextInput.Icon icon="store" />}
          />
          <TextInput
            mode="outlined"
            label="Receipt total"
            value={receiptTotal}
            onChangeText={handleTotalChange}
            style={styles.textInput}
            keyboardType="decimal-pad"
            left={<TextInput.Icon icon="currency-btc" />}
          />

          <Surface style={styles.bonusCard} elevation={1}>
            <LinearGradient
              colors={[`${colors.primary}25`, `${colors.accent}20`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bonusGradient}
            >
              <Text variant="titleMedium" style={styles.bonusTitle}>
                Bonus preview
              </Text>
              {bonusPreview ? (
                <>
                  <Text style={styles.bonusCampaignName}>
                    {bonusPreview.campaign.name ?? bonusPreview.campaign.brand}
                  </Text>
                  <Text style={styles.bonusHighlight}>
                    Potential bonus: +
                    {formatCurrency(bonusPreview.potentialBonus ?? 0)} BTC$
                  </Text>
                  {bonusPreview.multiplier ? (
                    <Text style={styles.bonusMeta}>
                      Multiplier: {bonusPreview.multiplier.toFixed(2)}x
                    </Text>
                  ) : null}
                  <Text style={styles.bonusFooter}>
                    Submit now to lock in this promotion.
                  </Text>
                </>
              ) : (
                <Text style={styles.bonusSubtitle}>
                  Enter a store and total to preview eligible campaign bonuses.
                </Text>
              )}
            </LinearGradient>
          </Surface>
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.buttonRow}>
            <Surface style={styles.actionButtonSurface} elevation={1}>
              <Button
                mode="elevated"
                icon="image-multiple"
                onPress={pickImage}
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.actionButtonLabel}
              >
                Gallery
              </Button>
            </Surface>

            <Surface style={styles.actionButtonSurface} elevation={1}>
              <Button
                mode="elevated"
                icon="camera"
                onPress={captureImage}
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.actionButtonLabel}
              >
                Camera
              </Button>
            </Surface>
          </View>

          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              labelStyle={styles.submitButtonLabel}
              loading={submitting}
              disabled={submitting || !selectedImage}
              buttonColor="transparent"
            >
              Submit Receipt
            </Button>
          </LinearGradient>

          <View style={styles.infoContainer}>
            <IconButton
              icon="information"
              size={20}
              iconColor={colors.primary}
              style={{ margin: 0 }}
            />
            <Text variant="bodySmall" style={styles.limitText}>
              Daily limit: {DAILY_RECEIPT_LIMIT} receipts per day
            </Text>
          </View>
        </View>
      </Surface>

      <Portal>
        <Modal
          visible={successVisible}
          onDismiss={() => {
            setSuccessVisible(false);
            setSuccessMessage(null);
            setSuccessStatus(null);
            setEta(null);
            setSuccessCampaign(null);
          }}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.modalIconContainer}>
            <LinearGradient
              colors={[colors.approved, colors.approvedDark]}
              style={styles.modalIconGradient}
            >
              <IconButton
                icon="check-bold"
                size={48}
                iconColor="#FFFFFF"
                style={{ margin: 0 }}
              />
            </LinearGradient>
          </View>

          <Text variant="headlineSmall" style={styles.modalTitle}>
            Receipt Submitted!
          </Text>
          <Text variant="bodyLarge" style={styles.modalText}>
            {successMessage ??
              "We're processing your receipt. You'll be notified when it's approved."}
          </Text>
          {successCampaign ? (
            <Text variant="bodyMedium" style={styles.modalCampaignText}>
              {successCampaign.name
                ? `${successCampaign.name} bonus unlocked`
                : "Campaign bonus unlocked"}
            </Text>
          ) : null}
          {successCampaign?.bonusText ? (
            <Text variant="bodyMedium" style={styles.modalCampaignText}>
              {successCampaign.bonusText}
            </Text>
          ) : null}
          {successStatus ? (
            <Text variant="bodyMedium" style={styles.modalStatus}>
              Current status: {successStatus.replace("_", " ")}
            </Text>
          ) : null}
          {formattedEta ? (
            <Text variant="bodyMedium" style={styles.modalEta}>
              Estimated completion: {formattedEta}
            </Text>
          ) : null}

          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalButtonGradient}
          >
            <Button
              mode="contained"
              style={styles.modalButton}
              labelStyle={styles.modalButtonLabel}
              buttonColor="transparent"
              onPress={() => {
                setSuccessVisible(false);
                setSuccessMessage(null);
                setSuccessStatus(null);
                setEta(null);
                setSuccessCampaign(null);
                navigation.goBack();
              }}
            >
              Done
            </Button>
          </LinearGradient>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  uploadCard: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  headerGradient: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  headerIconContainer: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
  },
  subtitle: {
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  imageSection: {
    padding: spacing.lg,
  },
  detailsSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  detailsTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    height: 320,
    overflow: "hidden",
    backgroundColor: colors.surfaceVariant,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: spacing.md,
  },
  removeButton: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  dropZone: {
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  textInput: {
    backgroundColor: colors.surface,
  },
  dropZoneGradient: {
    padding: spacing.xl * 2,
    alignItems: "center",
    gap: spacing.md,
  },
  dropZoneIconContainer: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  dropZoneTitle: {
    fontWeight: "700",
    color: colors.primaryDark,
    textAlign: "center",
  },
  dropZoneSubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  actionsContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  bonusCard: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  bonusGradient: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  bonusTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  bonusCampaignName: {
    fontWeight: "700",
    fontSize: 16,
    color: colors.primaryDark,
  },
  bonusHighlight: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  bonusMeta: {
    color: colors.textSecondary,
  },
  bonusSubtitle: {
    color: colors.textSecondary,
  },
  bonusFooter: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButtonSurface: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  actionButton: {
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    paddingVertical: spacing.md,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  submitGradient: {
    borderRadius: borderRadius.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButton: {
    borderRadius: borderRadius.lg,
  },
  submitButtonContent: {
    paddingVertical: spacing.md,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  limitText: {
    color: colors.textSecondary,
    flex: 1,
  },
  modal: {
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    gap: spacing.lg,
  },
  modalIconContainer: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    shadowColor: colors.approved,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconGradient: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
  },
  modalText: {
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  modalButtonGradient: {
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    minWidth: 160,
  },
  modalButton: {
    borderRadius: borderRadius.lg,
  },
  modalButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: spacing.xs,
  },
  modalStatus: {
    textTransform: "capitalize",
    color: colors.textPrimary,
  },
  modalEta: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalCampaignText: {
    color: colors.textPrimary,
    textAlign: "center",
  },
});

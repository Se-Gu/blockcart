"use client";

import { useCallback, useState } from "react";
import { Image, ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  Modal,
  Portal,
  Surface,
  Text,
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
import type { Receipt } from "../types";
import { colors, spacing, borderRadius } from "../theme/colors";

const DAILY_RECEIPT_LIMIT = 2;

type Props = NativeStackScreenProps<ReceiptsStackParamList, "UploadReceipt">;

export default function UploadReceiptScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const { handleError } = useErrorHandler({ context: "Receipt Upload" });
  const { showSuccess, showWarning } = useToast();
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  }, []);

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

    setSubmitting(true);

    try {
      const canUpload = await checkDailyLimit();
      if (!canUpload) {
        return;
      }

      const response = await fetch(selectedImage.uri);
      const blob = await response.blob();
      const path = `receipts/${session.user.id}/${uuidv4()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, {
          contentType: selectedImage.mimeType ?? "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(path);

      type ReceiptInsertRow = Pick<Receipt, "id" | "image_url">;

      const { data: receiptRecord, error: insertError } = await supabase
        .from("receipts")
        .insert({
          user_id: session.user.id,
          image_url: publicUrl,
          status: "pending",
        })
        .select("id, image_url")
        .single();

      if (insertError || !receiptRecord) {
        throw insertError ?? new Error("Unable to save receipt record");
      }

      const receiptRow = receiptRecord as ReceiptInsertRow;

      await supabase.functions.invoke("ocr-parser", {
        body: {
          receipt_id: receiptRow.id,
          image_url: publicUrl,
        },
      });

      showSuccess(
        "Receipt uploaded successfully! Processing will begin shortly."
      );
      setSuccessVisible(true);
      setSelectedImage(null);
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
            Capture a clear photo of your receipt to earn BCT$ rewards
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
          onDismiss={() => setSuccessVisible(false)}
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
            We're processing your receipt. You'll be notified when it's approved
            and BCT$ is added to your wallet.
          </Text>

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
    paddingTop: spacing.sm,
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
    color: colors.textPrimary,
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
});

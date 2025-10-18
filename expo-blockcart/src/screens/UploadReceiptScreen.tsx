import { useCallback, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  Modal,
  Portal,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useToast } from "../components/ToastProvider";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt } from "../types";

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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Surface style={{ padding: 16, borderRadius: 16 }} elevation={1}>
        <Text variant="titleMedium">Receipt Image</Text>
        <Text
          variant="bodyMedium"
          style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
        >
          Capture a clear photo of your receipt or upload one from your gallery.
        </Text>
        <View
          style={{
            marginTop: 16,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceVariant,
            height: 220,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage.uri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              No image selected
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Button
            mode="outlined"
            icon="image"
            onPress={pickImage}
            style={{ flex: 1 }}
          >
            Choose photo
          </Button>
          <Button
            mode="outlined"
            icon="camera"
            onPress={captureImage}
            style={{ flex: 1 }}
          >
            Use camera
          </Button>
        </View>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={{ marginTop: 24 }}
          loading={submitting}
          disabled={submitting}
        >
          Submit receipt
        </Button>
      </Surface>

      <Portal>
        <Modal
          visible={successVisible}
          onDismiss={() => setSuccessVisible(false)}
          contentContainerStyle={{
            margin: 24,
            backgroundColor: theme.colors.surface,
            padding: 24,
            borderRadius: 16,
          }}
        >
          <Text variant="titleMedium">Receipt submitted for review</Text>
          <Text
            variant="bodyMedium"
            style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
          >
            Our team is parsing your receipt details. You'll be notified when
            it's approved.
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: 24 }}
            onPress={() => {
              setSuccessVisible(false);
              navigation.goBack();
            }}
          >
            Close
          </Button>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

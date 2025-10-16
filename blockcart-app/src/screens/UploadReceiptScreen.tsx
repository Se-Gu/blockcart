import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Image, View } from "react-native";
import { ActivityIndicator, Button, Modal, Portal, Text } from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";

export const UploadReceiptScreen: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const pickImage = async (fromCamera: boolean) => {
    const permissionMethod = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;

    const { status } = await permissionMethod();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to continue.");
      return;
    }

    const pickerMethod = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await pickerMethod({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setAsset(result.assets[0]);
    }
  };

  const enforceDailyLimit = async () => {
    if (!userId) return true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("receipts")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString());

    if (error) {
      console.warn("Failed to check receipt limit", error);
      return true;
    }

    if ((data?.length ?? 0) >= 2) {
      Alert.alert("Daily limit reached", "You can upload up to 2 receipts per day.");
      return false;
    }

    return true;
  };

  const handleUpload = async () => {
    if (!asset || !userId) {
      Alert.alert("Upload", "Please select a receipt image first.");
      return;
    }

    const allowed = await enforceDailyLimit();
    if (!allowed) return;

    setUploading(true);
    try {
      const fileExt = asset.fileName?.split(".").pop() || "jpg";
      const filePath = `receipts/${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, blob, {
          contentType: asset.mimeType || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from("receipts").getPublicUrl(filePath);
      const imageUrl = publicData?.publicUrl;

      const { data: insertData, error: insertError } = await supabase
        .from("receipts")
        .insert({
          user_id: userId,
          status: "pending",
          image_url: imageUrl,
          storage_path: filePath,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (insertData?.id) {
        await supabase.functions.invoke("ocr-parser", {
          body: {
            receipt_id: insertData.id,
            image_url: imageUrl,
          },
        });
      }

      setSuccessVisible(true);
      setAsset(null);
    } catch (err) {
      console.error("Receipt upload failed", err);
      Alert.alert("Upload failed", (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Text variant="titleLarge" style={{ marginBottom: 12, color: "#0f172a" }}>
        Upload receipt
      </Text>
      <Text variant="bodyMedium" style={{ color: "#64748b", marginBottom: 24 }}>
        Snap or upload your shopping receipt. We'll review it and credit your wallet when
        approved.
      </Text>

      <View className="items-center mb-6">
        {asset ? (
          <Image
            source={{ uri: asset.uri }}
            style={{ width: "100%", height: 220, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-52 rounded-xl border border-dashed border-slate-300 items-center justify-center bg-slate-50">
            <Text variant="bodyMedium" style={{ color: "#94a3b8" }}>
              No receipt selected yet
            </Text>
          </View>
        )}
      </View>

      <Button
        mode="contained-tonal"
        icon="camera"
        style={{ marginBottom: 12 }}
        onPress={() => pickImage(true)}
      >
        Take a photo
      </Button>
      <Button
        mode="outlined"
        icon="image"
        style={{ marginBottom: 24 }}
        onPress={() => pickImage(false)}
      >
        Choose from library
      </Button>

      <Button mode="contained" onPress={handleUpload} loading={uploading} disabled={uploading}>
        Submit receipt
      </Button>

      {uploading && (
        <View className="mt-6 items-center">
          <ActivityIndicator />
          <Text variant="bodySmall" style={{ color: "#64748b", marginTop: 8 }}>
            Uploading receipt...
          </Text>
        </View>
      )}

      <Portal>
        <Modal
          visible={successVisible}
          onDismiss={() => setSuccessVisible(false)}
          contentContainerStyle={{
            backgroundColor: "white",
            padding: 24,
            marginHorizontal: 24,
            borderRadius: 16,
          }}
        >
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 8 }}>
            Receipt submitted
          </Text>
          <Text variant="bodyMedium" style={{ color: "#64748b", marginBottom: 16 }}>
            We'll review your receipt shortly. You'll receive a notification when it's
            approved.
          </Text>
          <Button mode="contained" onPress={() => setSuccessVisible(false)}>
            Got it
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

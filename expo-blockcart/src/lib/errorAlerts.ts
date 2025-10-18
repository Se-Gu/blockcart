import { Alert } from "react-native";
import { parseError } from "./errorParser";

/**
 * Shows an error as an Alert dialog instead of a toast
 * Useful for critical errors or when you want user confirmation
 */
export function showErrorAlert(error: unknown, title?: string) {
  const parsedError = parseError(error);

  Alert.alert(title || parsedError.title, parsedError.message, [
    { text: "OK" },
  ]);
}

/**
 * Shows a confirmation dialog for potentially destructive actions
 */
export function showConfirmAlert(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = "Confirm",
  cancelText: string = "Cancel"
) {
  Alert.alert(title, message, [
    { text: cancelText, style: "cancel" },
    { text: confirmText, style: "destructive", onPress: onConfirm },
  ]);
}

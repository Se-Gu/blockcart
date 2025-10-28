import { useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Buffer } from "buffer";

type WalletStatus = "idle" | "connecting" | "verifying" | "ready" | "error";

type ConnectOptions = {
  message: string;
  cluster?: string;
};

type LinkingEvent = { url: string };

const PHANTOM_BASE_URL = "https://phantom.app/ul/v1";

const errorMessageFromCode = (
  code?: string | null,
  fallback?: string,
): string => {
  if (!code) {
    return fallback ?? "Wallet request was cancelled.";
  }

  switch (code.toLowerCase()) {
    case "user_declined":
    case "user_rejected":
      return "Request declined in Phantom.";
    case "invalid_payload":
      return "Wallet returned an invalid payload.";
    case "timeout":
      return "Wallet request timed out. Try again.";
    default:
      return fallback ?? "Wallet request failed.";
  }
};

export const usePhantomWallet = () => {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dappKeyPairRef = useRef<nacl.BoxKeyPair | null>(null);
  const sharedSecretRef = useRef<Uint8Array | null>(null);
  const sessionRef = useRef<string | null>(null);
  const messageRef = useRef<string | null>(null);
  const pendingAddressRef = useRef<string | null>(null);
  const pendingActionRef = useRef<"connect" | "signMessage" | null>(null);
  const clusterRef = useRef<string>("mainnet-beta");

  const resetInternalState = useCallback(() => {
    dappKeyPairRef.current = null;
    sharedSecretRef.current = null;
    sessionRef.current = null;
    messageRef.current = null;
    pendingAddressRef.current = null;
    pendingActionRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    resetInternalState();
    setAddress(null);
    setSignature(null);
    setStatus("idle");
    setError(null);
  }, [resetInternalState]);

  const clearError = useCallback(() => {
    setError(null);
    if (status === "error") {
      setStatus("idle");
    }
  }, [status]);

  const connect = useCallback(
    async ({ message, cluster = "mainnet-beta" }: ConnectOptions) => {
      if (status === "connecting" || status === "verifying") {
        return;
      }

      setError(null);
      setSignature(null);
      messageRef.current = message;
      clusterRef.current = cluster;
      setStatus("connecting");

      try {
        const keyPair = nacl.box.keyPair();
        dappKeyPairRef.current = keyPair;
        pendingActionRef.current = "connect";

        const redirectLink = Linking.createURL("/wallet/phantom/connect");
        const appUrl = Linking.createURL("/");
        const url =
          `${PHANTOM_BASE_URL}/connect?app_url=${encodeURIComponent(appUrl)}` +
          `&dapp_encryption_public_key=${bs58.encode(keyPair.publicKey)}` +
          `&redirect_link=${encodeURIComponent(redirectLink)}` +
          `&cluster=${encodeURIComponent(cluster)}`;

        await Linking.openURL(url);
      } catch (err) {
        resetInternalState();
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to open Phantom wallet.",
        );
      }
    },
    [resetInternalState, status],
  );

  const requestSignature = useCallback(async () => {
    const sharedSecret = sharedSecretRef.current;
    const dappKeyPair = dappKeyPairRef.current;
    const session = sessionRef.current;
    const message = messageRef.current;

    if (!sharedSecret || !dappKeyPair || !session || !message) {
      resetInternalState();
      setStatus("error");
      setError("Wallet session expired. Please try again.");
      return;
    }

    try {
      const nonce = nacl.randomBytes(24);
      const payload = {
        session,
        message: bs58.encode(Buffer.from(message, "utf8")),
      };

      console.log("Requesting signature with:", { 
        sessionLength: session.length, 
        messageLength: message.length,
        messagePreview: message.substring(0, 50)
      });

      const encryptedPayload = nacl.box.after(
        Buffer.from(JSON.stringify(payload), "utf8"),
        nonce,
        sharedSecret,
      );

      const redirectLink = Linking.createURL("/wallet/phantom/signMessage");
      const appUrl = Linking.createURL("/");
      const url =
        `${PHANTOM_BASE_URL}/signMessage?app_url=${encodeURIComponent(appUrl)}` +
        `&dapp_encryption_public_key=${bs58.encode(dappKeyPair.publicKey)}` +
        `&redirect_link=${encodeURIComponent(redirectLink)}` +
        `&payload=${encodeURIComponent(bs58.encode(encryptedPayload))}` +
        `&nonce=${encodeURIComponent(bs58.encode(nonce))}`;

      console.log("Opening signMessage URL");
      pendingActionRef.current = "signMessage";
      await Linking.openURL(url);
    } catch (err) {
      resetInternalState();
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to request a signature from Phantom.",
      );
    }
  }, [resetInternalState]);

  const handleDeepLink = useCallback(
    async (event: LinkingEvent | string) => {
      const url = typeof event === "string" ? event : event?.url;
      if (!url) {
        return;
      }

      const { path, queryParams } = Linking.parse(url);
      if (!path || !path.startsWith("wallet/phantom")) {
        return;
      }

      console.log("Deep link received:", { path, queryParams });

      const errorCode =
        (queryParams?.errorCode as string | undefined) ??
        (queryParams?.error_code as string | undefined) ??
        null;
      if (errorCode) {
        console.log("Phantom returned error:", { errorCode, errorMessage: queryParams?.errorMessage ?? queryParams?.error });
        resetInternalState();
        setStatus("error");
        const fallback =
          (queryParams?.errorMessage as string | undefined) ??
          (queryParams?.error as string | undefined);
        setError(errorMessageFromCode(errorCode, fallback));
        return;
      }

      const action = path.split("/").pop();

      // Handle "signMessage" differently - it doesn't need phantom_encryption_public_key
      if (action === "signMessage") {
        // For signMessage, we already have the shared secret from connect
        const sharedSecret = sharedSecretRef.current;
        if (!sharedSecret) {
          resetInternalState();
          setStatus("error");
          setError("Wallet session expired. Please try again.");
          return;
        }

        const nonceParam = queryParams?.nonce;
        const dataParam = queryParams?.data;

        if (typeof nonceParam !== "string" || typeof dataParam !== "string") {
          console.log("Missing params for signMessage:", { nonceParam, dataParam });
          resetInternalState();
          setStatus("error");
          setError("Wallet response was missing required parameters.");
          return;
        }

        const decrypted = nacl.box.open.after(
          bs58.decode(dataParam),
          bs58.decode(nonceParam),
          sharedSecret,
        );

        if (!decrypted) {
          resetInternalState();
          setStatus("error");
          setError("Failed to decrypt wallet response.");
          return;
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(Buffer.from(decrypted).toString("utf8"));
        } catch (err) {
          resetInternalState();
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Wallet response was invalid.",
          );
          return;
        }

        const activeAddress = pendingAddressRef.current;
        const activeMessage = messageRef.current;
        const signatureValue = payload?.signature as string | undefined;

        if (!activeAddress || !activeMessage || !signatureValue) {
          resetInternalState();
          setStatus("error");
          setError("Wallet signature payload was incomplete.");
          return;
        }

        try {
          const messageBytes = Buffer.from(activeMessage, "utf8");
          const signatureBytes = bs58.decode(signatureValue);
          const publicKeyBytes = bs58.decode(activeAddress);

          const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes,
          );

          if (!isValid) {
            resetInternalState();
            setStatus("error");
            setError("Wallet signature could not be verified.");
            return;
          }

          setAddress(activeAddress);
          setSignature(signatureValue);
          setStatus("ready");
          setError(null);
          pendingActionRef.current = null;
        } catch (err) {
          resetInternalState();
          setStatus("error");
          setError(
            err instanceof Error
              ? err.message
              : "Failed to validate wallet signature.",
          );
        }
        return;
      }

      // Handle "connect" action - need to establish shared secret
      const dappKeyPair = dappKeyPairRef.current;
      if (!dappKeyPair) {
        resetInternalState();
        setStatus("error");
        setError("Wallet session was not initialized. Please try again.");
        return;
      }

      const phantomPublicKeyParam = queryParams?.phantom_encryption_public_key;
      const nonceParam = queryParams?.nonce;
      const dataParam = queryParams?.data;

      if (
        typeof phantomPublicKeyParam !== "string" ||
        typeof nonceParam !== "string" ||
        typeof dataParam !== "string"
      ) {
        console.log("Missing params for connect:", { phantomPublicKeyParam, nonceParam, dataParam, allParams: queryParams });
        resetInternalState();
        setStatus("error");
        setError("Wallet response was missing required parameters.");
        return;
      }

      const sharedSecret = nacl.box.before(
        bs58.decode(phantomPublicKeyParam),
        dappKeyPair.secretKey,
      );
      sharedSecretRef.current = sharedSecret;

      const decrypted = nacl.box.open.after(
        bs58.decode(dataParam),
        bs58.decode(nonceParam),
        sharedSecret,
      );

      if (!decrypted) {
        resetInternalState();
        setStatus("error");
        setError("Failed to decrypt wallet response.");
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(Buffer.from(decrypted).toString("utf8"));
      } catch (err) {
        resetInternalState();
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Wallet response was invalid.",
        );
        return;
      }

      // This is the "connect" action handler
      const publicKey = payload?.public_key as string | undefined;
      const session = payload?.session as string | undefined;

      if (!publicKey || !session) {
        resetInternalState();
        setStatus("error");
        setError("Wallet did not return a public key.");
        return;
      }

      pendingAddressRef.current = publicKey;
      sessionRef.current = session;
      setStatus("verifying");
      await requestSignature();
      return;
    },
    [requestSignature, resetInternalState],
  );

  useEffect(() => {
    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  useEffect(() => {
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleDeepLink(initialUrl);
      }
    };

    void checkInitialUrl();
  }, [handleDeepLink]);

  return {
    connect,
    disconnect,
    status,
    address,
    signature,
    error,
    clearError,
    cluster: clusterRef.current,
  };
};

export type UsePhantomWalletReturn = ReturnType<typeof usePhantomWallet>;

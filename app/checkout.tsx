"use client";
import { useEffect, useRef, useState } from "react";
import {
  loadCoreSdkScript,
  type OneTimePaymentSession,
} from "@paypal/paypal-js/sdk-v6";
import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/client";
import { decimal } from "@/lib/core";
import type { PaymentData } from "./guest";
export default function Checkout({
  token,
  payment,
  onUpdate,
  onError,
}: {
  token: string;
  payment: PaymentData;
  onUpdate: () => Promise<void>;
  onError: (value: string) => void;
}) {
  const session = useRef<OneTimePaymentSession | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (!payment.paypalReady) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active) {
        onError("PayPal SDK timed out. Reload to retry.");
        setReady(false);
      }
    }, 25000);
    async function initialize() {
      try {
        const [sdk, auth] = await Promise.all([
          loadCoreSdkScript({ environment: "sandbox" }),
          api("pay/" + token + "/sdk", {}),
        ]);
        if (!sdk) throw new Error("PayPal SDK failed to load");
        const instance = await sdk.createInstance({
          clientToken: auth.clientToken,
          components: ["paypal-payments"],
          pageType: "checkout",
        });
        const eligible = await instance.findEligibleMethods({
          currencyCode: "USD",
          amount: decimal(payment.amount),
        });
        if (!eligible.isEligible("paypal"))
          throw new Error(
            "PayPal is not eligible for this buyer or test merchant. Check the Sandbox account configuration.",
          );
        const checkout = instance.createPayPalOneTimePaymentSession({
          onApprove: async (data) => {
            if (!active) return;
            setBusy(true);
            setStatus("Verifying your payment with PayPal…");
            try {
              await api("pay/" + token + "/capture", { orderId: data.orderId });
              setStatus("");
              await onUpdate();
            } catch (error) {
              onError((error as Error).message);
              setStatus("Payment is not confirmed. Retry verification safely.");
            } finally {
              setBusy(false);
            }
          },
          onCancel: () => {
            if (!active) return;
            setBusy(false);
            setStatus(
              "Checkout cancelled. No payment has been confirmed. You can try again.",
            );
            void api("pay/" + token + "/cancel", {})
              .then(onUpdate)
              .catch((error) => onError(error.message));
          },
          onError: () => {
            if (active) {
              setBusy(false);
              setStatus("");
              onError(
                "PayPal checkout could not finish. This share is not marked paid. Retry safely.",
              );
            }
          },
        });
        if (active) {
          session.current = checkout;
          setReady(true);
          clearTimeout(timeout);
        } else checkout.destroy();
      } catch (error) {
        if (active) {
          clearTimeout(timeout);
          setStatus("Checkout unavailable");
          onError((error as Error).message);
        }
      }
    }
    void initialize();
    return () => {
      active = false;
      clearTimeout(timeout);
      session.current?.destroy();
      session.current = null;
    };
  }, [token, payment.paypalReady]);
  async function start() {
    if (!session.current) return;
    setBusy(true);
    onError("");
    setStatus("Opening PayPal Sandbox…");
    try {
      const order = api("pay/" + token + "/order", {}) as Promise<{
        orderId: string;
      }>;
      await session.current.start({ presentationMode: "auto" }, order);
    } catch (error) {
      onError((error as Error).message);
      setStatus("No payment has been confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="reviewed-label">
        <CheckCircle2 size={14} />
        Share reviewed and approved
      </div>
      {!payment.paypalReady ? (
        <div className="setup-note">
          <LockKeyhole size={23} />
          <strong>Connect PayPal Sandbox to continue.</strong>
          <p>
            The restaurant needs its Sandbox credentials. No payment has been
            charged.
          </p>
        </div>
      ) : (
        <>
          <button
            className="paypal-checkout"
            disabled={!ready || busy}
            onClick={() => void start()}
          >
            {!ready || busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <span className="paypal-logo">
                Pay<span>Pal</span>
              </span>
            )}{" "}
            {!ready
              ? "Loading secure checkout"
              : busy
                ? "Please wait…"
                : "Pay with PayPal"}
          </button>
          {["APPROVED", "CHECKOUT"].includes(payment.state) && (
            <button
              className="button secondary wide retry-payment"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const order = await api("pay/" + token + "/order", {});
                  await api("pay/" + token + "/capture", {
                    orderId: order.orderId,
                  });
                  setStatus("");
                  await onUpdate();
                } catch (error) {
                  onError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={13} />
              Retry payment verification
            </button>
          )}
        </>
      )}
      {status && (
        <p className="checkout-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}

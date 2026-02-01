import { NWCClient, Nip47NotificationType } from "@getalby/sdk";

export type NotificationType =
  | "payment_received"
  | "payment_sent"
  | "hold_invoice_accepted";

export interface WaitForPaymentParams {
  payment_hash: string;
  type?: NotificationType;
  timeout?: number;
}

export async function waitForPayment(
  client: NWCClient,
  params: WaitForPaymentParams
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let unsub: (() => void) | undefined;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (unsub) {
        unsub();
      }
    };

    if (params.timeout) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for payment after ${params.timeout}s`));
      }, params.timeout * 1000);
    }

    const notificationTypes: Nip47NotificationType[] | undefined = params.type
      ? [params.type]
      : undefined;

    client
      .subscribeNotifications(
        (notification) => {
          const transaction = notification.notification;
          if (transaction.payment_hash === params.payment_hash) {
            cleanup();
            const { amount, fees_paid, type, ...rest } = transaction;
            resolve({
              notification_type: notification.notification_type,
              type,
              ...rest,
              amount_in_sats: Math.floor(amount / 1000),
              fees_paid_in_sats:
                typeof fees_paid === "number"
                  ? Math.ceil(fees_paid / 1000)
                  : undefined,
            });
          }
        },
        notificationTypes
      )
      .then((unsubscribe) => {
        unsub = unsubscribe;
      });
  });
}

import { NWCClient, Nip47Notification, Nip47NotificationType } from "@getalby/sdk";

export interface SubscribeParams {
  types?: Nip47NotificationType[];
}

export function transformNotification(notification: Nip47Notification) {
  const transaction = notification.notification;
  const { amount, fees_paid, type, ...rest } = transaction;
  return {
    notification_type: notification.notification_type,
    type,
    ...rest,
    amount_in_sats: Math.floor(amount / 1000),
    fees_paid_in_sats:
      typeof fees_paid === "number"
        ? Math.ceil(fees_paid / 1000)
        : undefined,
  };
}

export async function subscribe(
  client: NWCClient,
  onNotification: (notification: unknown) => void,
  params: SubscribeParams = {}
): Promise<() => void> {
  return await client.subscribeNotifications((notification) => {
    onNotification(transformNotification(notification));
  }, params.types);
}

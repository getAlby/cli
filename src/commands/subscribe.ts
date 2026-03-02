import { Command } from "commander";
import { subscribe } from "../tools/nwc/subscribe.js";
import { Nip47NotificationType } from "@getalby/sdk";
import { getClient, handleError, output } from "../utils.js";

const ALLOWED_NOTIFICATION_TYPES: Nip47NotificationType[] = [
  "payment_received",
  "payment_sent",
  "hold_invoice_accepted",
];

export function registerSubscribeCommand(program: Command) {
  program
    .command("subscribe")
    .description("Subscribe to wallet notifications")
    .option(
      "--type <types...>",
      "Notification type filter: payment_received, payment_sent, hold_invoice_accepted",
    )
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const rawTypes = options.type as string[] | undefined;
        if (rawTypes) {
          const invalid = rawTypes.filter(
            (t) =>
              !ALLOWED_NOTIFICATION_TYPES.includes(t as Nip47NotificationType),
          );
          if (invalid.length > 0) {
            throw new Error(
              `Invalid --type value(s): ${invalid.join(", ")}. Allowed values: ${ALLOWED_NOTIFICATION_TYPES.join(", ")}`,
            );
          }
        }
        process.stderr.write(
          "Subscribing to notifications. Press Ctrl+C to stop.\n",
        );
        const unsubscribe = await subscribe(
          client,
          (notification) => {
            output(notification);
          },
          {
            types: rawTypes as Nip47NotificationType[] | undefined,
          },
        );

        await new Promise<void>((resolve) => {
          const stop = () => {
            unsubscribe();
            resolve();
          };
          process.on("SIGINT", stop);
          process.on("SIGTERM", stop);
        });
      });
    });
}

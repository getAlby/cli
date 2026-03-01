import { Command } from "commander";
import { subscribe } from "../tools/nwc/subscribe.js";
import { Nip47NotificationType } from "@getalby/sdk";
import { getClient, handleError, output } from "../utils.js";

export function registerSubscribeCommand(program: Command) {
  program
    .command("subscribe")
    .description("Subscribe to wallet notifications")
    .option(
      "--type <types...>",
      "Notification type filter: payment_received, payment_sent, hold_invoice_accepted"
    )
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        console.info("Subscribing to notifications. Press Ctrl+C to stop.");
        await subscribe(client, (notification) => {
          output(notification);
        }, {
          types: options.type as Nip47NotificationType[] | undefined,
        });

        // Keep the process alive
        await new Promise(() => {});
      });
    });
}

import { Command } from "commander";
import { waitForPayment, NotificationType } from "../tools/nwc/wait_for_payment.js";
import { getClient, handleError, output } from "../utils.js";

export function registerWaitForPaymentCommand(program: Command) {
  program
    .command("wait-for-payment")
    .description("Wait for a payment notification")
    .requiredOption("--payment-hash <hex>", "Payment hash to wait for")
    .option(
      "--type <type>",
      "Notification type filter: payment_received, payment_sent, hold_invoice_accepted"
    )
    .option("--timeout <seconds>", "Timeout in seconds", parseInt)
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await waitForPayment(client, {
          payment_hash: options.paymentHash,
          type: options.type as NotificationType | undefined,
          timeout: options.timeout,
        });
        output(result);
      });
    });
}

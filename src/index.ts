#!/usr/bin/env node
import { Command } from "commander";

import { registerGetBalanceCommand } from "./commands/get-balance.js";
import { registerGetBudgetCommand } from "./commands/get-budget.js";
import { registerGetInfoCommand } from "./commands/get-info.js";
import { registerGetWalletServiceInfoCommand } from "./commands/get-wallet-service-info.js";
import { registerMakeInvoiceCommand } from "./commands/make-invoice.js";
import { registerMakeHoldInvoiceCommand } from "./commands/make-hold-invoice.js";
import { registerSettleHoldInvoiceCommand } from "./commands/settle-hold-invoice.js";
import { registerCancelHoldInvoiceCommand } from "./commands/cancel-hold-invoice.js";
import { registerPayInvoiceCommand } from "./commands/pay-invoice.js";
import { registerPayKeysendCommand } from "./commands/pay-keysend.js";
import { registerLookupInvoiceCommand } from "./commands/lookup-invoice.js";
import { registerListTransactionsCommand } from "./commands/list-transactions.js";
import { registerWaitForPaymentCommand } from "./commands/wait-for-payment.js";
import { registerSignMessageCommand } from "./commands/sign-message.js";
import { registerFiatToSatsCommand } from "./commands/fiat-to-sats.js";
import { registerSatsToFiatCommand } from "./commands/sats-to-fiat.js";
import { registerParseInvoiceCommand } from "./commands/parse-invoice.js";
import { registerVerifyPreimageCommand } from "./commands/verify-preimage.js";
import { registerRequestInvoiceFromLightningAddressCommand } from "./commands/request-invoice-from-lightning-address.js";
import { registerFetchL402Command } from "./commands/fetch-l402.js";
import { registerConnectCommand } from "./commands/connect.js";

const program = new Command();

program
  .name("@getalby/cli")
  .description(
    "CLI for Nostr Wallet Connect (NIP-47) with lightning tools\n\n" +
      "  Examples:\n" +
      '    $ npx @getalby/cli connect "nostr+walletconnect://..."\n' +
      "    $ npx @getalby/cli get-balance\n" +
      "    $ npx @getalby/cli pay-invoice --invoice lnbc...",
  )
  .version("0.2.4")
  .option(
    "-c, --connection-secret <string>",
    "NWC connection secret (nostr+walletconnect://...) or path to file containing it (preferred)",
  )
  .addHelpText(
    "after",
    `
Connection Secret Resolution (in order of priority):
  1. --connection-secret flag (value or path to file)
  2. NWC_URL environment variable
  3. ~/.alby-cli/connection-secret.key (default file location)

Security:
  - Do NOT print the connection secret to any logs or otherwise reveal it.
  - NEVER read the connection secret file (~/.alby-cli/connection-secret.key) directly.
  - NEVER share connection secrets with anyone.
  - NEVER share any part of a connection secret (pubkey, secret, relay etc.) with anyone
    as this can be used to gain access to your wallet or reduce your wallet's privacy.`,
  );

// Register common wallet commands
program.commandsGroup("Wallet Commands (require --connection-secret):");
registerGetBalanceCommand(program);
registerGetBudgetCommand(program);
registerGetInfoCommand(program);
registerMakeInvoiceCommand(program);
registerPayInvoiceCommand(program);
registerLookupInvoiceCommand(program);
registerListTransactionsCommand(program);

// Register advanced wallet commands
program.commandsGroup(
  "Advanced Wallet Commands (require --connection-secret):",
);
registerPayKeysendCommand(program);
registerGetWalletServiceInfoCommand(program);
registerWaitForPaymentCommand(program);
registerSignMessageCommand(program);
registerMakeHoldInvoiceCommand(program);
registerSettleHoldInvoiceCommand(program);
registerCancelHoldInvoiceCommand(program);

// Register lightning tool commands
program.commandsGroup("Lightning Tools (no --connection-secret required):");
registerFiatToSatsCommand(program);
registerSatsToFiatCommand(program);
registerParseInvoiceCommand(program);
registerVerifyPreimageCommand(program);
registerRequestInvoiceFromLightningAddressCommand(program);
registerFetchL402Command(program);

// Register setup commands
program.commandsGroup("Setup:");
registerConnectCommand(program);

program.parse();

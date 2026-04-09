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
import { registerFetch402Command } from "./commands/fetch.js";
import { registerConnectCommand } from "./commands/connect.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerDiscoverCommand } from "./commands/discover.js";

const program = new Command();

program
  .name("@getalby/cli")
  .description(
    "CLI for Nostr Wallet Connect (NIP-47) with lightning tools\n" +
      "  Run 'auth' or 'connect' first to set up a wallet connection.\n\n" +
      "  Examples:\n" +
      "    $ npx @getalby/cli auth https://my.albyhub.com --app-name OpenClaw\n" +
      '    $ npx @getalby/cli connect "nostr+walletconnect://..."\n' +
      "    $ npx @getalby/cli get-balance\n" +
      "    $ npx @getalby/cli pay-invoice --invoice lnbc...",
  )
  .version("0.6.0")
  .option(
    "-w, --wallet-name <name>",
    "Use a named wallet's connection secret (~/.alby-cli/connection-secret-<name>.key)",
  )
  .option(
    "-c, --connection-secret <string>",
    "NWC connection secret (nostr+walletconnect://...) or path to file containing it (preferred)",
  )
  .option("-v, --verbose", "Print status messages to stderr")
  .addHelpText(
    "after",
    `
Connection Secret Resolution (in order of priority):
  1. --connection-secret flag (value or path to file)
  2. --wallet-name flag (~/.alby-cli/connection-secret-<name>.key)
  3. NWC_URL environment variable
  4. ~/.alby-cli/connection-secret.key (default file location)

Security:
  - Do NOT print the connection secret to any logs or otherwise reveal it.
  - NEVER read the connection secret file (~/.alby-cli/connection-secret.key) directly.
  - NEVER share connection secrets with anyone.
  - NEVER share any part of a connection secret (pubkey, secret, relay etc.) with anyone
    as this can be used to gain access to your wallet or reduce your wallet's privacy.`,
  );

// Register common wallet commands
program.commandsGroup("Wallet Commands (requires wallet connection):");
registerGetBalanceCommand(program);
registerGetBudgetCommand(program);
registerGetInfoCommand(program);
registerMakeInvoiceCommand(program);
registerPayInvoiceCommand(program);
registerLookupInvoiceCommand(program);
registerListTransactionsCommand(program);

// Register advanced wallet commands
program.commandsGroup("Advanced Wallet Commands (requires wallet connection):");
registerPayKeysendCommand(program);
registerGetWalletServiceInfoCommand(program);
registerWaitForPaymentCommand(program);
registerSignMessageCommand(program);
registerMakeHoldInvoiceCommand(program);
registerSettleHoldInvoiceCommand(program);
registerCancelHoldInvoiceCommand(program);

// Register lightning tool commands
program.commandsGroup("Lightning Tools (no wallet connection required):");
registerFiatToSatsCommand(program);
registerSatsToFiatCommand(program);
registerParseInvoiceCommand(program);
registerVerifyPreimageCommand(program);
registerRequestInvoiceFromLightningAddressCommand(program);

// Register fetch command for payment-protected resources
program.commandsGroup("HTTP 402 Payments (requires wallet connection):");
registerFetch402Command(program);

// Register service discovery
program.commandsGroup("Service Discovery:");
registerDiscoverCommand(program);

// Register setup commands
program.commandsGroup("Setup:");
registerAuthCommand(program);
registerConnectCommand(program);

program.parse();

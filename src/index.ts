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

const program = new Command();

program
  .name("alby-cli")
  .description("CLI for Nostr Wallet Connect (NIP-47) with lightning tools")
  .version("0.0.0")
  .option(
    "-c, --connection-secret <string>",
    "NWC connection secret (nostr+walletconnect://...)"
  );

// Register all commands
registerGetBalanceCommand(program);
registerGetBudgetCommand(program);
registerGetInfoCommand(program);
registerGetWalletServiceInfoCommand(program);
registerMakeInvoiceCommand(program);
registerMakeHoldInvoiceCommand(program);
registerSettleHoldInvoiceCommand(program);
registerCancelHoldInvoiceCommand(program);
registerPayInvoiceCommand(program);
registerPayKeysendCommand(program);
registerLookupInvoiceCommand(program);
registerListTransactionsCommand(program);
registerWaitForPaymentCommand(program);
registerSignMessageCommand(program);
registerFiatToSatsCommand(program);
registerSatsToFiatCommand(program);
registerParseInvoiceCommand(program);
registerVerifyPreimageCommand(program);
registerRequestInvoiceFromLightningAddressCommand(program);
registerFetchL402Command(program);

program.parse();

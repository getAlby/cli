import { Command } from "commander";
import { parseInvoice } from "../tools/lightning/parse_invoice.js";
import { handleError, output } from "../utils.js";

export function registerParseInvoiceCommand(program: Command) {
  program
    .command("parse-invoice")
    .description("Parse a BOLT-11 invoice")
    .requiredOption("-i, --invoice <bolt11>", "Invoice to parse")
    .action(async (options) => {
      await handleError(async () => {
        const result = parseInvoice({ invoice: options.invoice });
        output(result);
      });
    });
}

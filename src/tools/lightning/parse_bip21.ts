import {
  parseBip21 as parseBip21Lib,
  type Bip21,
} from "@getalby/lightning-tools/bip21";

export interface ParseBip21Params {
  uri: string;
}

export function parseBip21(params: ParseBip21Params): Bip21 {
  const result = parseBip21Lib(params.uri);
  if (!result) {
    throw new Error(
      `Not a valid BIP21 URI (must start with "bitcoin:"): ${params.uri}`,
    );
  }
  return result;
}

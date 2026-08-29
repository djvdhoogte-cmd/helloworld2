import type { EdiMessage } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const ediMessagesCollection = new JsonCollection<EdiMessage>("edi-messages.db.json");

export function stripRawMessage({ rawMessage: _rawMessage, ...summary }: EdiMessage) {
  return summary;
}

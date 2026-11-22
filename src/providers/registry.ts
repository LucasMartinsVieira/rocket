import { getProviderCredential } from "../providerCredentials";
import { OmdbAdapter } from "./omdb";

// Keep adapter instances alive across screen mounts so stateful providers can reuse their sessions and queues.
export const catalogAdapters = {
  omdb: new OmdbAdapter(() => getProviderCredential("omdb")),
};

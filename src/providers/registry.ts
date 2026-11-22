import {
  getProviderCredential,
  onProviderCredentialChange,
} from "../providerCredentials";
import { IgdbAdapter } from "./igdb";
import { OmdbAdapter } from "./omdb";

// Keep adapter instances alive across screen mounts so stateful providers can reuse their sessions and queues.
export const catalogAdapters = {
  omdb: new OmdbAdapter(() => getProviderCredential("omdb")),
  igdb: new IgdbAdapter(() => getProviderCredential("igdb")),
};

onProviderCredentialChange((id) => {
  if (id === catalogAdapters.igdb.id) catalogAdapters.igdb.clearSession();
});

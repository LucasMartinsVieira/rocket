import {
  getProviderCredential,
  onProviderCredentialChange,
} from "../providerCredentials";
import { BooksAdapter } from "./books";
import { IgdbAdapter } from "./igdb";
import { OmdbAdapter } from "./omdb";
import { TenraiAdapter, TenraiClient } from "./tenrai";

const tenrai = new TenraiClient();

// Keep adapter instances alive across screen mounts so stateful providers can reuse their sessions and queues.
export const catalogAdapters = {
  omdb: new OmdbAdapter(() => getProviderCredential("omdb")),
  books: new BooksAdapter(),
  "tenrai-anime": new TenraiAdapter("anime", tenrai),
  "tenrai-manga": new TenraiAdapter("manga", tenrai),
  igdb: new IgdbAdapter(() => getProviderCredential("igdb")),
};

onProviderCredentialChange((id) => {
  if (id === catalogAdapters.igdb.id) catalogAdapters.igdb.clearSession();
});

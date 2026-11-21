import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { actionStyles } from "../../components/shared/actions.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { providerCardStyles } from "../shared/providerCards.styles";

const sources = [
  {
    name: "IGDB",
    text: "Game data and cover images provided by IGDB.com. IGDB access is subject to the Twitch Developer Service Agreement. Commercial or monetized distribution requires arranging an IGDB partnership; a Credits page alone is not approval.",
    url: "https://www.igdb.com/",
  },
  {
    name: "OMDb",
    text: "Movie metadata provided by OMDb API. Content is licensed under CC BY-NC 4.0; third-party rights may apply.",
    url: "https://www.omdbapi.com/",
  },
  {
    name: "Open Library & Google Books",
    text: "Book metadata and covers provided by Open Library, with Google Books as a fallback. Each catalog result links to its source.",
    url: "https://openlibrary.org/",
  },
  {
    name: "Tenrai & MyAnimeList",
    text: "Anime and manga metadata from the MyAnimeList catalog via Tenrai. Rocket is not endorsed by these services.",
    url: "https://tenrai.org/",
  },
];

export function CreditsScreen() {
  return (
    <ScrollView
      style={layoutStyles.fill}
      contentContainerStyle={providerCardStyles.providersBody}
    >
      <Text style={providerCardStyles.vaultTitle}>Data sources & credits</Text>
      {sources.map((source) => (
        <View key={source.name} style={providerCardStyles.providerCard}>
          <Text style={providerCardStyles.providerName}>{source.name}</Text>
          <Text style={providerCardStyles.vaultDescription}>{source.text}</Text>
          <Pressable
            onPress={() =>
              void Linking.openURL(source.url).catch(() => undefined)
            }
            style={actionStyles.quietAction}
            accessibilityRole="link"
            accessibilityLabel={`Visit ${source.name}`}
          >
            <Text style={actionStyles.quietActionText}>{source.url}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

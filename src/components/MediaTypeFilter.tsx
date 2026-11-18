import { ScrollView } from "react-native";
import { MEDIA_TYPES, type MediaType } from "../model";
import { styles } from "../styles";
import { Chip } from "./MediaUI";

const labels: Record<MediaType | "All", string> = {
  All: "All",
  Anime: "Anime",
  Manga: "Manga",
  Movie: "Movies",
  Book: "Books",
  Game: "Games",
};

export function MediaTypeFilter({
  value,
  onChange,
}: {
  value: MediaType | "All";
  onChange: (value: MediaType | "All") => void;
}) {
  return (
    <ScrollView
      horizontal
      style={styles.horizontalFilterRail}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRail}
    >
      {(["All", ...MEDIA_TYPES] as const).map((type) => (
        <Chip
          key={type}
          label={labels[type]}
          selected={value === type}
          onPress={() => onChange(type)}
        />
      ))}
    </ScrollView>
  );
}

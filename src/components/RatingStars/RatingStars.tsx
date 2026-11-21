import { Pressable, Text, View } from "react-native";
import { palette } from "../../theme";
import { Icon } from "../Icon";
import { actionStyles } from "../shared/actions.styles";
import { formStyles } from "../shared/form.styles";
import { styles } from "./styles";

export function RatingStars({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <Pressable
          key={rating}
          onPress={() => onChange(rating)}
          disabled={disabled}
          style={styles.ratingStarButton}
          accessibilityRole="radio"
          accessibilityLabel={`${rating} ${rating === 1 ? "star" : "stars"}`}
          accessibilityState={{ selected: value === rating, disabled }}
        >
          <Icon
            name="star"
            size={24}
            color={rating <= (value ?? 0) ? "#FFB68E" : palette.faint}
            fill={rating <= (value ?? 0) ? "#FFB68E" : "none"}
          />
        </Pressable>
      ))}
      {value !== null ? (
        <Pressable
          onPress={() => onChange(null)}
          disabled={disabled}
          style={styles.ratingClear}
          accessibilityRole="button"
          accessibilityLabel="Clear rating"
        >
          <Text style={actionStyles.quietActionText}>Clear</Text>
        </Pressable>
      ) : (
        <Text style={formStyles.helperText}>Unrated</Text>
      )}
    </View>
  );
}

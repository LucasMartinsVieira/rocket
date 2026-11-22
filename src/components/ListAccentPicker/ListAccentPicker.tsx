import { Pressable, Text, View } from "react-native";
import { LIST_ACCENT_COLOR, LIST_ACCENTS, type ListAccent } from "../../model";
import { actionStyles } from "../shared/actions.styles";
import { styles } from "./styles";

export function ListAccentPicker({
  value,
  disabled = false,
  onChange,
}: {
  value: ListAccent;
  disabled?: boolean;
  onChange: (accent: ListAccent) => void;
}) {
  return (
    <View
      style={styles.choices}
      accessibilityRole="radiogroup"
      accessibilityLabel="List accent"
    >
      {LIST_ACCENTS.map((accent) => {
        const chosen = value === accent;
        return (
          <Pressable
            key={accent}
            onPress={() => onChange(accent)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`${accent} accent`}
            accessibilityState={{ checked: chosen, disabled }}
            style={[
              styles.choice,
              chosen && styles.choiceSelected,
              disabled && actionStyles.disabledButton,
            ]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: LIST_ACCENT_COLOR[accent] },
                chosen && styles.swatchSelected,
              ]}
            />
            <Text style={[styles.label, chosen && styles.labelSelected]}>
              {accent}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { LIST_ICONS, type ListIcon } from "../model";
import { styles } from "../styles";
import { palette } from "../theme";

export function ListIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ListIcon;
  onChange: (icon: ListIcon) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.listIconGrid}>
      {LIST_ICONS.map((icon) => (
        <Pressable
          key={icon.name}
          onPress={() => onChange(icon.name)}
          disabled={disabled}
          style={[
            styles.listIconChoice,
            value === icon.name && styles.listIconChoiceSelected,
          ]}
          accessibilityRole="radio"
          accessibilityLabel={`${icon.label} list icon`}
          accessibilityState={{ selected: value === icon.name, disabled }}
        >
          <Icon
            name={icon.name}
            size={23}
            color={value === icon.name ? palette.violetText : palette.muted}
          />
        </Pressable>
      ))}
    </View>
  );
}

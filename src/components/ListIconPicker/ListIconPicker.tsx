import { Pressable, View } from "react-native";
import { LIST_ICONS, type ListIcon } from "../../model";
import { palette } from "../../theme";
import { Icon } from "../Icon";
import { styles } from "./styles";

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

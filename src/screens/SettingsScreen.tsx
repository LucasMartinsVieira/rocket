import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type Props = { onOpenProviderIntegrations: () => void };

export function SettingsScreen({ onOpenProviderIntegrations }: Props) {
  return <View style={styles.settingsBody}>
    <Pressable
      onPress={onOpenProviderIntegrations}
      style={styles.settingsLink}
      accessibilityRole="button"
      accessibilityLabel="Provider Integrations"
    >
      <View style={styles.settingsLinkIcon}><Text style={styles.settingsLinkIconText}>⚙</Text></View>
      <View style={styles.settingsLinkCopy}>
        <Text style={styles.settingsLinkTitle}>Provider Integrations</Text>
        <Text style={styles.settingsLinkSubtitle}>Manage credentials stored on this device</Text>
      </View>
      <Text style={styles.settingsLinkArrow}>›</Text>
    </Pressable>
  </View>;
}

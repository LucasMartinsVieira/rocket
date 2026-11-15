import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { Icon } from "../components/Icon";

type Props = { onOpenProviderIntegrations: () => void };

export function SettingsScreen({ onOpenProviderIntegrations }: Props) {
  return <View style={styles.settingsBody}>
    <Pressable
      onPress={onOpenProviderIntegrations}
      style={styles.settingsLink}
      accessibilityRole="button"
      accessibilityLabel="Provider Integrations"
    >
      <View style={styles.settingsLinkIcon}><Icon name="settings" size={21} color="#D2BBFF" /></View>
      <View style={styles.settingsLinkCopy}>
        <Text style={styles.settingsLinkTitle}>Provider Integrations</Text>
        <Text style={styles.settingsLinkSubtitle}>Manage credentials stored on this device</Text>
      </View>
      <Icon name="chevronRight" size={20} color="#958DA1" />
    </Pressable>
  </View>;
}

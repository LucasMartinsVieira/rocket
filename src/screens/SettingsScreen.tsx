import { Pressable, Text, View } from "react-native";
import { Icon } from "../components/Icon";
import { styles } from "../styles";

type Props = {
  onOpenProviderIntegrations: () => void;
  onOpenCredits: () => void;
  onOpenBackup: () => void;
};

export function SettingsScreen({
  onOpenProviderIntegrations,
  onOpenCredits,
  onOpenBackup,
}: Props) {
  return (
    <View style={styles.settingsBody}>
      <Pressable
        onPress={onOpenProviderIntegrations}
        style={styles.settingsLink}
        accessibilityRole="button"
        accessibilityLabel="Provider Integrations"
      >
        <View style={styles.settingsLinkIcon}>
          <Icon name="settings" size={21} color="#D2BBFF" />
        </View>
        <View style={styles.settingsLinkCopy}>
          <Text style={styles.settingsLinkTitle}>Provider Integrations</Text>
          <Text style={styles.settingsLinkSubtitle}>
            Manage credentials stored on this device
          </Text>
        </View>
        <Icon name="chevronRight" size={20} color="#958DA1" />
      </Pressable>
      <Pressable
        onPress={onOpenBackup}
        style={[styles.settingsLink, { marginTop: 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Backup & Restore"
      >
        <View style={styles.settingsLinkIcon}>
          <Icon name="archiveRestore" size={21} color="#D2BBFF" />
        </View>
        <View style={styles.settingsLinkCopy}>
          <Text style={styles.settingsLinkTitle}>Backup & Restore</Text>
          <Text style={styles.settingsLinkSubtitle}>
            Export or restore a local library snapshot
          </Text>
        </View>
        <Icon name="chevronRight" size={20} color="#958DA1" />
      </Pressable>
      <Pressable
        onPress={onOpenCredits}
        style={[styles.settingsLink, { marginTop: 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Credits"
      >
        <View style={styles.settingsLinkIcon}>
          <Icon name="book" size={21} color="#D2BBFF" />
        </View>
        <View style={styles.settingsLinkCopy}>
          <Text style={styles.settingsLinkTitle}>Credits</Text>
          <Text style={styles.settingsLinkSubtitle}>
            Data sources and provider attribution
          </Text>
        </View>
        <Icon name="chevronRight" size={20} color="#958DA1" />
      </Pressable>
    </View>
  );
}

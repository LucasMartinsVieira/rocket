import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BACKUP_VERSION,
  BackupFileError,
  type LibraryBackup,
  snapshotCounts,
} from "../../backup";
import {
  type BackupExport,
  canSaveBackup,
  pickBackupFile,
  prepareBackupFile,
  saveBackupFile,
  shareBackupFile,
} from "../../backupFiles";
import { Icon, type IconName } from "../../components/Icon";
import { actionStyles } from "../../components/shared/actions.styles";
import { dialogStyles } from "../../components/shared/dialog.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { backupRepository } from "../../repositories/backupRepository";
import { palette } from "../../theme";
import { styles } from "./styles";

type Selection = { name: string; backup: LibraryBackup };
type RestoreState =
  | { kind: "home" }
  | { kind: "preview" | "restoring" | "success"; file: Selection }
  | { kind: "failure"; title: string; message: string; retry?: Selection };

const metrics = [
  {
    key: "titles",
    label: "Titles",
    detail: "Movies, TV shows, anime, manga, books & games",
    icon: "clapperboard",
  },
  {
    key: "lists",
    label: "Custom lists",
    detail: "Memberships and custom order",
    icon: "listChecks",
  },
  {
    key: "journals",
    label: "Journal entries",
    detail: "Dated entries linked to titles",
    icon: "notebookPen",
  },
  {
    key: "ratings",
    label: "Rated titles",
    detail: "Your personal star ratings",
    icon: "tag",
  },
] as const;

function Button({
  label,
  icon,
  tone = "neutral",
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  tone?: "neutral" | "light" | "violet" | "danger";
  disabled?: boolean;
  onPress: () => void;
}) {
  const color =
    tone === "light"
      ? palette.primaryText
      : tone === "neutral"
        ? palette.ink
        : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.backupButton,
        tone === "light" && styles.backupButtonLight,
        tone === "violet" && styles.backupButtonViolet,
        tone === "danger" && styles.backupButtonDanger,
        (pressed || disabled) && actionStyles.disabledButton,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={18}
          color={tone === "neutral" ? palette.secondary : color}
        />
      ) : null}
      <Text style={[styles.backupButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Badge({
  icon,
  tone = "violet",
}: {
  icon: IconName;
  tone?: "violet" | "amber" | "danger" | "success";
}) {
  return (
    <View
      style={[
        styles.backupBadge,
        tone === "amber" && styles.backupBadgeAmber,
        tone === "danger" && dialogStyles.deleteIconBox,
        tone === "success" && styles.backupBadgeSuccess,
      ]}
    >
      <Icon
        name={icon}
        size={22}
        color={
          tone === "violet"
            ? palette.violetText
            : tone === "amber"
              ? palette.secondary
              : tone === "danger"
                ? palette.error
                : palette.backupSuccess
        }
      />
    </View>
  );
}

function Heading({
  title,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  tone?: "amber" | "danger";
}) {
  return (
    <View style={styles.backupRow}>
      <Badge icon={icon} tone={tone} />
      <View style={styles.backupFlexible}>
        <Text accessibilityRole="header" style={styles.backupHeading}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.backupMeta, tone === "amber" && styles.backupAmber]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function FileCard({ name, detail }: { name: string; detail: string }) {
  return (
    <View style={[styles.backupRow, styles.backupInset]}>
      <Badge icon="braces" />
      <View style={styles.backupFlexible}>
        <Text style={styles.backupFilename}>{name}</Text>
        <Text style={styles.backupMeta}>{detail}</Text>
      </View>
    </View>
  );
}

function Note({
  icon,
  message,
  tone,
}: {
  icon: IconName;
  message: string;
  tone?: "amber" | "success";
}) {
  return (
    <View style={[styles.backupRow, styles.backupInset]}>
      <Icon
        name={icon}
        size={18}
        color={
          tone === "amber"
            ? palette.secondary
            : tone === "success"
              ? palette.backupSuccess
              : palette.violetText
        }
      />
      <Text style={[styles.backupMeta, styles.backupFlexible]}>{message}</Text>
    </View>
  );
}

const dateLabel = (date: string) => new Date(date).toLocaleString();
const number = (value: number) => value.toLocaleString();
const libraryCount = (titles: number, lists: number) =>
  `${number(titles)} ${titles === 1 ? "title" : "titles"} · ${number(lists)} ${lists === 1 ? "list" : "lists"}`;

export function BackupRestoreScreen({
  titleCount,
  listCount,
  onBack,
  onLibrary,
  onRestored,
}: {
  titleCount: number;
  listCount: number;
  onBack: () => void;
  onLibrary: () => void;
  onRestored: (backup: LibraryBackup) => void;
}) {
  const [state, setState] = useState<RestoreState>({ kind: "home" });
  const [snapshot, setSnapshot] = useState<BackupExport | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [exportError, setExportError] = useState("");
  const operation = useRef(false);
  const occupied = titleCount > 0 || listCount > 0;
  const file = "file" in state ? state.file : undefined;
  const counts = file ? snapshotCounts(file.backup) : undefined;
  const exportCounts = snapshot ? snapshotCounts(snapshot.backup) : undefined;

  const back = () => {
    if (operation.current) return;
    if (confirm) setConfirm(false);
    else if (snapshot) setSnapshot(null);
    else if (state.kind === "home") onBack();
    else {
      setNotice("");
      setState({ kind: "home" });
    }
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  });

  async function run(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  const startExport = () =>
    void run(async () => {
      setNotice("");
      setExportError("");
      try {
        setSnapshot(prepareBackupFile(await backupRepository.exportSnapshot()));
      } catch (error) {
        setNotice(
          error instanceof BackupFileError && error.kind === "size"
            ? "This library exceeds the 16 MB backup limit."
            : "Couldn’t prepare the backup. Try exporting again.",
        );
      }
    });

  const exportFile = (destination: "save" | "share") => {
    if (!snapshot) return;
    void run(async () => {
      setExportError("");
      try {
        if (destination === "save") {
          if (!(await saveBackupFile(snapshot))) return;
          setNotice("Backup saved to your selected folder.");
        } else {
          await shareBackupFile(snapshot);
          setNotice(
            "If you saved or shared the file, keep a copy somewhere you can find it.",
          );
        }
        setSnapshot(null);
      } catch {
        setExportError(
          destination === "save"
            ? "Couldn’t save the file. Try another folder."
            : "Couldn’t share the file. Try saving it instead.",
        );
      }
    });
  };

  const selectFile = () =>
    void run(async () => {
      try {
        const selected = await pickBackupFile();
        if (!selected) return;
        setNotice("");
        setState({ kind: "preview", file: selected });
      } catch (error) {
        setNotice("");
        setState({
          kind: "failure",
          title:
            error instanceof BackupFileError && error.kind === "version"
              ? "Unsupported backup version"
              : "File cannot be read",
          message:
            error instanceof BackupFileError
              ? error.message
              : "Rocket couldn’t read the selected file. Try a local copy or choose another backup.",
        });
      }
    });

  const restore = (selected: Selection) =>
    void run(async () => {
      setConfirm(false);
      setNotice("");
      setState({ kind: "restoring", file: selected });
      try {
        await backupRepository.replaceLibrary(selected.backup);
      } catch {
        setState({
          kind: "failure",
          title: "Restore failed",
          message:
            "Rocket couldn’t write the backup to the device. Check available storage and try again.",
          retry: selected,
        });
        return;
      }
      onRestored(selected.backup);
      setState({ kind: "success", file: selected });
    });

  const available = Platform.OS === "android" || Platform.OS === "ios";
  return (
    <SafeAreaView style={layoutStyles.screen}>
      <View style={styles.backupBar}>
        <Pressable
          onPress={back}
          disabled={busy}
          style={styles.backupIconButton}
          accessibilityRole="button"
          accessibilityLabel={
            state.kind === "home"
              ? "Back to settings"
              : "Back to Backup & Restore"
          }
          accessibilityState={{ disabled: busy }}
        >
          <Icon
            name="arrowLeft"
            size={20}
            color={busy ? palette.faint : palette.ink}
          />
        </Pressable>
        <Text accessibilityRole="header" style={styles.backupBarTitle}>
          {state.kind === "home"
            ? "Backup & Restore"
            : "Backup & Restore · Import snapshot"}
        </Text>
      </View>
      <ScrollView
        key={state.kind}
        style={layoutStyles.fill}
        contentContainerStyle={styles.backupBody}
      >
        {state.kind === "home" ? (
          <>
            <View style={styles.backupCard}>
              <Text accessibilityRole="header" style={styles.backupHero}>
                Local backup & portability
              </Text>
              <Text style={styles.backupCopy}>
                Save a copy of your library or restore it from a Rocket backup.
                No account required.
              </Text>
            </View>
            <View style={styles.backupCard}>
              <Heading
                title="Export backup"
                subtitle="Full library snapshot (.json)"
                icon="folderUp"
              />
              <Text style={styles.backupCopy}>
                Save titles, ratings, notes, journals, and custom list order in
                a portable JSON file.
              </Text>
              <Button
                label="Export backup file"
                icon="download"
                tone="light"
                disabled={!available || busy}
                onPress={startExport}
              />
            </View>
            <View style={styles.backupCard}>
              <View style={styles.backupRow}>
                <View style={styles.backupFlexible}>
                  <Heading
                    title="Restore from file"
                    subtitle="Replaces current library"
                    icon="history"
                    tone="amber"
                  />
                </View>
                <Icon
                  name="triangleAlert"
                  size={20}
                  color={palette.secondary}
                />
              </View>
              <Text style={styles.backupCopy}>
                Select a previously exported Rocket JSON file to restore your
                full library.
              </Text>
              <Button
                label="Select backup file…"
                icon="folderOpen"
                disabled={!available || busy}
                onPress={selectFile}
              />
            </View>
            {!available ? (
              <Text style={styles.backupMeta}>
                Backup files are available in the native mobile app.
              </Text>
            ) : null}
            <View style={styles.backupCard}>
              <View style={styles.backupRow}>
                <Text
                  accessibilityRole="header"
                  style={[styles.backupHeading, styles.backupFlexible]}
                >
                  Inside a snapshot
                </Text>
                <Text style={styles.backupMeta}>Format v{BACKUP_VERSION}</Text>
              </View>
              {(
                [
                  [
                    "clapperboard",
                    "Library Titles",
                    "Movies, TV Shows, Anime, Manga, Books & Games",
                  ],
                  ["listChecks", "Lists", "Personal user lists"],
                  [
                    "notebookPen",
                    "Journals & Ratings",
                    "Dated entries, Private Notes, and Stars",
                  ],
                  [
                    "shield",
                    "Provider Credentials Excluded",
                    "API keys and access tokens stay on this device",
                  ],
                ] as const
              ).map(([icon, label, description]) => (
                <View
                  key={label}
                  style={[styles.backupRow, styles.backupInventoryRow]}
                >
                  <Icon
                    name={icon}
                    size={18}
                    color={
                      icon === "shield" ? palette.secondary : palette.violetText
                    }
                  />
                  <View style={styles.backupFlexible}>
                    <Text style={styles.backupLabel}>{label}</Text>
                    <Text style={styles.backupMeta}>{description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
        {state.kind === "preview" && counts ? (
          <>
            <View style={styles.backupCard}>
              <View style={styles.backupValidated}>
                <View style={styles.backupSuccessDot} />
                <Text style={styles.backupSuccess}>
                  Validated Rocket backup
                </Text>
              </View>
              <FileCard
                name={state.file.name}
                detail={`Created ${dateLabel(state.file.backup.exportedAt)} · Rocket JSON`}
              />
            </View>
            <Text accessibilityRole="header" style={styles.backupHeading}>
              Snapshot contents
            </Text>
            <View style={styles.backupMetricGrid}>
              {metrics.map(({ key, label, detail, icon }) => (
                <View style={styles.backupMetricCard} key={key}>
                  <Icon
                    name={icon}
                    size={21}
                    color={
                      key === "titles" || key === "journals"
                        ? palette.secondary
                        : palette.violetText
                    }
                  />
                  <Text style={styles.backupMetricNumber}>
                    {number(counts[key])}
                  </Text>
                  <Text style={styles.backupHeading}>{label}</Text>
                  <Text style={styles.backupMeta}>{detail}</Text>
                </View>
              ))}
            </View>
            {occupied ? (
              <View style={styles.backupCard}>
                <Heading
                  title="Restoring replaces your current library"
                  icon="shield"
                  tone="amber"
                />
                <Text style={styles.backupCopy}>
                  This backup replaces rather than merges with your current
                  library. The {libraryCount(titleCount, listCount)} on this
                  device will be overwritten.
                </Text>
                <Button
                  label="Back up current library first"
                  icon="download"
                  disabled={busy}
                  onPress={startExport}
                />
                <Text style={[styles.backupMeta, styles.backupCentered]}>
                  Save a recovery copy before restoring.
                </Text>
              </View>
            ) : null}
            <Button
              label="Continue to restore"
              icon="history"
              tone="violet"
              disabled={busy}
              onPress={() => setConfirm(true)}
            />
            <Button
              label="Choose another file"
              icon="folderOpen"
              disabled={busy}
              onPress={selectFile}
            />
          </>
        ) : null}
        {state.kind === "restoring" ? (
          <View style={styles.backupCard} accessibilityLiveRegion="polite">
            <View style={styles.backupRow}>
              <ActivityIndicator size="large" color={palette.violetText} />
              <View style={styles.backupFlexible}>
                <Text accessibilityRole="header" style={styles.backupHeading}>
                  Restoring library…
                </Text>
                <Text style={styles.backupAmber}>Writing to this device</Text>
              </View>
            </View>
            <Text style={styles.backupCopy}>
              Rocket is restoring titles, lists, and journal entries. Please
              keep the app open.
            </Text>
            <FileCard name={state.file.name} detail="Source backup · JSON" />
            <Note
              icon="shield"
              message="Changes are saved only if the entire restore succeeds."
            />
          </View>
        ) : null}
        {state.kind === "success" && counts ? (
          <View style={styles.backupCard} accessibilityLiveRegion="polite">
            <View style={styles.backupSuccessHeader}>
              <Badge icon="circleCheck" tone="success" />
              <Text accessibilityRole="header" style={styles.backupHero}>
                Library restored
              </Text>
              <Text style={[styles.backupCopy, styles.backupCentered]}>
                Your titles, lists, and journals are ready offline.
              </Text>
            </View>
            {metrics.slice(0, 3).map(({ key, label, icon }) => (
              <View key={key} style={[styles.backupRow, styles.backupInset]}>
                <Icon name={icon} size={18} color={palette.violetText} />
                <Text style={[styles.backupLabel, styles.backupFlexible]}>
                  {label} restored
                </Text>
                <Text style={styles.backupHeading}>{number(counts[key])}</Text>
              </View>
            ))}
            <Button
              label="Back to library"
              icon="chevronRight"
              tone="violet"
              onPress={onLibrary}
            />
          </View>
        ) : null}
        {state.kind === "failure" ? (
          <View style={styles.backupCard} accessibilityLiveRegion="polite">
            <Heading title={state.title} icon="fileWarning" tone="danger" />
            <Text style={styles.backupCopy}>{state.message}</Text>
            <Note
              icon="shield"
              tone="success"
              message="Your current library hasn’t changed."
            />
            {state.retry ? (
              <Button
                label="Review backup again"
                tone="violet"
                disabled={busy}
                onPress={() => {
                  if (state.retry)
                    setState({ kind: "preview", file: state.retry });
                }}
              />
            ) : null}
            <Button
              label="Choose another file"
              icon="folderOpen"
              disabled={busy}
              onPress={selectFile}
            />
          </View>
        ) : null}
        {busy && state.kind !== "restoring" && !snapshot ? (
          <ActivityIndicator
            color={palette.violetText}
            accessibilityLabel="Working"
          />
        ) : null}
        {notice ? (
          <Text style={styles.backupMeta} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!snapshot}
        transparent
        animationType="fade"
        onRequestClose={back}
      >
        {snapshot && exportCounts ? (
          <SafeAreaView
            style={[dialogStyles.deleteOverlay, styles.backupSheetOverlay]}
            accessibilityViewIsModal
          >
            <Pressable
              style={dialogStyles.deleteBackdrop}
              onPress={back}
              accessible={false}
              disabled={busy}
            />
            <ScrollView
              style={styles.backupSheet}
              contentContainerStyle={styles.backupCard}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.backupHandle} />
              <View style={styles.backupRow}>
                <Icon name="share" size={20} color={palette.violetText} />
                <Text
                  accessibilityRole="header"
                  style={[styles.backupHeading, styles.backupFlexible]}
                >
                  Export backup
                </Text>
                <Pressable
                  onPress={back}
                  style={styles.backupIconButton}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Close export"
                >
                  <Icon name="x" size={18} color={palette.muted} />
                </Pressable>
              </View>
              <FileCard
                name={snapshot.name}
                detail={`${dateLabel(snapshot.backup.exportedAt)} · ${number(Math.max(1, Math.ceil(snapshot.bytes / 1024)))} KB · Rocket JSON`}
              />
              <View style={styles.backupMetricsStrip}>
                {metrics.slice(0, 3).map(({ key, label }) => (
                  <View key={key} style={styles.backupSmallMetric}>
                    <Text style={styles.backupHeading}>
                      {number(exportCounts[key])}
                    </Text>
                    <Text style={[styles.backupMeta, styles.backupCentered]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
              <Note
                icon="lockOpen"
                tone="amber"
                message="This file is not encrypted. It contains your private notes and journal entries. Provider credentials are not included."
              />
              <Note
                icon="image"
                message="Cover links are included, not image files. Covers may need an internet connection to load again."
              />
              {exportError ? (
                <Text
                  accessibilityRole="alert"
                  style={dialogStyles.deleteError}
                >
                  {exportError}
                </Text>
              ) : null}
              {busy ? (
                <ActivityIndicator
                  color={palette.violetText}
                  accessibilityLabel="Preparing backup file"
                />
              ) : null}
              {canSaveBackup ? (
                <Button
                  label="Save backup file"
                  icon="download"
                  tone="violet"
                  disabled={busy}
                  onPress={() => exportFile("save")}
                />
              ) : null}
              <Button
                label={canSaveBackup ? "Share file" : "Save or share file"}
                icon="share"
                tone={canSaveBackup ? "neutral" : "violet"}
                disabled={busy}
                onPress={() => exportFile("share")}
              />
              <Button label="Cancel" disabled={busy} onPress={back} />
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <Modal
        visible={confirm && state.kind === "preview"}
        transparent
        animationType="fade"
        onRequestClose={back}
      >
        {confirm && state.kind === "preview" && counts ? (
          <SafeAreaView
            style={dialogStyles.deleteOverlay}
            accessibilityViewIsModal
          >
            <Pressable
              style={dialogStyles.deleteBackdrop}
              onPress={back}
              accessible={false}
            />
            <ScrollView
              style={styles.backupConfirm}
              contentContainerStyle={styles.backupCard}
            >
              <Badge
                icon={occupied ? "triangleAlert" : "archiveRestore"}
                tone={occupied ? "danger" : "violet"}
              />
              <Text accessibilityRole="header" style={styles.backupHero}>
                {occupied ? "Replace your library?" : "Restore this backup?"}
              </Text>
              <Text style={styles.backupCopy}>
                {occupied
                  ? "Your current titles, lists, notes, and journal entries will be replaced. "
                  : "This imports the backup into your empty library. "}
                Provider credentials on this device will stay unchanged.
              </Text>
              <View style={styles.backupConfirmSummary}>
                {occupied ? (
                  <Text style={[styles.backupMeta, styles.backupStruck]}>
                    Current on device · {libraryCount(titleCount, listCount)}
                  </Text>
                ) : null}
                <Text style={styles.backupViolet}>Incoming restore</Text>
                <Text style={styles.backupLabel}>
                  {libraryCount(counts.titles, counts.lists)}
                </Text>
                <Text style={styles.backupMeta}>
                  Provider credentials stay unchanged.
                </Text>
              </View>
              <Button
                label={occupied ? "Replace library" : "Restore library"}
                icon="refresh"
                tone={occupied ? "danger" : "violet"}
                disabled={busy}
                onPress={() => restore(state.file)}
              />
              <Button label="Cancel" disabled={busy} onPress={back} />
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

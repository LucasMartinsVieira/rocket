import { Text, View } from "react-native";
import { WIDE_MEDIA_CARD_WIDTH } from "../../components/MediaUI";
import { layoutStyles } from "../../components/shared/layout.styles";
import { SPACING } from "../../theme";
import { skeletonStyles, styles } from "./styles";

const TYPE_CHIP_WIDTHS = [48, 72, 76, 78, 68];
const STATUS_CHIP_WIDTHS = [96, 84, 108, 100];

function FilterPlaceholders({ widths }: { widths: number[] }) {
  return (
    <View style={[layoutStyles.chipRail, skeletonStyles.filterRail]}>
      {widths.map((width) => (
        <View key={width} style={[skeletonStyles.chip, { width }]} />
      ))}
    </View>
  );
}

export function LibrarySkeleton({
  wide,
  width,
}: {
  wide: boolean;
  width: number;
}) {
  const columns = wide
    ? Math.max(
        1,
        Math.floor((width - SPACING.lg) / (WIDE_MEDIA_CARD_WIDTH + SPACING.lg)),
      )
    : 2;
  const slots = Array.from({ length: columns }, (_, index) => `slot-${index}`);

  return (
    <>
      <View style={styles.libraryHeading}>
        <View style={styles.libraryTitleLine}>
          <Text style={styles.libraryTitle}>My library</Text>
          <View style={skeletonStyles.count} />
        </View>
      </View>
      <View style={styles.searchBox}>
        <View style={skeletonStyles.searchLine} />
      </View>
      <View style={styles.libraryTools}>
        <View style={skeletonStyles.toggle} />
      </View>
      <FilterPlaceholders widths={TYPE_CHIP_WIDTHS} />
      <FilterPlaceholders widths={STATUS_CHIP_WIDTHS} />
      <View style={skeletonStyles.grid}>
        {["first", "second"].map((row) => (
          <View
            key={row}
            style={[
              skeletonStyles.row,
              wide ? layoutStyles.wideGrid : styles.cardRow,
            ]}
          >
            {slots.map((slot) => (
              <View
                key={slot}
                style={[
                  skeletonStyles.card,
                  wide && { width: WIDE_MEDIA_CARD_WIDTH },
                ]}
              >
                <View style={skeletonStyles.poster} />
                <View style={skeletonStyles.titleLine} />
                <View style={skeletonStyles.metadataLine} />
                <View style={skeletonStyles.statusPill} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

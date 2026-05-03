import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

interface MarkerGalleryProps {
  markerPaths: string[];
  onReset: () => void;
}

const MarkerGallery: React.FC<MarkerGalleryProps> = ({
  markerPaths,
  onReset,
}) => {
  const renderItem = ({item, index}: {item: string; index: number}) => (
    <View style={styles.card}>
      <Image
        source={{uri: `file://${item}`}}
        style={styles.markerImage}
        resizeMode="contain"
      />
      <View style={styles.cardFooter}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>#{index + 1}</Text>
        </View>
        <Text style={styles.sizeText}>300×300</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Marker Gallery</Text>
          <Text style={styles.headerSubtitle}>
            {markerPaths.length} markers collected
          </Text>
        </View>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={onReset}
          activeOpacity={0.7}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {markerPaths.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyText}>No markers scanned yet</Text>
          <Text style={styles.emptyHint}>
            Point your camera at a marker to begin scanning
          </Text>
        </View>
      ) : (
        <FlatList
          data={markerPaths}
          renderItem={renderItem}
          keyExtractor={(item, index) => `marker-${index}-${item}`}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff3b30',
  },
  gridContent: {
    padding: GRID_PADDING,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  card: {
    width: ITEM_SIZE,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  markerImage: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: '#111',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  indexBadge: {
    backgroundColor: '#0af',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  sizeText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default MarkerGallery;

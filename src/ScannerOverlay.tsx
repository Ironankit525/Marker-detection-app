import React from 'react';
import {StyleSheet, View, Text, TouchableOpacity, Dimensions} from 'react-native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const RETICLE_SIZE = SCREEN_WIDTH * 0.7;

interface ScannerOverlayProps {
  markerCount: number;
  maxMarkers: number;
  statusText: string;
  isProcessing: boolean;
  onViewGallery?: () => void;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  markerCount,
  maxMarkers,
  statusText,
  isProcessing,
  onViewGallery,
}) => {
  const progress = markerCount / maxMarkers;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.appTitle}>Marker Scanner</Text>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {markerCount}/{maxMarkers}
            </Text>
          </View>
        </View>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Center reticle */}
      <View style={styles.reticleContainer}>
        <View style={styles.reticle}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={[styles.corner, styles.cornerBL]} />

          {/* Center crosshair */}
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />

          {/* Processing indicator */}
          {isProcessing && (
            <View style={styles.processingDot}>
              <View style={styles.processingDotInner} />
            </View>
          )}
        </View>
        <Text style={styles.reticleHint}>
          Align marker within the frame
        </Text>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {width: `${progress * 100}%`}]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        {/* View Gallery button */}
        {onViewGallery && (
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={onViewGallery}
            activeOpacity={0.7}>
            <Text style={styles.galleryButtonText}>
              View Gallery ({markerCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  counterBadge: {
    backgroundColor: '#0af',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  statusText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '500',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#0af',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#0af',
    borderTopRightRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#0af',
    borderBottomRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#0af',
    borderBottomLeftRadius: 4,
  },
  crosshairH: {
    position: 'absolute',
    width: 20,
    height: 1,
    backgroundColor: 'rgba(0, 170, 255, 0.5)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0, 170, 255, 0.5)',
  },
  processingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 255, 100, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0f6',
  },
  reticleHint: {
    marginTop: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0af',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0af',
    width: 45,
    textAlign: 'right',
  },
  galleryButton: {
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#0af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  galleryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0af',
  },
});

export default ScannerOverlay;

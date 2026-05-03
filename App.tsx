import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  NativeModules,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useFrameOutput,
  useCameraPermission,
} from 'react-native-vision-camera';
import {runOnJS} from 'react-native-worklets';
import ScannerOverlay from './src/ScannerOverlay';
import MarkerGallery from './src/MarkerGallery';

const {MarkerNativeModule} = NativeModules;
const MAX_MARKERS = 20;

type AppState = 'scanning' | 'gallery';

// JS-side processing flag (NOT in a worklet)
let jsProcessing = false;

function App(): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>('scanning');
  const [markerPaths, setMarkerPaths] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [opencvReady, setOpencvReady] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');

  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');

  // Initialize OpenCV on mount
  useEffect(() => {
    const init = async () => {
      try {
        await MarkerNativeModule.initOpenCV();
        setOpencvReady(true);
        setStatusText('Ready to scan');
      } catch (e) {
        setStatusText('OpenCV init failed');
        console.error('OpenCV init failed:', e);
      }
    };
    init();
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Callback to add a new marker path from the native side
  const onMarkerDetected = useCallback((path: string) => {
    setMarkerPaths(prev => {
      if (prev.length >= MAX_MARKERS) return prev;
      if (prev.includes(path)) return prev;
      const updated = [...prev, path];
      if (updated.length >= MAX_MARKERS) {
        setAppState('gallery');
        setStatusText('All 20 markers collected!');
      }
      return updated;
    });
  }, []);

  // Receive frame data from worklet and process via native module
  const handleFrameData = useCallback((base64: string, w: number, h: number, orientation: string) => {
    if (jsProcessing) return; // Skip if already processing
    jsProcessing = true;
    setIsProcessing(true);
    setStatusText(`Scanning ${w}x${h}...`);

    MarkerNativeModule.processFrame(base64, w, h, markerPaths.length, orientation)
      .then((result: string | null) => {
        if (result === "ERROR: INCORRECT_IMAGE") {
          setStatusText('Warning: Incorrect Marker Image!');
          setTimeout(() => {
            jsProcessing = false;
            setIsProcessing(false);
            setStatusText('Scanning...');
          }, 1500); // Show warning for 1.5 seconds
        } else if (result) {
          onMarkerDetected(result);
          // Add a short 300ms cooldown to prevent capturing 20 copies of the exact same marker instantly
          setTimeout(() => {
            jsProcessing = false;
            setIsProcessing(false);
          }, 300);
        } else {
          jsProcessing = false;
          setIsProcessing(false);
          setStatusText('Scanning...');
        }
      })
      .catch(() => {
        jsProcessing = false;
        setIsProcessing(false);
        setStatusText('Scanning...');
      });
  }, [markerPaths.length, onMarkerDetected]);

  // Frame processor output - runs on worklet thread
  // Only job: extract Y-plane bytes, base64 encode, and send to JS thread
  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet';
      try {
        const w = frame.width;
        const h = frame.height;

        // For planar YUV frames, get the Y-plane
        let base64 = '';
        if (frame.isPlanar) {
          const planes = frame.getPlanes();
          if (planes.length > 0) {
            const yPlane = planes[0];
            const yBuffer = yPlane.getPixelBuffer();
            const ySize = yPlane.width * yPlane.height;
            const bytes = new Uint8Array(yBuffer, 0, ySize);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 1024) {
              const end = Math.min(i + 1024, bytes.length);
              for (let j = i; j < end; j++) {
                binary += String.fromCharCode(bytes[j]);
              }
            }
            base64 = globalThis.btoa(binary);
          }
        } else {
          const pixelBuffer = frame.getPixelBuffer();
          const totalSize = w * h;
          const bytes = new Uint8Array(pixelBuffer, 0, totalSize);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 1024) {
            const end = Math.min(i + 1024, bytes.length);
            for (let j = i; j < end; j++) {
              binary += String.fromCharCode(bytes[j]);
            }
          }
          base64 = globalThis.btoa(binary);
        }

        const orientation = frame.orientation;

        frame.dispose();

        if (base64.length > 0) {
          runOnJS(handleFrameData)(base64, w, h, orientation);
        }
      } catch (_e) {
        frame.dispose();
      }
    },
  });

  // Reset handler
  const handleReset = useCallback(async () => {
    try {
      await MarkerNativeModule.clearCache();
    } catch (e) {
      console.error('Clear cache failed:', e);
    }
    setMarkerPaths([]);
    setAppState('scanning');
    setStatusText('Ready to scan');
    jsProcessing = false;
    setIsProcessing(false);
  }, []);

  // Render no permission state
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📸</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            This app needs camera access to scan markers. Please grant camera
            permission in your device settings.
          </Text>
          <Text style={styles.permissionButton} onPress={requestPermission}>
            Grant Permission
          </Text>
        </View>
      </View>
    );
  }

  // Render no device state
  if (!device) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>⚠️</Text>
          <Text style={styles.permissionTitle}>No Camera Found</Text>
          <Text style={styles.permissionText}>
            Could not find a camera device. Please ensure your device has a
            camera.
          </Text>
        </View>
      </View>
    );
  }

  // Gallery view
  if (appState === 'gallery') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <MarkerGallery
          markerPaths={markerPaths}
          onReset={handleReset}
        />
      </View>
    );
  }

  // Scanner view
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={appState === 'scanning' && opencvReady && markerPaths.length < MAX_MARKERS}
        outputs={[frameOutput]}
      />
      <ScannerOverlay
        markerCount={markerPaths.length}
        maxMarkers={MAX_MARKERS}
        statusText={statusText}
        isProcessing={isProcessing}
        onViewGallery={
          markerPaths.length > 0
            ? () => setAppState('gallery')
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0af',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#0af',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default App;

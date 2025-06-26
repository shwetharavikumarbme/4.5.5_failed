import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';
import { View, Image, ImageBackground, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';

const MAX_WIDTH = 1280;
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 200;

const PlayOverlayThumbnail = forwardRef(({ thumbnailUri, playIcon }, ref) => {
  const viewShotRef = useRef();
  const [scaledDimensions, setScaledDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [iconLoaded, setIconLoaded] = useState(false);
  const readyToCaptureRef = useRef(false);
  const isReady = thumbnailUri && scaledDimensions.width > 0;

  useImperativeHandle(ref, () => ({
    capture: async () => {
      console.log('🎬 Attempting capture...');
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (!readyToCaptureRef.current) {
          console.log(`⏳ Not ready yet (attempt ${i + 1})...`);
          await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
          continue;
        }

        try {
          const uri = await viewShotRef.current.capture();
          console.log('✅ Capture successful! URI:', uri);

          // Reset after capture
          reset();
          return uri;
        } catch (error) {
          console.error(`❌ Error capturing (attempt ${i + 1}):`, error);
          await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        }
      }

      console.warn('⚠️ Capture failed after retries, returning original thumbnailUri');
      reset();
      return thumbnailUri;
    },
  }));

  const reset = () => {
    readyToCaptureRef.current = false;
    setImageLoaded(false);
    setIconLoaded(false);
    setScaledDimensions({ width: 0, height: 0 });
  };

  useEffect(() => {
    if (thumbnailUri) {
      console.log('🖼️ Fetching image size for:', thumbnailUri);
      Image.getSize(
        thumbnailUri,
        (width, height) => {
          const scaledWidth = width > MAX_WIDTH ? MAX_WIDTH : width;
          const scaledHeight = (height / width) * scaledWidth;
          setScaledDimensions({ width: scaledWidth, height: scaledHeight });

          console.log('📏 Original dimensions:', { width, height });
          console.log('🔧 Scaled down to:', { scaledWidth, scaledHeight });
        },
        (error) => {
          console.error('❌ Failed to get image size:', error);
        }
      );
    }
  }, [thumbnailUri]);

  useEffect(() => {
    if (imageLoaded && iconLoaded && scaledDimensions.width > 0) {
      console.log('✅ Thumbnail and overlay are ready for capture');
      readyToCaptureRef.current = true;
    }
  }, [imageLoaded, iconLoaded, scaledDimensions]);

  if (!thumbnailUri || scaledDimensions.width === 0) return null;

  const resolvedIcon =
    typeof playIcon === 'number'
      ? resolveAssetSource(playIcon).uri
      : playIcon;

  const iconSize = Math.min(scaledDimensions.width, scaledDimensions.height) * 0.15;
  console.log('🎯 Resolved icon:', resolvedIcon, 'Icon size:', iconSize);

  return (
    <View style={[styles.hidden, !isReady && { display: 'none' }]}>
      <ViewShot
        ref={viewShotRef}
        options={{
          format: 'jpg',
          quality: 1.0,
        }}
      >
        <ImageBackground
          source={{ uri: thumbnailUri }}
          style={{
            width: scaledDimensions.width,
            height: scaledDimensions.height,
          }}
          onLoad={() => {
            console.log('✅ Thumbnail image loaded');
            setImageLoaded(true);
          }}
          onError={(e) =>
            console.error('❌ Thumbnail failed to load:', e.nativeEvent)
          }
        >
          <View style={styles.iconWrapper}>
            <Image
              source={{ uri: resolvedIcon }}
              style={{
                width: iconSize,
                height: iconSize,
                opacity: 0.8,
              }}
              resizeMode="contain"
              onLoad={() => {
                console.log('✅ Play icon loaded');
                setIconLoaded(true);
              }}
              onError={(e) =>
                console.error('❌ Play icon failed to load:', e.nativeEvent)
              }
            />
          </View>
        </ImageBackground>
      </ViewShot>
    </View>
  );
  
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -1000,
    left: 0,
    zIndex: -1,
    opacity: 0 
  },
  iconWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PlayOverlayThumbnail;

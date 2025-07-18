import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Linking,
  StyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import Carousel from 'react-native-reanimated-carousel';
import apiClient from './ApiClient';

const windowWidth = Dimensions.get('window').width;
const bannerHeight = 216;

const Banner01 = () => {
  const [banners, setBanners] = useState([]);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef(null);
  const timerRef = useRef(null);

  const fetchHomeBannerImages = useCallback(async () => {
    try {
      const response = await apiClient.post('/getBannerImages', {
        command: 'getBannerImages',
        banners_id: '00000',
      });

      if (response.data.status === 'success') {
        const bannerItems = [];

        for (const banner of response.data.response) {
          if (banner.files?.length > 0) {
            for (const file of banner.files) {
              const { fileKey, redirect } = file;
              try {
                const res = await apiClient.post('/getObjectSignedUrl', {
                  command: 'getObjectSignedUrl',
                  bucket_name: 'bme-app-admin-data',
                  key: fileKey,
                });

                const signedUrl = res.data;
                if (signedUrl) {
                  const type = fileKey.endsWith('.mp4') ? 'video' : 'image';
                  bannerItems.push({
                    url: signedUrl,
                    type,
                    redirect: redirect?.target_url || null,
                  });
                }
              } catch (err) {
                console.warn(`Error fetching URL for ${fileKey}:`, err);
              }
            }
          }
        }

        setBanners(bannerItems);
      }
    } catch (err) {
      console.error('Error fetching banner data:', err);
      setError(err);
    }
  }, []);

  useEffect(() => {
    fetchHomeBannerImages();
  }, [fetchHomeBannerImages]);

  // Custom timer logic
  useEffect(() => {
    if (!banners.length) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const currentBanner = banners[currentIndex];
    const delay = currentBanner.type === 'video' ? 10000 : 3000;

    timerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      setCurrentIndex(nextIndex);
      carouselRef.current?.scrollTo({ index: nextIndex, animated: true });
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, banners]);

  const handleRedirect = (url) => {
    if (url && typeof url === 'string') {
      const fixedUrl = url.startsWith('http') ? url : 'https://' + url;
      Linking.openURL(fixedUrl).catch((err) =>
        console.warn('Failed to open URL:', err)
      );
    }
  };

  if (error || banners.length === 0) return null;

  return (
    <View style={styles.carouselContainer}>
      <Carousel
        ref={carouselRef}
        width={windowWidth-10}
        height={bannerHeight}
        loop
        data={banners}
        enabled={false} // disables user swipe
        mode="horizontal"
        scrollAnimationDuration={800}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            key={index}
            style={styles.bannerSlide}
            activeOpacity={1}
            onPress={() => handleRedirect(item.redirect)}
          >
            {item.type === 'image' ? (
              <FastImage
                source={{ uri: item.url }}
                style={styles.media}
                resizeMode="cover"
              />
            ) : (
              <Video
                source={{ uri: item.url }}
                style={styles.media}
                resizeMode="cover"
                repeat
                muted
                paused={currentIndex !== index}
              />
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    width: windowWidth-10,
    height: bannerHeight,
    alignSelf: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  bannerSlide: {
    width: windowWidth-10,
    height: bannerHeight,
    borderRadius: 14,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
});

export default Banner01;

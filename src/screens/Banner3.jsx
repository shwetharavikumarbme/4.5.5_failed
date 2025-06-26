import axios from 'axios';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Dimensions, PanResponder, Text, Animated } from 'react-native';
import apiClient from './ApiClient';



const Banner03 = () => {
  const [bannerHomeImages, setBannerHomeImages] = useState([]);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeThreshold = 40; // Minimum swipe distance to change slides
  const [isFetchingBanner3, setIsFetchingBanner3] = useState(true);

  const fetchHomeBannerImages = useCallback(async () => {
    setIsFetchingBanner3(true);
    try {
      const response = await apiClient.post('/getBannerImages', {
        command: 'getBannerImages',
        banners_id: '12121',
      });

      if (response.data.status === 'success') {
        const bannerHomeData = response.data.response;
        const urlsObject = {};

        await Promise.all(
          bannerHomeData.map(async (banner) => {
            if (banner.files?.length > 0) {
              await Promise.all(
                banner.files.map(async (fileKey) => {
                  try {
                    const res = await apiClient.post('/getObjectSignedUrl', {
                      command: 'getObjectSignedUrl',
                      bucket_name: 'bme-app-admin-data',
                      key: fileKey,
                    });

                    const img_url = res.data;
                    if (img_url) {
                      urlsObject[fileKey] = img_url;
                    }
                  } catch {
                    // Handle individual file fetch errors silently
                  }
                })
              );
            }
          })
        );

        setBannerHomeImages(Object.values(urlsObject));
      }
    } catch (error) {
      setError(error);
    }
    setIsFetchingBanner3(false);

  }, []);

  useEffect(() => {
    fetchHomeBannerImages();
  }, [fetchHomeBannerImages]);

  // const [currentIndex, setCurrentIndex] = useState(0);
  const windowWidth = Dimensions.get('window').width;
  const [slideAnim] = useState(new Animated.Value(0)); // Animated value for sliding


  // Auto sliding effect every 3 seconds
  useEffect(() => {
    if (bannerHomeImages.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % bannerHomeImages.length);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [bannerHomeImages]);
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: -currentIndex * windowWidth, // Slide to the new index
      duration: 800, // Duration of the slide
      useNativeDriver: true, // Use native driver for better performance
    }).start();
  }, [currentIndex, slideAnim, windowWidth]);

  // Handle swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false, // Allow default behavior initially
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only activate the responder if the swipe is primarily horizontal
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > swipeThreshold) {
        setCurrentIndex((prevIndex) => (prevIndex === 0 ? bannerHomeImages.length - 1 : prevIndex - 1));
      } else if (gestureState.dx < -swipeThreshold) {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % bannerHomeImages.length);
      }
    },
  });

  if (error) {
    return (

      null

    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.carouselContainer}{...panResponder.panHandlers}>
      <View style={styles.imageContainer}>
        <Animated.View
          style={[
            styles.imageContainer1,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {bannerHomeImages.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={styles.image}
              resizeMode="cover"
            />
          ))}
        </Animated.View>
      </View>

    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    flex: 1,
    overflow: 'hidden',

  },

  imageContainer: {
    flex: 1,
    flexDirection: 'row',
    height: 200,
    width: Dimensions.get('window').width - 8,
    gap: 8,
    resizeMode: 'contain',
    alignSelf: 'center',
    borderRadius: 14,
  },

  imageContainer1: {
    flex: 1,
    flexDirection: 'row',
    height: 200,
    width: '100%',
    gap: 8,
    resizeMode: 'contain',
    alignSelf: 'center',
    borderRadius: 14,


  },

  image: {
    width: '100%',
    height: "100%",
    flexx: 1,
    borderRadius: 14,
  },


});


export default Banner03;
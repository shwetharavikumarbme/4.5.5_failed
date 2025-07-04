import axios from 'axios';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Dimensions, Text, PanResponder, Animated } from 'react-native';
import FastImage from 'react-native-fast-image';
import apiClient from './ApiClient';



const Banner01 = () => {
  const [bannerHomeImages, setBannerHomeImages] = useState([]);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeThreshold = 40; 


  const fetchHomeBannerImages = useCallback(async () => {

    try {
      const response = await apiClient.post('/getBannerImages', {
        command: 'getBannerImages',
        banners_id: '54321',
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

  }, []);

  useEffect(() => {
    fetchHomeBannerImages();
  }, [fetchHomeBannerImages]);

  const windowWidth = Dimensions.get('window').width;
  const [slideAnim] = useState(new Animated.Value(0)); 


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
      toValue: -currentIndex * windowWidth,
      duration: 800, 
      useNativeDriver: true,
    }).start();
  }, [currentIndex, slideAnim, windowWidth])


  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false, 
    onMoveShouldSetPanResponder: (evt, gestureState) => {

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
          <FastImage
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

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  imageContainer: {
    flex: 1,
    flexDirection: 'row',
    height: 216,
    width: Dimensions.get('window').width - 8,
    gap: 8,
    resizeMode: 'contain',
    alignSelf: 'center',
    borderRadius: 14,
  },
  imageContainer1: {
    flex: 1,
    flexDirection: 'row',
    height: 216,
    width: '100%',
    gap: 8,
    resizeMode: 'contain',
    alignSelf: 'center',
    borderRadius: 14,
    backgroundColor:"#DDDDDD"

  },


  image: {
    width: '100%',
    height: "100%",
    overflow: 'hidden',
    borderRadius: 14,
    // backgroundColor:'#075cab'

  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

});

export default Banner01;



import axios from 'axios';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated, Image } from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import apiClient from './ApiClient';


const Banner02 = () => {
  const [bannerHomeFiles, setBannerHomeFiles] = useState([]);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(true);
  const [isPlaying, setIsPlaying] = useState({});
  const videoRefs = useRef({});
  const slideInterval = useRef(null);
  const windowWidth = Dimensions.get('window').width;
  const [slideAnim] = useState(new Animated.Value(0));
  const isFocused = useIsFocused();
  const fetchHomeBannerFiles = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await apiClient.post('/getBannerImages', {
        command: 'getBannerImages',
        banners_id: '12345',
      });

      if (response.data.status === 'success') {
        const bannerData = response.data.response;
        const mediaUrls = [];

        await Promise.all(
          bannerData.map(async (banner) => {
            if (banner.files?.length > 0) {
              await Promise.all(
                banner.files.map(async (fileKey) => {
                  try {
                    const res = await apiClient.post('/getObjectSignedUrl', {
                      command: 'getObjectSignedUrl',
                      bucket_name: 'bme-app-admin-data',
                      key: fileKey,
                    });

                    if (res.data) {
                      const type = fileKey.endsWith('.mp4') ? 'video' : 'image';
                      mediaUrls.push({ url: res.data, type });
                    }
                  } catch {
                    // Ignore individual fetch errors
                  }
                })
              );
            }
          })
        );

        setBannerHomeFiles(mediaUrls);
      }

    } catch (error) {
      setError(error);
    }
    setIsFetching(false);
  }, []);

  useEffect(() => {
    fetchHomeBannerFiles();
  }, [fetchHomeBannerFiles]);

  const startAutoSlide = () => {
    if (bannerHomeFiles.length > 0) {
      stopAutoSlide(); // Ensure no duplicate intervals
      slideInterval.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % bannerHomeFiles.length);
      }, 2000);
    }
  };



  const stopAutoSlide = () => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current);
      slideInterval.current = null;
    }
  };


  useEffect(() => {
    if (!isFocused) {
      // Pause all videos when the screen is not in focus
      setIsPlaying({});
    }
  }, [isFocused]);
  useEffect(() => {
    startAutoSlide();
    return () => stopAutoSlide();
  }, [bannerHomeFiles]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: -currentIndex * windowWidth,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, slideAnim, windowWidth]);

  const togglePlayPause = (index) => {
    if (videoRefs.current[index]) {
      if (isPlaying[index]) {
        // Pause the video and restart auto-slide
        setIsPlaying((prevState) => ({
          ...prevState,
          [index]: false,
        }));
        startAutoSlide();
      } else {
        // Stop auto-slide when the video is playing
        stopAutoSlide();
        videoRefs.current[index].seek(0);
        setIsPlaying((prevState) => ({
          ...prevState,
          [index]: true,
        }));
      }
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.carouselContainer}>
      <View style={styles.imageContainer}>
        <Animated.View
          style={[styles.imageContainer1, { transform: [{ translateX: slideAnim }] }]}>
          {bannerHomeFiles.map((file, index) => (
            <View key={index} style={styles.videoWrapper}>
              {file.type === 'video' ? (
                <>
                  <Video
                    ref={(ref) => (videoRefs.current[index] = ref)}
                    source={{ uri: file.url }}
                    style={styles.video}
                    resizeMode="cover"
                    muted={false}
                    volume={1.0}
                    ignoreSilentSwitch="ignore"
                    paused={!isPlaying[index] || currentIndex !== index || !isFocused}
                    onEnd={() => {
                      setIsPlaying((prevState) => ({
                        ...prevState,
                        [index]: false,
                      }));
                      videoRefs.current[index]?.seek(0);
                      startAutoSlide();
                    }}
                  />
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => togglePlayPause(index)}>
                    <Icon
                      name={isPlaying[index] ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={40}
                      color="white"
                      style={{ opacity: isPlaying[index] ? 0 : 0.7 }}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <FastImage
                  source={{ uri: file.url }}
                  style={styles.video}
                  resizeMode="cover"
                />
              )}
            </View>
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
    alignSelf: 'center',
    borderRadius: 14,
  },
  imageContainer1: {
    flex: 1,
    flexDirection: 'row',
    height: 200,
    width: '100%',
    gap: 8,
    alignSelf: 'center',
    borderRadius: 14,

  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  playButton: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1,
  },

});



export default Banner02;
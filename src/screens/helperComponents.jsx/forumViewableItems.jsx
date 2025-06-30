import { Image, Text } from 'react-native';
import { useRef, useState, useCallback, useEffect } from 'react';
import apiClient from '../ApiClient';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg';
import FastImage from 'react-native-fast-image';
import { getSignedUrl } from './signedUrls';

const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;


export const fetchMediaForPost = async (input) => {
    const posts = Array.isArray(input) ? input : [input];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'];
  
    const getAspectRatio = async (uri) => {
      return new Promise((resolve) => {
        Image.getSize(uri, (width, height) => resolve(width / height), () => resolve(1));
      });
    };
  
    const getAuthorImage = async (post) => {
      let authorImageUrl = null;
  
      if (post.author_fileKey) {
        try {
          const res = await getSignedUrl('author', post.author_fileKey);
          authorImageUrl = res?.author || res?.url;
        } catch (err) {
          console.error('Failed to fetch author image:', err);
        }
      }
  
      if (!authorImageUrl) {
        const userType = (post.user_type || '').toLowerCase();
        const gender = (post.author_gender || '').toLowerCase();
        
        if (userType === 'company') return defaultImageUriCompany;
        if (userType === 'users' && gender === 'female') return defaultImageUriFemale;
        return defaultImageUriMale;
      }
  
      return authorImageUrl;
    };
  
    const results = await Promise.all(
      posts.map(async (post) => {
        const mediaData = { forum_id: post.forum_id };
        const fileKey = post.fileKey?.toLowerCase();
  
        if (fileKey) {
          try {
            const res = await getSignedUrl('file', post.fileKey);
            const url = res?.file || res?.url;
  
            if (url) {
              const isVideo = videoExtensions.some(ext => fileKey.endsWith(ext));
  
              if (isVideo) {
                mediaData.videoUrl = url;
  
                if (post.thumbnail_fileKey) {
                  try {
                    const thumbRes = await getSignedUrl('thumb', post.thumbnail_fileKey);
                    mediaData.thumbnailUrl = thumbRes?.thumb || null;
                  } catch {
                    mediaData.thumbnailUrl = null;
                  }
                }
  
                mediaData.aspectRatio = mediaData.thumbnailUrl
                  ? await getAspectRatio(mediaData.thumbnailUrl)
                  : 1;
              } else {
                mediaData.imageUrl = url;
                mediaData.aspectRatio = await getAspectRatio(url);
              }
            }
          } catch {
            mediaData.imageUrl = null;
            mediaData.videoUrl = null;
            mediaData.thumbnailUrl = null;
            mediaData.aspectRatio = 1;
          }
        }
  
        mediaData.authorImageUrl = await getAuthorImage(post);
        return { ...post, ...mediaData };
      })
    );
  
    return Array.isArray(input) ? results : results[0];
  };
  
  export const useLazySignedUrlsForum = (
    allItems = [],
    getSignedUrl,
    prefetchCount = 5,
    {
      idField = 'post_id',
      fileKeyField = 'fileKey',
      authorFileKeyField = 'author_fileKey'
    } = {},
    isFocused,
    isPageFocused,
    activeVideo,
    setActiveVideo
  ) => {
    const signedUrlCache = useRef({});
    const authorImageCache = useRef({});
    const viewedForumIdsRef = useRef(new Set());
  
    const getDefaultAuthorImage = (item) => {
      const userType = (item.user_type || '').toLowerCase();
      const gender = (item.author_gender || '').toLowerCase();
      if (userType === 'company') return defaultImageUriCompany;
      if (userType === 'users' && gender === 'female') return defaultImageUriFemale;
      return defaultImageUriMale;
    };
  
    const getUrlFor = useCallback((id) => {
        const mediaEntry = signedUrlCache.current[id];
        return {
          mediaUrl: mediaEntry?.mediaUrl || defaultImageUriCompany,
          aspectRatio: mediaEntry?.aspectRatio || 1,
          thumbnailUrl: mediaEntry?.thumbnailUrl || null,
          authorUrl: authorImageCache.current[id] || defaultImageUriMale,
        };
      }, []);
      
  
      const fetchSignedUrlIfNeeded = async (item) => {
        if (!item) return;
      
        const id = item[idField];
        if (!id || signedUrlCache.current[id]) return;
      
        console.log(`🟢 [fetchSignedUrlIfNeeded] forum_id: ${id}`);
      
        try {
          const enriched = await fetchMediaForPost(item);
      
          // Store full media metadata
          signedUrlCache.current[id] = {
            mediaUrl: enriched.videoUrl || enriched.imageUrl || defaultImageUriCompany,
            aspectRatio: enriched.aspectRatio || 1,
            thumbnailUrl: enriched.thumbnailUrl || null,
          };
      
          authorImageCache.current[id] = enriched.authorImageUrl || getDefaultAuthorImage(item);
      
          // Prefetch media
          if (signedUrlCache.current[id]?.mediaUrl) {
            FastImage.preload([{ uri: signedUrlCache.current[id].mediaUrl }]);
          }
      
          if (authorImageCache.current[id]) {
            FastImage.preload([{ uri: authorImageCache.current[id] }]);
          }
      
          console.log('✅ [Media Fetched]', id, signedUrlCache.current[id]);
          console.log('✅ [Author Fetched]', id, authorImageCache.current[id]);
        } catch (err) {
          console.warn('❌ [FetchMediaForPost failed]', id, err);
      
          // Fallback values on error
          signedUrlCache.current[id] = {
            mediaUrl: defaultImageUriCompany,
            aspectRatio: 1,
            thumbnailUrl: null,
          };
      
          authorImageCache.current[id] = getDefaultAuthorImage(item);
        }
      };
      
      
      
  
    const incrementViewCount = async (forumId) => {
      try {
        await apiClient.post('/forumViewCounts', {
          command: 'forumViewCounts',
          forum_id: forumId,
        });
      } catch (error) {
        console.error("View count error:", error);
      }
    };
  
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
      if (!isFocused || !isPageFocused || !viewableItems.length) {
        setActiveVideo(null);
        return;
      }
  
      const visibleVideos = viewableItems
        .filter(item => item.item.videoUrl && item.item.forum_id)
        .sort((a, b) => a.index - b.index);
  
      if (visibleVideos.length > 0) {
        const firstVideo = visibleVideos[0];
        const isCurrentVisible = viewableItems.some(
          item => item.item.forum_id === activeVideo
        );
  
        if (activeVideo && !isCurrentVisible) {
          setActiveVideo(null);
        }
  
        if (!activeVideo || firstVideo.item.forum_id !== activeVideo) {
          setActiveVideo(firstVideo.item.forum_id);
        }
      } else {
        setActiveVideo(null);
      }
  
      // View count
      viewableItems.forEach(({ item }) => {
        const forumId = item.forum_id;
        if (forumId && !viewedForumIdsRef.current.has(forumId)) {
          viewedForumIdsRef.current.add(forumId);
          incrementViewCount(forumId);
        }
      });
  
      // Prefetching logic
      const visibleIndices = viewableItems.map(({ index }) => index).filter(i => i != null);
      if (visibleIndices.length) {
        const maxIndex = Math.max(...visibleIndices);
        const endIndex = Math.min(maxIndex + prefetchCount, allItems.length - 1);
  
        const itemsToFetch = new Set([...viewableItems.map(({ item }) => item)]);
        for (let i = maxIndex + 1; i <= endIndex; i++) {
          allItems[i] && itemsToFetch.add(allItems[i]);
        }
  
        itemsToFetch.forEach(item => {
          const id = item[idField];
          if (id && (!signedUrlCache.current[id] || !authorImageCache.current[id])) {
            fetchSignedUrlIfNeeded(item);
          }
        });
      }
    }).current;
  
    const viewabilityConfig = {
      itemVisiblePercentThreshold: 10,
      waitForInteraction: false,
    };
  
    useEffect(() => {
      const initialItems = allItems.slice(0, prefetchCount);
      initialItems.forEach(item => {
        const id = item[idField];
        if (id && (!signedUrlCache.current[id] || !authorImageCache.current[id])) {
          fetchSignedUrlIfNeeded(item);
        }
      });
    }, [allItems]);
  
    return {
      getUrlFor,
      onViewableItemsChanged,
      viewabilityConfig,
    };
  };
  
import { Image, Text } from 'react-native';
import { useRef, useState, useCallback, useEffect } from 'react';
import apiClient from '../ApiClient';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg';
import FastImage from 'react-native-fast-image';
import { getSignedUrl, useLazySignedUrls } from './signedUrls';

const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;


export const fetchMediaForPost = async (input) => {
  const posts = Array.isArray(input) ? input : [input];
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'];

  const getAuthorImage = async (post) => {
    let authorImageUrl = null;

    if (post.author_fileKey) {
      try {
        console.log(`Fetching author image for key: ${post.author_fileKey}`);
        const res = await getSignedUrl('author', post.author_fileKey);
        console.log('Author image signed URL response:', res);
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

      console.log('\n========== Processing Post ==========');
      console.log('Post:', post);
      console.log('FileKey:', fileKey);

      if (fileKey) {
        try {
          console.log(`Fetching signed URL for fileKey: ${post.fileKey}`);
          const res = await getSignedUrl('file', post.fileKey);
          console.log('File signed URL response:', res);

          const url = res?.file || res?.url;
          console.log('Resolved file/media URL:', url);

          if (url) {
            const isVideo = videoExtensions.some(ext => fileKey.endsWith(ext));
            console.log('Is Video:', isVideo);

            if (isVideo) {
              mediaData.videoUrl = url;

              if (post.thumbnail_fileKey) {
                try {
                  console.log(`Fetching thumbnail for: ${post.thumbnail_fileKey}`);
                  const thumbRes = await getSignedUrl('thumb', post.thumbnail_fileKey);
                  console.log('Thumbnail signed URL response:', thumbRes);
                  mediaData.thumbnailUrl = thumbRes?.thumb || null;
                } catch (err) {
                  console.warn('Failed to fetch thumbnail:', err);
                  mediaData.thumbnailUrl = null;
                }
              } else {
                console.log('No thumbnail_fileKey provided.');
                mediaData.thumbnailUrl = null;
              }
            } else {
              mediaData.imageUrl = url;
            }
          } else {
            console.warn('URL was not resolved from signed URL response.');
          }
        } catch (err) {
          console.error('Error while fetching media URL:', err);
          mediaData.imageUrl = null;
          mediaData.videoUrl = null;
          mediaData.thumbnailUrl = null;
        }
      } else {
        console.warn('fileKey is missing or invalid:', fileKey);
      }

      mediaData.authorImageUrl = await getAuthorImage(post);

      const enrichedPost = { ...post, ...mediaData };
      console.log('✅ Final enriched post:', enrichedPost);
      return enrichedPost;
    })
  );

  return Array.isArray(input) ? results : results[0];
};



  export const useForumMedia = (posts) => {
    const {
      getUrlFor,
      onViewableItemsChanged,
      viewabilityConfig,
      preloadUrls
    } = useLazySignedUrls(posts, getSignedUrl, 5, {
      idField: 'forum_id',
      fileKeyField: 'fileKey'
    });
  
    console.log('getUrlFor function exists:', typeof getUrlFor === 'function');
    console.log('viewabilityConfig:', viewabilityConfig);
    console.log('preloadUrls:', preloadUrls);
  
    const getMediaForItem = useCallback((item) => {
      const fileKey = item.fileKey;
      if (!fileKey) {
        console.log('No fileKey found for item:', item);
        return {};
      }
  
      const url = getUrlFor(item.forum_id);
      if (!url) {
        console.log('No URL found for forum_id:', item.forum_id);
        return {};
      }
  
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'];
      const isVideo = videoExtensions.some(ext => fileKey.toLowerCase().endsWith(ext));
  
      const result = {
        [isVideo ? 'videoUrl' : 'imageUrl']: url,
        thumbnailUrl: item.thumbnail_fileKey ? getUrlFor(`${item.forum_id}-thumb`) : null
      };
  
      console.log('getMediaForItem output:', result);
  
      return result;
    }, [getUrlFor]);
  
    const getAuthorImage = useCallback((item) => {
      if (item.author_fileKey) {
        const url = getUrlFor(item.author_fileKey); // ✅ use actual key
        if (url) {
          console.log('getAuthorImage resolved from author_fileKey:', url);
          return url;
        }
      }
    
      const userType = (item.user_type || '').toLowerCase();
      const gender = (item.author_gender || '').toLowerCase();
    
      let fallbackUrl = defaultImageUriMale;
      if (userType === 'company') fallbackUrl = defaultImageUriCompany;
      else if (userType === 'users' && gender === 'female') fallbackUrl = defaultImageUriFemale;
    
      return fallbackUrl;
    }, [getUrlFor]);
    
  
    // Final return log
    console.log('useForumMedia hook returning functions');
  
    return {
      getMediaForItem,
      getAuthorImage,
      onViewableItemsChanged,
      viewabilityConfig,
      preloadUrls
    };
  };
  
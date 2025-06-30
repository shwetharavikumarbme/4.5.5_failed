
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Alert, SafeAreaView, ActivityIndicator, Keyboard, ActionSheetIOS } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import Message3 from '../../components/Message3';
import Message1 from '../../components/Message1';
import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from 'react-native-image-resizer';
import * as Compressor from 'react-native-compressor';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import apiClient from '../ApiClient';
import { useDispatch, useSelector } from 'react-redux';
import { updatePost } from '../Redux/Forum_Actions';
import { captureFinalThumbnail, generateVideoThumbnail, moveToPersistentStorage, resizeImage } from './VideoParams';

import { setMyPostImageUrls, updateMyPost } from '../Redux/MyPosts/MyForumPost_Actions';
import FastImage from 'react-native-fast-image';
import { showToast } from '../AppUtils/CustomToast';
import { useNetwork } from '../AppUtils/IdProvider';
import { EventRegister } from 'react-native-event-listeners';
import AppStyles from '../../assets/AppStyles';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import { decode } from 'html-entities';
import { cleanForumHtml } from './forumBody';

const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];

const ForumEditScreen = () => {
  const dispatch = useDispatch()
    ; const navigation = useNavigation();
  const route = useRoute();
  const profile = useSelector(state => state.CompanyProfile.profile);
  const { myId, myData } = useNetwork();

  const { post, imageUrl } = route.params;

  const [isLoading, setIsLoading] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [mediaType, setMediaType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalIconType, setModalIconType] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const playIcon = require('../../images/homepage/PlayIcon.png');

  const [postData, setPostData] = useState({
    forum_body: post.forum_body || '',
    fileKey: post.fileKey || '',
    thumbnail_fileKey: post.thumbnail_fileKey || '',
  });
  const [fileKey, setFileKey] = useState(postData.fileKey);
  const richText = useRef();

  const [hasChanges, setHasChanges] = useState(false);


  const initialPostDataRef = useRef({
    forum_body: post.forum_body || '',
    fileKey: post.fileKey || '',
    thumbnail_fileKey: post.thumbnail_fileKey || '',
  });

  // ✅ Track changes
  useEffect(() => {
    const initial = initialPostDataRef.current;
    const changed =
      postData.forum_body !== initial.forum_body ||
      postData.fileKey !== initial.fileKey ||
      postData.thumbnail_fileKey !== initial.thumbnail_fileKey;

    setHasChanges(changed);
  }, [postData]);

  // ✅ Handle unsaved changes on navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) return;

      e.preventDefault(); // Block default back
      setPendingAction(e.data.action);
      setShowModal(true);
    });

    return unsubscribe;
  }, [hasChanges, navigation]);


  useEffect(() => {
    const intervalId = setInterval(() => {

      setFileKey(postData.fileKey);
    }, 1000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [postData.fileKey]);


  const handleOk = () => {
    setModalVisible(false);
  };


  const hasUnsavedChanges = Boolean(hasChanges);
  const [pendingAction, setPendingAction] = React.useState(null);


  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();

      setPendingAction(e.data.action);
      setShowModal(true);
    });

    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  const handleLeave = () => {
    setHasChanges(false);
    setShowModal(false);

    if (pendingAction) {
      navigation.dispatch(pendingAction);
      setPendingAction(null);
    }
  };

  const handleStay = () => {
    setShowModal(false);
  };




  useEffect(() => {
    if (post) {

      setPostData({
        title: post.title || '',
        forum_body: post.forum_body || '',
        conclusion: post.conclusion || '',
        fileKey: post.fileKey || '',
        thumbnail_fileKey: post.thumbnail_fileKey || '',
      });
    }
  }, [post]);


  const handleMediaSelection = () => {
    const options = ['Image', 'Video'];
    const callbacks = [openGallery, selectVideo];

    if (postData.fileKey) {
      options.push('Remove');
      callbacks.push(handleRemoveMedia);
    }

    options.push('Cancel');
    callbacks.push(() => { });

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: postData.fileKey ? options.length - 2 : undefined,
        // title: 'Select Media',
      },
      (buttonIndex) => {
        const callback = callbacks[buttonIndex];
        if (callback) callback();
      }
    );
  };



  const openGallery = async () => {
    try {
      const options = {
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      };

      launchImageLibrary(options, async (response) => {
        if (response.didCancel) return;

        if (response.errorCode) {

          showToast(response.errorMessage, 'error');

          return;
        }

        const asset = response.assets?.[0];
        if (!asset) return;

        let fileType = asset.type || '';
        const supportedFormats = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'];

        if (!supportedFormats.includes(fileType)) {

          showToast("Only JPEG and PNG formats are supported", 'error');

          return;
        }

        // Normalize HEIC to JPEG
        if (fileType === 'image/heic' || fileType === 'image/heif') {
          fileType = 'image/jpeg';
        }

        const originalPath = asset.uri.replace('file://', '');
        const originalStats = await RNFS.stat(originalPath);
        const originalFileSize = originalStats.size;

        const originalWidth = asset.width || 1000;
        const originalHeight = asset.height || 1000;

        const maxWidth = 800;
        const maxHeight = 800;
        let newWidth = originalWidth;
        let newHeight = originalHeight;

        if (newWidth > maxWidth || newHeight > maxHeight) {
          const aspectRatio = newWidth / newHeight;
          if (aspectRatio > 1) {
            newWidth = maxWidth;
            newHeight = Math.round(maxWidth / aspectRatio);
          } else {
            newHeight = maxHeight;
            newWidth = Math.round(maxHeight * aspectRatio);
          }
        }

        const compressedImage = await ImageResizer.createResizedImage(
          asset.uri,
          newWidth,
          newHeight,
          'JPEG',
          80
        );

        const compressedPath = compressedImage.uri.replace('file://', '');
        const compressedStats = await RNFS.stat(compressedPath);
        const compressedSize = compressedStats.size;

        const finalFileUri = compressedSize < originalFileSize ? compressedImage.uri : asset.uri;
        const finalFileSize = compressedSize < originalFileSize ? compressedSize : originalFileSize;

        if (finalFileSize > 5 * 1024 * 1024) {

          showToast("Image size shouldn't exceed 5MB", 'error');

          return;
        }

        const fileName = asset.fileName?.replace(/\.[^/.]+$/, '.jpeg') || 'image.jpeg';

        await handleNewFileUpload(finalFileUri, 'image/jpeg', 'image');
      });
    } catch (error) {

      showToast("Something went wrong", 'error');

    }
  };


  const [isCompressing, setIsCompressing] = useState(false);
  const [oldFileKey, setOldFileKey] = useState(null);
  const [capturedThumbnailUri, setCapturedThumbnailUri] = useState(null);
  const overlayRef = useRef();

  const selectVideo = async () => {
    if (isCompressing) {
      showToast("video uploading is already in progress. Please wait", 'info');

      return;
    }

    launchImageLibrary({ mediaType: 'video', quality: 1 }, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        return showToast(response.errorMessage, 'error');
      }

      const asset = response.assets[0];

      const rawDuration = asset.duration || 0;
      const totalSeconds = Math.floor(rawDuration);
      if (totalSeconds > 1800) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        showToast("Please select a video that is 30 minutes or shorter", 'error');

        return;
      }


      setSelectedMedia({
        uri: asset.uri,
        mediaType: 'video',
        type: asset.type,
      });

      const originalPath = asset.uri.replace('file://', '');
      const originalStats = await RNFS.stat(originalPath);


      try {
        const thumbnail = await generateVideoThumbnail(asset.uri);
        if (thumbnail) {

          setThumbnailUri(thumbnail);
        } else {

        }
      } catch (thumbnailError) {

      }

      const maxFileSize = 10 * 1024 * 1024; // 10MB limit
      let finalUri = asset.uri;
      let finalSize = originalStats.size;

      // ✅ Compress the video
      setIsCompressing(true);

      showToast("Uploading Video\nThis may take a moment..", 'info');

      try {
        const compressedUri = await Compressor.Video.compress(asset.uri, {
          compressionMethod: 'auto',
          progressDivider: 5,
        }, (progress) => {

        });

        const compressedStats = await RNFS.stat(compressedUri.replace('file://', ''));
        const compressedSizeMB = (compressedStats.size / (1024 * 1024)).toFixed(2);

        if (compressedStats.size < originalStats.size) {
          finalUri = compressedUri;
          finalSize = compressedStats.size;
        }
      } catch (compressionError) {

      } finally {
        setIsCompressing(false);
      }

      if (finalSize > maxFileSize) {
        setModalTitle('Caution!!');
        setModalMessage("Video size shouldn't exceed 10 MB");
        setModalIconType('warning');
        setModalVisible(true);
        return;
      }

      const persistentUri = await moveToPersistentStorage(finalUri);
      const previewThumbnail = await generateVideoThumbnail(persistentUri);

      if (previewThumbnail) {
        setThumbnailUri(previewThumbnail);

        setTimeout(async () => {
          const finalThumb = await captureFinalThumbnail(overlayRef);

          if (finalThumb) {
            const resizedThumbUri = await resizeImage(finalThumb);
            setCapturedThumbnailUri(resizedThumbUri);
          }
        }, 300);
      }

      await handleNewFileUpload(persistentUri, asset.type, 'video');
    });
  };




  const handleThumbnailUpload = async (thumbnailUri, fileKey) => {
    try {

      const thumbStat = await RNFS.stat(thumbnailUri);
      const thumbBlob = await uriToBlob(thumbnailUri);
      const thumbnailFileKey = `thumbnail-${fileKey}`;

      const res = await apiClient.post('/uploadFileToS3', {
        command: 'uploadFileToS3',
        fileKey: thumbnailFileKey,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': thumbStat.size,
        },
      });

      if (res.data.status !== 'success') {
        throw new Error('Failed to get upload URL for thumbnail');
      }

      const uploadUrl = res.data.url;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: thumbBlob,
      });

      if (uploadRes.status !== 200) {
        throw new Error('Failed to upload thumbnail to S3');
      }

      return thumbnailFileKey;
    } catch (error) {

      return null;
    }
  };

  const isVideo = postData.fileKey && postData.fileKey.endsWith('.mp4');

  async function uriToBlob(uri) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  }


  const uploadFile = async (uri, type) => {
    try {
      // ✅ Step 1: Get file size
      const fileStat = await RNFS.stat(uri);
      const fileSize = fileStat.size;

      if (type.startsWith('image/') && fileSize > 5 * 1024 * 1024) {
        showToast("Image size shouldn't exceed 5MB", 'error');
        return;
      }
      if (type.startsWith('video/') && fileSize > 10 * 1024 * 1024) {
        showToast("Video size shouldn't exceed 10MB", 'error');

        return;
      }

      const res = await apiClient.post('/uploadFileToS3', {
        command: 'uploadFileToS3',
        headers: {
          'Content-Type': type,
          'Content-Length': fileSize,
        },
      });

      if (res.data.status !== 'success') {
        throw new Error(res.data.errorMessage || 'Failed to get upload URL');
      }

      const uploadUrl = res.data.url;
      const fileKey = res.data.fileKey;

      const fileBlob = await uriToBlob(uri);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: fileBlob,
      });

      if (uploadRes.status !== 200) {
        throw new Error('Failed to upload file to S3');
      }

      let thumbnailFileKey = null;
      if (type.startsWith("video/")) {
        let finalThumbnailToUpload = capturedThumbnailUri;

        if (!finalThumbnailToUpload) {

          finalThumbnailToUpload = await generateVideoThumbnail(uri);
        }
        if (finalThumbnailToUpload) {

          thumbnailFileKey = await handleThumbnailUpload(finalThumbnailToUpload, fileKey);
        }
      }

      return { fileKey, thumbnailFileKey };

    } catch (error) {
      showToast("Something went wrong during file upload", 'error');

      return null;
    }
  };


  const handleNewFileUpload = async (uri, type, mediaType) => {
    try {
      setIsLoading(true);

      const cleanedUri = uri.replace('file://', '');
      const fileStat = await RNFS.stat(cleanedUri);
      const fileSize = fileStat.size;

      if (mediaType === 'image' && fileSize > 5 * 1024 * 1024) {
        showToast("Image size shouldn't exceed 5MB", 'error');

        setIsLoading(false);
        return;
      }

      if (mediaType === 'video' && fileSize > 10 * 1024 * 1024) {
        showToast("Video size shouldn't exceed 10MB\nTry uploading a smaller video", 'error');

        setIsLoading(false);
        return;
      }

      // Store selected media
      setSelectedMedia({ uri, type, mediaType });

      // Set preview
      if (mediaType === 'image') {
        setImageUri(uri);
      } else if (mediaType === 'video') {
        setVideoUri(uri);
      }

      setMediaType(mediaType);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);

      showToast("Something went wrong", 'error');

    }
  };





  const handlePostSubmission = async () => {
    const cleanedBody = cleanForumHtml(postData.forum_body); // ✅ re-clean before saving

    if (!stripHtmlTags(cleanedBody).trim()) {
      showToast("Description is mandatory", 'info');
      return;
    }

    setIsLoading(true);
    setHasChanges(false);

    try {
      let fileKey = postData.fileKey || '';
      let thumbnailFileKey = postData.thumbnail_fileKey || '';
      const currentTimestampInSeconds = Math.floor(Date.now() / 1000);

      if (oldFileKey && !selectedMedia) {
        await handleDeleteOldImage(oldFileKey);
        fileKey = '';
      }

      if (oldThumbnailFileKey && !selectedMedia) {
        await handleDeleteOldImage(oldThumbnailFileKey);
        thumbnailFileKey = null;
      }

      if (selectedMedia) {
        const uploadedFiles = await uploadFile(selectedMedia.uri, selectedMedia.type);

        if (!uploadedFiles) {
          throw new Error("File upload failed.");
        }

        fileKey = uploadedFiles.fileKey;
        thumbnailFileKey = uploadedFiles.thumbnailFileKey;
      }

      const postPayload = {
        command: 'updateForumPost',
        user_id: myId,
        forum_id: post.forum_id,
        forum_body: cleanedBody, // ✅ use cleaned content
        fileKey: fileKey || "",
        thumbnail_fileKey: thumbnailFileKey || '',
        posted_on: currentTimestampInSeconds,
      };

      console.log('postPayload', postPayload);

      const res = await apiClient.post('/updateForumPost', postPayload);

      if (res.data.status !== 'SUCCESS') {
        throw new Error('Post update failed.');
      }

      const updatedFields = {
        forum_body: cleanedBody,
        fileKey,
        thumbnail_fileKey: thumbnailFileKey,
        posted_on: currentTimestampInSeconds,
      };

      const updatedPostData = { ...post, ...updatedFields };

      EventRegister.emit('onForumPostUpdated', { updatedPost: updatedPostData });

      const postWithMedia = await fetchMediaForPost(updatedPostData);

      dispatch(updatePost(postWithMedia));
      dispatch(updateMyPost(postWithMedia));

      const newImageUrls = {};
      const previewUrl = postWithMedia.thumbnailUrl || postWithMedia.imageUrl;
      newImageUrls[postWithMedia.forum_id] = previewUrl || null;

      dispatch(setMyPostImageUrls(newImageUrls));

      setPostData(prev => ({ ...prev, fileKey, thumbnail_fileKey: thumbnailFileKey }));
      setSelectedMedia(null);
      setOldFileKey(null);
      setOldThumbnailFileKey(null);
      setHasChanges(false);

      showToast("Post updated successfully", 'success');
      setTimeout(() => navigation.goBack(), 100);

    } catch (error) {
      showToast("Something went wrong", 'error');
      console.log('error', error);
    } finally {
      setIsLoading(false);
    }
  };


  const fetchMediaForPost = async (post) => {
    const mediaData = { forum_id: post.forum_id };

    // Check if the post has a fileKey (main post media: image/video)
    if (post.fileKey) {
      try {
        // Fetch media URL for the main post image/video
        const res = await apiClient.post('/getObjectSignedUrl', {
          command: "getObjectSignedUrl",
          key: post.fileKey,
        });

        const url = res.data;
        if (url) {
          mediaData.imageUrl = url;


          if (videoExtensions.some((ext) => post.fileKey.toLowerCase().endsWith(ext))) {
            mediaData.videoUrl = url;


            if (post.thumbnail_fileKey) {
              try {
                const thumbRes = await apiClient.post('/getObjectSignedUrl', {
                  command: "getObjectSignedUrl",
                  key: post.thumbnail_fileKey,
                });
                mediaData.thumbnailUrl = thumbRes.data;


                await new Promise((resolve) => {
                  Image.getSize(mediaData.thumbnailUrl, (width, height) => {
                    mediaData.aspectRatio = width / height;
                    resolve();
                  }, resolve);
                });
              } catch (error) {
                // If thumbnail fetch fails, set default values
                mediaData.thumbnailUrl = null;
                mediaData.aspectRatio = 1;

              }
            } else {
              mediaData.thumbnailUrl = null;
              mediaData.aspectRatio = 1;
            }
          } else {
            // If it's not a video, calculate the aspect ratio for the image
            await new Promise((resolve) => {
              Image.getSize(url, (width, height) => {
                mediaData.aspectRatio = width / height;
                resolve();
              }, resolve);
            });
          }
        }
      } catch (error) {

        mediaData.imageUrl = null;
        mediaData.videoUrl = null;

      }
    }

    // Handle the author's image using author_fileKey
    if (post.author_fileKey) {
      try {
        // Fetch author image URL
        const authorImageRes = await apiClient.post('/getObjectSignedUrl', {
          command: "getObjectSignedUrl",
          key: post.author_fileKey,
        });
        mediaData.authorImageUrl = authorImageRes.data;
      } catch (error) {
        // If there's an error, set the author's image URL to null
        mediaData.authorImageUrl = null;

      }
    }

    // Return the updated post with media data (image, video, author image, etc.)
    return { ...post, ...mediaData };
  };


  const handleDeleteOldImage = async (fileKey, thumbnailFileKey) => {
    try {
      if (!fileKey && !thumbnailFileKey) {

        return;
      }

      const deleteFile = async (key) => {
        if (!key || typeof key !== "string" || key.trim() === "0") {
          return;
        }
        const response = await apiClient.post('/deleteFileFromS3', {
          command: "deleteFileFromS3",
          key,
        });

        if (response.data.status === "success" || response.data.statusCode === 200) {

        } else {
          const errMsg = response.data.message || `Unknown error deleting ${key}`;

          throw new Error(errMsg);
        }
      };

      if (fileKey) await deleteFile(fileKey);
      if (thumbnailFileKey) await deleteFile(thumbnailFileKey);

    } catch (error) {

      showToast("Something went wrong", 'error');

    }
  };




  const [oldThumbnailFileKey, setOldThumbnailFileKey] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemoveMedia = () => {
    setIsRemoving(true);

    if (selectedMedia) {

      setSelectedMedia(null);
      setTimeout(() => setIsRemoving(false), 500);
    } else if (postData.fileKey) {
      setOldFileKey(postData.fileKey);
      setOldThumbnailFileKey(post.thumbnail_fileKey);

      setPostData(prev => ({ ...prev, fileKey: null, thumbnail_fileKey: null }));
      setTimeout(() => setIsRemoving(false), 500);
    }
  };

  const initialHtmlRef = useRef(postData.forum_body);

  const stripHtmlTags = (html) =>
    html?.replace(/<\/?[^>]+(>|$)/g, '').trim() || '';


  const handleForumBodyChange = (html) => {
    const plainText = stripHtmlTags(html);

    if (plainText.startsWith(" ")) {
      showToast("Leading spaces are not allowed", 'error');
    }

    const sanitizedHtml = cleanForumHtml(html);

    setPostData((prev) => ({
      ...prev,
      forum_body: sanitizedHtml,
    }));
  };




  return (
    <SafeAreaView style={styles.container} >
      <View style={styles.headerContainer} >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="black" />

        </TouchableOpacity>

        <View style={{ margin: 5, }}>
          <TouchableOpacity
            onPress={handlePostSubmission}
            style={[
              styles.buttonContainer,
              (!postData.forum_body.trim() || isLoading || isCompressing) && styles.disabledButton,
            ]}
            disabled={!postData.forum_body.trim() || isLoading || isCompressing}
          >
            {isLoading || isCompressing ? (
              <ActivityIndicator size="small" color="#fff" style={styles.activityIndicator} />
            ) : (
              <Text
                style={[
                  styles.buttonTextdown,
                  (!postData.forum_body.trim() || isLoading || isCompressing) && styles.disabledButtonText1,
                ]}
              >Update</Text>
            )}
          </TouchableOpacity>


        </View>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity activeOpacity={1}>
          <View style={styles.profileContainer}>
            <View style={styles.imageContainer}>

              <FastImage
                source={{ uri: profile?.imageUrl }}
                style={styles.detailImage}
                resizeMode={FastImage.resizeMode.cover}
                onError={() => { }}
              />
            </View>
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileName}>
                {profile?.first_name || profile?.last_name
                  ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
                  : profile?.company_name || ''}
              </Text>

              <Text style={styles.profileCategory}>{profile?.category}</Text>
            </View>

          </View>

          <View style={styles.inputContainer}>
            <RichEditor
              ref={richText}
              useContainer={false}
              style={{
                minHeight: 250,
                maxHeight: 450,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#ccc',
                overflow: 'hidden',
              }}
              initialContentHTML={initialHtmlRef.current}
              placeholder="Share your thoughts, questions or ideas..."
              editorInitializedCallback={() => { }}
              onChange={handleForumBodyChange}
              editorStyle={{
                cssText: `
                  * {
                    font-size: 15px !important;
                    line-height: 20px !important;
                    color: #000 !important;
                  }
                  p, div, ul, li, ol, h1, h2, h3, h4, h5, h6 {
                    margin: 0 !important;
                    padding: 10 !important;
                    color: #000 !important;
                  }
                  body {
                    padding: 10 !important;
                    margin: 0 !important;
                    color: #000 !important;
                  }
                `
              }}


            />


            <RichToolbar
              editor={richText}
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.insertLink,
              ]}
              iconTint="#000"
              selectedIconTint="#075cab"
              selectedButtonStyle={{ backgroundColor: "#eee" }}

            />
          </View>

          {/* <View style={styles.inputContainer}>

            <TextInput
              style={[styles.input, { minHeight: 250, maxHeight: 400 }]}
              multiline
              placeholder="Share your thoughts, questions or ideas ..."
              placeholderTextColor="gray"
              value={postData.forum_body}
              onChangeText={handleForumBodyChange}
              blurOnSubmit={true}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}

            />

          </View> */}

          <View style={styles.container1}>
            {(selectedMedia || fileKey) && (
              <TouchableOpacity onPress={handleMediaSelection} style={styles.mediaContainer}>
                <View style={styles.mediaPreviewWrapper}>
                  {selectedMedia ? (
                    selectedMedia.mediaType === 'video' ? (

                      <Video
                        source={{ uri: selectedMedia.uri }}
                        style={styles.mediaPreview}
                        controls
                        resizeMode="contain"
                      />
                    ) : (
                      <Image
                        source={{ uri: selectedMedia.uri }}
                        style={styles.mediaPreview}
                      />
                    )
                  ) : imageUrl && (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.mediaPreview}
                      resizeMode="contain"
                    />

                  )}


                  {(selectedMedia || postData.fileKey || isRemoving) && (
                    <TouchableOpacity onPress={handleRemoveMedia} style={styles.removeMediaButton}>
                      <Ionicons name="close" size={20} color="gray" />
                    </TouchableOpacity>
                  )}

                </View>

              </TouchableOpacity>
            )}
            {/* {thumbnailUri && (
            <Image
              source={{ uri: thumbnailUri }}
              style={{ width: 200, height: 200, borderRadius: 10 }}
            />
          )} */}


            {!(selectedMedia || fileKey) && (
              <TouchableOpacity
                activeOpacity={1}
                style={styles.uploadButton}
                onPress={handleMediaSelection}
              >
                <Icon name="cloud-upload-outline" size={30} color="#000" />
                <Text style={{ color: 'black', fontSize: 12 }}>Click to upload </Text>
                <Text style={{ color: 'black', textAlign: 'center', fontSize: 12 }}>Supported formats JPG, PNG, WEBP, MP4 </Text>
                <Text style={{ color: 'black', fontSize: 12, textAlign: 'center' }}>(images 5MB, videos 10MB) </Text>

              </TouchableOpacity>
            )}
          </View>

       

          <View style={AppStyles.UpdateContainer}>
            <TouchableOpacity
              onPress={handlePostSubmission}
              style={[
                AppStyles.buttonContainer1,
                !postData.forum_body.trim() || isLoading || isCompressing ? styles.disabledButton1 : null,
              ]}
              disabled={isLoading || isCompressing}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ccc" />
              ) : (
                <Text
                  style={[
                    styles.buttonTextdown,
                    (!postData.forum_body.trim() || isLoading || isCompressing) && styles.disabledButtonText,
                  ]}
                >Update</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[AppStyles.cancelBtn]}>
              <Text style={[styles.buttonTextdown, { color: '#FF0000' }]}  >Cancel</Text>
            </TouchableOpacity>
          </View>
          <Message1
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onOk={handleOk}
            title={modalTitle}
            message={modalMessage}
            iconType={modalIconType}
          />

          <Message3
            visible={showModal}
            onClose={() => setShowModal(false)}
            onCancel={handleStay}
            onOk={handleLeave}
            title="Are you sure?"
            message="Your updates will be lost if you leave this page. This action cannot be undone."
            iconType="warning"
          />
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      <Toast />
    </SafeAreaView>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',

  },
  container1: {

    paddingHorizontal: 10,
    backgroundColor: 'whitesmoke',
  },
  scrollViewContent: {
    paddingBottom: '20%',
  },
  mediaContainer: {
    borderRadius: 10,
    overflow: 'hidden',

  },
  mediaPreviewWrapper: {
    width: '100%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',

  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 20,

  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: 80,
    alignSelf: 'center',
    justifyContent: 'center',
    marginRight: 10

  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',

  },
  detailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    overflow: 'hidden',

  },
  mediaPreview: {
    width: '100%',
    height: '100%', // Ensures the media fills the container
    borderRadius: 10,
    resizeMode: 'contain',
  },

  removeMediaButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'gray',
    borderStyle: 'dotted',
    backgroundColor: 'white',
    borderRadius: 15
  },
  inputContainer: {
    color: "black",
    paddingHorizontal: 10,

  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  profileTextContainer: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black'
  },

  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 15,
    padding: 10,
    fontSize: 16,
    textAlignVertical: 'top', // Align text to the top for multiline
    color: 'black',
    textAlign: 'justify',
    backgroundColor: 'white'
  },

  label: {
    fontSize: 15,
    fontWeight: '400',
    color: 'black',
  },
  buttonContainer: {
    width: 80,
    paddingVertical: 10,
    borderRadius: 10,
    // backgroundColor: '#075CAB',
    alignItems: 'center',
    justifyContent: 'center',
    // shadowColor: '#000', 
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.2,
    // shadowRadius: 3,
    // elevation: 5, 
  },

  activityIndicator: {
    marginLeft: 5,
  },

  buttonText: {
    color: '#fff', // White text for contrast
    fontWeight: '700', // Bold text for emphasis
    fontSize: 16, // Readable text size
  },

  buttonContainer1: {
    width: 80,
    padding: 5,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#075cab',
    borderWidth: 0.5,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  buttonTextdown: {
    textAlign: 'center',
    fontSize: 16,
    color: '#075cab',
    fontWeight: '600',
  },
  disabledButton1: {
    borderColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: '#ccc',
  },
  disabledButtonText1: {
    color: '#fff',
  }
});

export default ForumEditScreen;

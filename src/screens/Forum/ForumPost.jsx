

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, Button, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Alert, SafeAreaView, ActivityIndicator, Modal, Keyboard, ActionSheetIOS, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Message3 from '../../components/Message3';
import ImageResizer from 'react-native-image-resizer';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { addPost } from '../Redux/Forum_Actions';
import { useDispatch, useSelector } from 'react-redux';
import VideoThumbnail, { generateVideoThumbnail } from './VideoParams';
import PlayOverlayThumbnail from './Play';
import { selectVideo } from './VideoParams';
import { addMyPost } from '../Redux/MyPosts/MyForumPost_Actions';
import defaultImage from '../../images/homepage/image.jpg'
import FastImage from 'react-native-fast-image';
import { showToast } from '../AppUtils/CustomToast';
import { useNetwork } from '../AppUtils/IdProvider';
import apiClient from '../ApiClient';
import { EventRegister } from 'react-native-event-listeners';
import AppStyles from '../../assets/AppStyles';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import { cleanForumHtml } from './forumBody';
import { MediaPreview } from '../helperComponents.jsx/MediaPreview';
import { MediaPickerButton } from '../helperComponents.jsx/MediaPickerButton';
import { useMediaPicker } from '../helperComponents.jsx/MediaPicker';

async function uriToBlob(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
}
const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];


const ForumPostScreen = () => {
  const dispatch = useDispatch();
  const profile = useSelector(state => state.CompanyProfile.profile);
  const { myId, myData } = useNetwork();

  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [mediaMeta, setMediaMeta] = useState(null);

  const navigation = useNavigation();
  const [postData, setPostData] = useState({
    body: '',
    fileKey: '',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const scrollViewRef = useRef(null);
  const [thumbnailUri, setThumbnailUri] = useState(null);

  const [loading, setLoading] = useState(false);
  const defaultLogo = Image.resolveAssetSource(defaultImage).uri;

  useEffect(() => {

    const bodyChanged = postData.body.trim() !== '';
    const filekey = postData.fileKey.trim() !== '';

    setHasChanges(bodyChanged || filekey);
  }, [postData]);


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


  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {

    const plainText = stripHtmlTags(postData.body); // already defined
    const isValid = plainText.trim().length > 0;

    setIsFormValid(isValid);
  }, [postData.body]);

  const {
    showMediaOptions,
    isCompressing,
    overlayRef,
  } = useMediaPicker({
    onMediaSelected: (file, meta) => {
      setFile(file);
      setFileType(file.type);
      setMediaMeta(meta);
    },
    includeDocuments: false, // No document option for forum posts
    includeCamera: true,     // Include camera option
    mediaType: 'mixed',      // Allow both photos and videos
    maxImageSizeMB: 5,
    maxVideoSizeMB: 10,
  });




  const playIcon = require('../../images/homepage/PlayIcon.png');

  const [capturedThumbnailUri, setCapturedThumbnailUri] = useState(null);




  const handleThumbnailUpload = async (thumbnailUri, fileKey) => {
    try {
      // ✅ Step 1: Get thumbnail file size
      const thumbStat = await RNFS.stat(thumbnailUri);
      const thumbBlob = await uriToBlob(thumbnailUri);

      // Create thumbnail file key
      const thumbnailFileKey = `thumbnail-${fileKey}`;

      // ✅ Step 2: Request upload URL for thumbnail
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

      // ✅ Step 3: Upload Thumbnail
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: thumbBlob,
      });

      if (uploadRes.status !== 200) {
        throw new Error('Failed to upload thumbnail to S3');
      }


      return thumbnailFileKey; // Return the thumbnail file key
    } catch (error) {

      return null;
    }
  };

  const handleRemoveMedia = () => {
    setFile(null);
    setFileType('');
    setMediaMeta(null);
  };




  const clearCacheDirectory = async () => {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);

      for (const file of files) {
        await RNFS.unlink(file.path);
      }
    } catch (error) {
    }
  };


  useFocusEffect(
    React.useCallback(() => {
      return () => {

        clearCacheDirectory();

      };
    }, [])
  );


  const handleUploadFile = async () => {
    setLoading(true);

    if (!file) {
      setLoading(false);
      return { fileKey: null, thumbnailFileKey: null };
    }

    try {
      // ✅ Step 1: Get file size using RNFS
      const fileStat = await RNFS.stat(file.uri);
      const fileSize = fileStat.size;

      // ✅ Step 2: Request upload URL from backend
      const res = await apiClient.post('/uploadFileToS3', {
        command: 'uploadFileToS3',
        headers: {
          'Content-Type': fileType,
          'Content-Length': fileSize,
        },
      });

      if (res.data.status !== 'success') {
        throw new Error(res.data.errorMessage || 'Failed to get upload URL');
      }

      const uploadUrl = res.data.url;
      const fileKey = res.data.fileKey;

      // ✅ Step 3: Convert file to Blob & upload
      const fileBlob = await uriToBlob(file.uri);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileType },
        body: fileBlob,
      });

      if (uploadRes.status !== 200) {
        throw new Error('Failed to upload file to S3');
      }

      // ✅ Step 4: Generate Thumbnail for Videos
      let thumbnailFileKey = null;
      if (file.type.startsWith("video/")) {
        let finalThumbnailToUpload = capturedThumbnailUri;

        if (!finalThumbnailToUpload) {

          finalThumbnailToUpload = await generateVideoThumbnail(file.uri);
        }

        if (finalThumbnailToUpload) {

          thumbnailFileKey = await handleThumbnailUpload(finalThumbnailToUpload, fileKey);
        }
      }

      return { fileKey, thumbnailFileKey };
    } catch (error) {
      showToast("An error occurred during file upload", 'error');

      return { fileKey: null, thumbnailFileKey: null };
    } finally {
      setLoading(false);
    }
  };

  const stripHtmlTags = (html) =>
    html?.replace(/<\/?[^>]+(>|$)/g, '').trim() || '';

  const sanitizeHtmlBody = (html) => {
    const cleaned = cleanForumHtml(html); // your existing cleaner

    return cleaned
      .replace(/<div><br><\/div>/gi, '') // remove empty line divs
      .replace(/<p>(&nbsp;|\s)*<\/p>/gi, '') // remove empty p tags
      .replace(/<div>(&nbsp;|\s)*<\/div>/gi, '') // remove empty divs
      .trim(); // trim outer whitespace
  };

  const handleBodyChange = (html) => {
    const sanitizedHtml = sanitizeHtmlBody(html);
    setPostData((prev) => ({ ...prev, body: sanitizedHtml }));
  };




  const handlePostSubmission = async () => {
    if (loading) return;

    setHasChanges(true);
    setLoading(true);

    try {
      setHasChanges(false);

      const sanitizedBody = sanitizeHtmlBody(postData.body);
      const plainText = stripHtmlTags(sanitizedBody);

      if (!plainText.trim()) {
        showToast("Description is mandatory", "info");
        return;
      }


      const uploadedFiles = await handleUploadFile();
      if (!uploadedFiles) throw new Error("File upload failed.");

      const { fileKey, thumbnailFileKey } = uploadedFiles;

      const postPayload = {
        command: "postInForum",
        user_id: myId,
        forum_body: sanitizedBody, // ✅ cleaned before submit
        fileKey,
        thumbnail_fileKey: thumbnailFileKey,
        extraData: mediaMeta || {}

      };

      console.log('postPayload', postPayload)
      const res = await apiClient.post('/postInForum', postPayload);

      if (res.data.status !== 'success') throw new Error("Failed to submit post.");

      setHasChanges(false);

      let newPost = res.data.forum_details;

      newPost = {
        ...newPost,
        user_type: profile.user_type,
      };

      EventRegister.emit('onForumPostCreated', {
        newPost: newPost,
        profile: profile,
      });

      showToast("Forum post submitted successfully", "success");
      navigation.goBack();

    } catch (error) {
      console.log("Submission error:", error);

      if (error?.message?.includes("Network Error")) {
        showToast("Check your internet connection", "error");
      } else if (error?.response?.data) {
        // If API responded with a body (like validation errors)
        console.log("API response error:", error.response.data);
        showToast(error.response.data?.message || "Something went wrong", "error");
      } else {
        showToast("Something went wrong", "error");
      }
    }
    finally {
      setLoading(false);
      setHasChanges(false);
    }
  };


  const richText = useRef();



  useFocusEffect(
    React.useCallback(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
    }, [])
  );


  const clearFile = () => {
    setFile(null);
  };


  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="black" />

        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePostSubmission}
          style={[
            AppStyles.buttonContainer,
            !isFormValid || loading || isCompressing ? styles.disabledButton : null,
          ]}
          disabled={!isFormValid || loading || isCompressing}
        >
          {loading || isCompressing ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={[styles.buttonText, (!postData.body.trim()) && styles.buttonDisabledText]} >Post</Text>
          )}
        </TouchableOpacity>

      </View>



      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: '20%' }}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        onScrollBeginDrag={() => Keyboard.dismiss()}

      >

        <View style={styles.profileContainer}>
          <View style={styles.imageContainer}>
            {profile?.fileKey && profile?.imageUrl ? (
              <Image
                source={{ uri: profile?.imageUrl }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginRight: 10,
                }}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginRight: 10,
                  backgroundColor: profile?.companyAvatar?.backgroundColor || '#ccc',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: profile?.companyAvatar?.textColor || '#000', fontWeight: 'bold' }}>
                  {profile?.companyAvatar?.initials || '?'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName}>
              {profile?.company_name
                ? profile.company_name
                : `${profile?.first_name || ''} ${profile?.last_name || ''}`}
            </Text>
            <Text style={styles.profileCategory}>{profile?.category}</Text>
          </View>

        </View>


        <RichEditor
          ref={richText}
          useContainer={false}
          style={{
            minHeight: 250,
            maxHeight: 400,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#ccc',
            overflow: 'hidden',
          }}
          initialContentHTML={postData.body}
          placeholder="Share your thoughts, questions or ideas..."
          editorInitializedCallback={() => { }}
          onChange={handleBodyChange}
          editorStyle={{
            cssText: `
      * {
        font-size: 15px !important;
        line-height: 20px !important;
      }
      p, div, ul, li, ol, h1, h2, h3, h4, h5, h6 {
        margin: 0 !important;
        padding: 10 !important;
      }
      body {
        padding: 10 !important;
        margin: 0 !important;
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


        <PlayOverlayThumbnail
          ref={overlayRef}
          thumbnailUri={thumbnailUri}
          playIcon={playIcon}

        />

        <MediaPreview
          uri={file?.uri}
          type={fileType}
          name={file?.name}
          onRemove={handleRemoveMedia}
        />

        {!file && (
          <MediaPickerButton
            onPress={() => showMediaOptions()}
            isLoading={isCompressing}
          />
        )}


      </KeyboardAwareScrollView>



      <Message3
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCancel={handleStay}
        onOk={handleLeave}
        title="Are you sure ?"
        message={`Your updates will be lost if you leave this page.\nThis action cannot be undone.`}
        iconType="warning"
      />
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    marginHorizontal: 10,
  },

  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'gray',
    borderStyle: 'dotted',
    backgroundColor: 'white',
    borderRadius: 15,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  buttonDisabledText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 13,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
    zIndex: 2,
  },



  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10
  },
  detailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    overflow: 'hidden',

  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: 80,
    alignSelf: 'center',
    justifyContent: 'center',
    marginRight: 10

  },

  profileTextContainer: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black'
  },
  profileCategory: {
    fontSize: 14,
    color: 'gray',
  },


  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',

  },


  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
    borderWidth: 0.5,
  },

  buttonText1: {
    fontSize: 18,
    color: '#075cab',
  },
  buttonTextdown: {
    textAlign: 'center',
    fontSize: 16,
    color: '#075cab',
    fontWeight: '500',
  },
  disabledButton1: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: '#ccc',
  }
});

export default ForumPostScreen;
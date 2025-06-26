

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Alert, SafeAreaView, ActivityIndicator, Modal, Keyboard, ActionSheetIOS, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Message3 from '../../components/Message3';
import FastImage from 'react-native-fast-image';
import ImageResizer from 'react-native-image-resizer';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDispatch, useSelector } from 'react-redux';
import { addResourcePost, updateOrAddResourcePosts } from '../Redux/Resource_Actions';
import { generateVideoThumbnail, selectVideo } from '../Forum/VideoParams';
import PlayOverlayThumbnail from '../Forum/Play';
import { showToast } from '../AppUtils/CustomToast';
import { useNetwork } from '../AppUtils/IdProvider';
import apiClient from '../ApiClient';
import { EventRegister } from 'react-native-event-listeners';
import AppStyles from '../../assets/AppStyles';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';


async function uriToBlob(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
}

const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];

const ResourcesPost = () => {
  const navigation = useNavigation();
  const profile = useSelector(state => state.CompanyProfile.profile);
  const overlayRef = useRef();
  const { myId, myData } = useNetwork();

  const [postData, setPostData] = useState({
    title: '',
    body: '',
    fileKey: '',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const scrollViewRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(false);
  const [thumbnailUri, setThumbnailUri] = useState(null);



  useEffect(() => {
    const titleChanged = postData.title.trim() !== '';
    const bodyChanged = postData.body.trim() !== '';
    const filekey = postData.fileKey.trim() !== ''; // This line is most likely the issue

    setHasChanges(titleChanged || bodyChanged || filekey);
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
    const isValid = postData.body.trim().length > 0 && postData.title.trim().length > 0;
    setIsFormValid(isValid);
  }, [postData.body, postData.title]);

  const titleEditorRef = useRef();
  const bodyEditorRef = useRef();
  const [activeEditor, setActiveEditor] = useState('title'); // not 'title'

  const handleTitleFocus = () => {
    setActiveEditor('title');
    titleEditorRef.current?.focus(); // Focus the title editor
  };

  const handleBodyFocus = () => {
    setActiveEditor('body');
    bodyEditorRef.current?.focus(); // Focus the body editor
  };



  // Utility: Strip all HTML tags and decode entities
  const stripHtmlTags = (html) =>
    html?.replace(/<\/?[^>]+(>|$)/g, '').trim() || '';

  const cleanForumHtml = (html) => {
    if (!html) return '';

    return html
      // Remove background color and text color styles explicitly
      .replace(/(<[^>]+) style="[^"]*(color|background-color):[^";]*;?[^"]*"/gi, '$1')
      // Remove ALL inline styles
      .replace(/(<[^>]+) style="[^"]*"/gi, '$1')
      // Remove unwanted tags but keep content (like font, span, div, p)
      .replace(/<\/?(font|span|div|p)[^>]*>/gi, '')
      // Remove empty tags like <b></b>
      .replace(/<[^\/>][^>]*>\s*<\/[^>]+>/gi, '')
      // Only allow: b, i, ul, ol, li, a, br (whitelist)
      .replace(/<(?!\/?(b|i|ul|ol|li|a|br)(\s|>|\/))/gi, '&lt;')
      // Keep only href attribute in <a> tags
      .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, '<a href="$1">');
  };

  // Title Input Handler
  const handleTitleChange = (text) => {
    if (text === "") {
      setPostData(prev => ({ ...prev, title: "" }));
      return;
    }

    const trimmed = text.trimStart();
    if (trimmed === "") {
      showToast("Leading spaces are not allowed", "error");
      return;
    }

    const withoutLeadingSpaces = text.replace(/^\s+/, "");

    if (withoutLeadingSpaces.length > 100) {
      showToast("Title cannot exceed 100 characters", "info");
      return;
    }

    setPostData(prev => ({ ...prev, title: withoutLeadingSpaces }));
  };

  // RichEditor Body Input Handler
  const handleBodyChange = (html) => {
    if (html === "") {
      setPostData(prev => ({ ...prev, body: "" }));
      return;
    }

    // Extract plain text from HTML to validate leading spaces
    const plainText = stripHtmlTags(html);

    if (plainText.trimStart() === "") {
      showToast("Leading spaces are not allowed", "error");
      return;
    }

    // Save the cleaned HTML (if needed) or original input
    setPostData(prev => ({ ...prev, body: html.replace(/^\s+/, "") }));
  };




  const handleMediaSelection = () => {
    const options = ["Image", "Video", "Document (PDF, DOCX, etc.)"];
    const actions = [openGallery, handleVideoPick, selectDocument];

    // If a file exists, add "Remove" option
    if (postData.fileKey) {
      options.push("Remove");
      actions.push(handleRemoveMedia);
    }

    options.push("Cancel");

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: postData.fileKey ? options.length - 2 : undefined,
        },
        (index) => {
          if (index !== -1 && index < actions.length) {
            actions[index]();
          }
        }
      );
    } else {

      Alert.alert("Select Media", "Choose an option", [
        ...options.slice(0, -1).map((text, idx) => ({
          text,
          onPress: actions[idx],
        })),
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };



  const openGallery = async () => {
    try {
      const options = {
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      };

      launchImageLibrary(options, async (response) => {
        if (response.didCancel) {

          return;
        }

        if (response.errorCode) {

          return;
        }

        const asset = response.assets?.[0];
        if (!asset) return;

        let fileType = asset.type || '';
        if (!fileType.startsWith('image/')) {

          showToast("Please select a valid image file", 'error');
          return;
        }

        if (fileType === 'image/heic' || fileType === 'image/heif') {
          fileType = 'image/jpeg';
        }

        const compressedImage = await ImageResizer.createResizedImage(
          asset.uri,
          1080,
          1080,
          'JPEG',
          70
        );

        const compressedFilePath = compressedImage.uri.replace('file://', '');
        const compressedStats = await RNFS.stat(compressedFilePath);
        const compressedFileSize = compressedStats.size;

        const maxFileSize = 5 * 1024 * 1024;
        if (compressedFileSize > maxFileSize) {

          showToast("Image size shouldn't exceed 5MB", 'error');

          return;
        }

        setFile({
          uri: compressedImage.uri,
          type: 'image/jpeg',
          name: asset.fileName ? asset.fileName.replace(/\.[^/.]+$/, '.jpeg') : 'image.jpeg',
        });
        setFileType('image/jpeg');

      });
    } catch (error) {
      showToast("Something went wrong", 'error');

    }
  };

  const [isCompressing, setIsCompressing] = useState(false);
  const [capturedThumbnailUri, setCapturedThumbnailUri] = useState(null);

  const playIcon = require('../../images/homepage/PlayIcon.png');


  const handleVideoPick = () => {
    selectVideo({
      isCompressing,
      setIsCompressing,
      setThumbnailUri,
      setCapturedThumbnailUri,
      setFile,
      setFileType,
      overlayRef,
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


  const documentExtensions = [
    DocumentPicker.types.pdf,
    DocumentPicker.types.doc,
    DocumentPicker.types.docx,
    DocumentPicker.types.plainText,
    DocumentPicker.types.csv,
    DocumentPicker.types.ppt,
    DocumentPicker.types.pptx,
    DocumentPicker.types.xls,
    DocumentPicker.types.xlsx
  ];


  const selectDocument = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: documentExtensions,
      });

      if (!res || !res.uri) {

        return;
      }
      if (!res.type) {

        res.type = 'application/pdf';
      }

      setFile(res);
      setFileType(res.type);

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {

      } else {

      }
    }
  };



  const handleUploadFile = async () => {
    if (!file) {
      console.log('[handleUploadFile] No file selected');
      return { fileKey: null, thumbnailFileKey: null };
    }

    setLoading(true);

    try {
      console.log('[handleUploadFile] Starting file upload');

      const fileStat = await RNFS.stat(file.uri);
      const fileSize = fileStat.size;
      console.log(`[handleUploadFile] File size: ${fileSize} bytes`);

      const res = await apiClient.post('/uploadFileToS3', {
        command: 'uploadFileToS3',
        headers: {
          'Content-Type': fileType,
          'Content-Length': fileSize,
        },
      });

      if (res.data.status !== 'success') {
        console.log('[handleUploadFile] Failed to get upload URL', res.data);
        throw new Error(res.data.errorMessage || 'Failed to get upload URL');
      }

      const uploadUrl = res.data.url;
      const fileKey = res.data.fileKey;
      console.log('[handleUploadFile] Received upload URL and fileKey:', fileKey);

      const fileBlob = await uriToBlob(file.uri);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileType },
        body: fileBlob,
      });

      if (uploadRes.status !== 200) {
        console.log('[handleUploadFile] Upload failed with status:', uploadRes.status);
        throw new Error('Failed to upload file to S3');
      }

      console.log('[handleUploadFile] File uploaded successfully');

      // ✅ Step 4: Generate Thumbnail for Videos
      let thumbnailFileKey = null;
      if (file.type.startsWith("video/")) {
        console.log('[handleUploadFile] File is a video. Generating thumbnail...');
        let finalThumbnailToUpload = capturedThumbnailUri;

        if (!finalThumbnailToUpload) {
          finalThumbnailToUpload = await generateVideoThumbnail(file.uri);
          console.log('[handleUploadFile] Generated thumbnail from video URI');
        } else {
          console.log('[handleUploadFile] Using captured thumbnail URI');
        }

        if (finalThumbnailToUpload) {
          thumbnailFileKey = await handleThumbnailUpload(finalThumbnailToUpload, fileKey);
          console.log('[handleUploadFile] Thumbnail uploaded. Key:', thumbnailFileKey);
        }
      }

      console.log('[handleUploadFile] Upload complete. Returning keys:', { fileKey, thumbnailFileKey });

      return { fileKey, thumbnailFileKey };

    } catch (error) {
      console.error('[handleUploadFile] Error:', error.message || error);
      showToast("Something went wrong", 'error');
      return { fileKey: null, thumbnailFileKey: null };

    } finally {
      setLoading(false);
    }
  };


  const dispatch = useDispatch();

  const documentExtensions1 = [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    "vnd.openxmlformats-officedocument.wordprocessingml.document",
    "vnd.openxmlformats-officedocument.presentationml.presentation",
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "msword", 'webp'
  ];

  const handlePostSubmission = async () => {
    setHasChanges(true);
    setLoading(true);

    try {
      const trimmedTitle = postData.title?.trim();
      const rawBodyHtml = postData.body?.trim();

      if (!trimmedTitle || !rawBodyHtml) {
        showToast("Title and body are required", 'info');
        return;
      }

      // Strip and sanitize the body HTML here before submission
      const cleanedBody = cleanForumHtml(rawBodyHtml);

      const uploadedFiles = await handleUploadFile();
      if (!uploadedFiles) throw new Error("File upload failed.");

      const { fileKey, thumbnailFileKey } = uploadedFiles;

      const postPayload = {
        command: "postInResources",
        user_id: myId,
        title: trimmedTitle,
        resource_body: cleanedBody,
        ...(fileKey && { fileKey }),
        ...(thumbnailFileKey && { thumbnail_fileKey: thumbnailFileKey }),
      };

      console.log('postPayload', postPayload);

      const res = await apiClient.post('/postInResources', postPayload);

      if (res.data.status === 'success') {
        const newPost = res.data.resource_details;
        EventRegister.emit('onResourcePostCreated', { newPost: newPost });

        const postWithMedia = await fetchMediaForPost(newPost);

        if (newPost && newPost.resource_id) {
          dispatch(updateOrAddResourcePosts([postWithMedia]));
          // EventRegister.emit('onResourcePostCreated', { newPost: postWithMedia });
        } else {
          showToast("Post submission failed", 'error');
          return;
        }

        await clearCacheDirectory();
        setPostData({ title: '', body: '', fileKey: '' });
        setFile(null);
        setThumbnailUri(null);
        showToast("Resource post submitted successfully", 'success');
        navigation.goBack();
      } else {
        showToast("Failed to submit post", 'error');
      }

    } catch (error) {
      const message =
        error?.response?.data?.status_message ||
        error?.message ||
        'Something went wrong';

      showToast(message, 'error');
      return { fileKey: null, thumbnailFileKey: null };

    } finally {
      setLoading(false);
      setHasChanges(false);
    }
  };


  const fetchMediaForPost = async (post) => {
    const mediaData = { resource_id: post.resource_id };

    if (post.fileKey) {
      try {
        const res = await apiClient.post('/getObjectSignedUrl', {
          command: "getObjectSignedUrl",
          key: post.fileKey
        });

        const url = res.data;

        if (url) {
          mediaData.fileUrl = url;

          if (videoExtensions.some(ext => post.fileKey.toLowerCase().endsWith(ext))) {
            mediaData.videoUrl = url;

            // Fetch video thumbnail
            if (post.thumbnail_fileKey) {
              try {
                const thumbRes = await apiClient.post('/getObjectSignedUrl', {
                  command: "getObjectSignedUrl",
                  key: post.thumbnail_fileKey
                });
                mediaData.thumbnailUrl = thumbRes.data;

                await new Promise((resolve) => {
                  Image.getSize(mediaData.thumbnailUrl, (width, height) => {
                    mediaData.aspectRatio = width / height;
                    resolve();
                  }, resolve);
                });
              } catch (error) {
                mediaData.thumbnailUrl = null;
                mediaData.aspectRatio = 1;
              }
            } else {
              mediaData.thumbnailUrl = null;
              mediaData.aspectRatio = 1;
            }
          } else if (documentExtensions1.some(ext => post.fileKey.toLowerCase().endsWith(ext))) {
            mediaData.documentUrl = url;
          } else {

            await new Promise((resolve) => {
              Image.getSize(url, (width, height) => {
                mediaData.aspectRatio = width / height;
                resolve();
              }, resolve);
            });
            mediaData.imageUrl = url;
          }
        }
      } catch (error) {
        mediaData.imageUrl = null;
        mediaData.videoUrl = null;
        mediaData.documentUrl = null;
      }
    }

    if (post.author_fileKey) {
      try {
        const authorImageRes = await apiClient.post('/getObjectSignedUrl', {
          command: "getObjectSignedUrl",
          key: post.author_fileKey
        });
        mediaData.authorImageUrl = authorImageRes.data;
      } catch (error) {
        mediaData.authorImageUrl = null;
      }
    }

    return { ...post, ...mediaData };
  };


  const cleanUpFile = async (uri) => {
    try {
      const fileStat = await RNFS.stat(uri);
      const fileSize = fileStat.size;
      const isFileExists = await RNFS.exists(uri);

      if (isFileExists) {

        await RNFS.unlink(uri);

      } else {

      }
    } catch (error) {

    }
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
        cleanUpFile();
      };
    }, [])
  );


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
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={[styles.buttonText, (!postData.body.trim()) && styles.buttonDisabledText]} >Post</Text>

          )}
        </TouchableOpacity>

      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 10, }}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => Keyboard.dismiss}
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
                {profile?.company_name
                  ? profile.company_name
                  : `${profile?.first_name || ''} ${profile?.last_name || ''}`}
              </Text>
              <Text style={styles.profileCategory}>{profile?.category}</Text>
            </View>
          </View>

          <TextInput
            style={[styles.input, { height: 50 }]}
            value={postData.title}
            multiline
            placeholder="Enter title ..."
            placeholderTextColor="gray"
            onChangeText={handleTitleChange}
          />


          <RichEditor
            ref={bodyEditorRef}
            useContainer={false}
            style={{
              minHeight: 250,
              maxHeight: 400,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#ccc',
              overflow: 'hidden',
            }}
            onTouchStart={() => setActiveEditor('body')}
            onFocus={() => handleBodyFocus('body')}
            initialContentHTML={postData.body}
            placeholder="Describe your resource in detail ..."
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
            key={`toolbar-${activeEditor}`}
            editor={bodyEditorRef}
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


          {!file && (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.uploadButton}
              onPress={handleMediaSelection}
            >
              <Icon name="cloud-upload-outline" size={30} color="#000" />
              <Text style={{ color: 'black' }}>Click to upload a file </Text>


            </TouchableOpacity>
          )}

  
            {file && (
              <View style={{ width: '100%', alignItems: 'center', position: 'relative' }}>
                {/* Clear File Button */}
                <TouchableOpacity onPress={clearFile} style={styles.closeIcon}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>


                {fileType.startsWith('image') && (
                  <View style={{ width: '100%', height: 250, borderRadius: 10, overflow: 'hidden', }}>
                    <FastImage
                      source={{ uri: file.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  </View>
                )}


                {fileType.startsWith('video') && (
                  <View style={{ width: '100%', height: 250, borderRadius: 10, overflow: 'hidden', }}>
                    <Video
                      source={{ uri: file.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                      muted
                    />
                  </View>
                )}


                {(fileType === 'application/pdf' ||
                  fileType.includes('msword') ||
                  fileType.includes('text') ||
                  fileType.includes('officedocument')) && (
                    <View style={{ width: '100%', alignItems: 'center', padding: 20, borderRadius: 10, backgroundColor: '#f5f5f5' }}>
                      <Ionicons name="document-text-outline" size={40} color="black" />
                      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 10 }}>Document Uploaded</Text>
                      <Text style={{ fontSize: 14, color: 'gray', marginTop: 5 }} numberOfLines={1} ellipsizeMode="middle">
                        {file.name}
                      </Text>
                    </View>
                  )}
              </View>
            )}


          <View style={AppStyles.UpdateContainer}>
            <TouchableOpacity
              onPress={handlePostSubmission}
              style={[
                AppStyles.buttonContainer1,
                !isFormValid || loading || isCompressing ? styles.disabledButton1 : null,
              ]}
              disabled={!isFormValid || loading || isCompressing}
            >
              {loading || isCompressing ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text
                  style={[
                    styles.buttonTextdown,
                    (!isFormValid || loading || isCompressing) && styles.disabledButtonText,
                  ]}
                >Post</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[AppStyles.cancelBtn]}>
              <Text style={[styles.buttonTextdown, { color: '#FF0000' }]}  >Cancel</Text>
            </TouchableOpacity>
          </View>

          <Message3
            visible={showModal}
            onClose={() => setShowModal(false)}
            onCancel={handleStay}
            onOk={handleLeave}
            title="Are you sure ?"
            message="Your updates will be lost if you leave this page. This action cannot be undone."
            iconType="warning"
          />
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      <PlayOverlayThumbnail
        ref={overlayRef}
        thumbnailUri={thumbnailUri}
        playIcon={playIcon}

      />
    </SafeAreaView>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',
  },

  closeIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
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
    zIndex: 4
  },
  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'gray',
    borderStyle: 'dotted',
    backgroundColor: 'white',
    borderRadius: 15
  },

  fileKeyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,

    paddingHorizontal: 15,
  },

  fileKeyText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    marginRight: 10,
  },

  deleteIcon: {
    padding: 5,
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
    padding: 10
  },
  mediatext: {
    color: 'gray',
    fontWeight: '500',
    fontSize: 16,
    color: 'black',
  },
  mediaContainer1: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  mediaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    alignSelf: 'center'
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,

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
  closeButton1: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  mediaWrapper: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: undefined,
    resizeMode: 'contain',
    aspectRatio: 16 / 9,  // This is just an example; it keeps a typical video aspect ratio. Adjust it if needed.
    marginBottom: 10,   // This ensures the aspect ratio is preserved for images and videos
    marginBottom: 10, // Optional: Adds some space below the media
  },
  spaceAtBottom: {
    height: 20,  // Space at the bottom (adjust as needed)
  },
  deleteIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 25,
    marginRight: 10,
  },
  profileTextContainer: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
  },
  profileCategory: {
    fontSize: 14,
    color: 'black',
    fontWeight: '400'
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginVertical: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top', // Align text to the top for multiline
    color: 'black',
    textAlign: 'justify',
    backgroundColor: 'white',
    marginBottom: 10,
  },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },


  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
    borderWidth: 0.5,
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

  buttonTextdown: {
    textAlign: 'center',
    fontSize: 16,
    color: '#075cab',
    fontWeight: '500',
  },
  disabledButton1: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  disabledButtonText: {
    color: '#ccc',
  }
});






export default ResourcesPost;

import React, { useState, useRef } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';

import { compressVideo, generateVideoThumbnail } from '../Forum/VideoParams';
import { showToast } from '../AppUtils/CustomToast';

export const useMediaPicker = ({
  onMediaSelected,
  onError,
  allowMultiple = false,
  maxImageSizeMB = 5,
  maxVideoSizeMB = 10,
  maxVideoDuration = 1800,
  includeDocuments = false,
  includeCamera = true,
  mediaType = 'mixed', // 'photo', 'video', or 'mixed'
}) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const overlayRef = useRef();

  const calculateAspectRatio = (width, height) => {
    if (!width || !height || height <= 0) return 1;
    return width / height;
  };

  const handleMediaSelection = async (type, fromCamera = false) => {
    try {
      const options = {
        mediaType: type,
        quality: 1,
        selectionLimit: allowMultiple ? 0 : 1,
        includeExtra: true,
      };

      const launcher = fromCamera ? launchCamera : launchImageLibrary;

      launcher(options, async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          handleError(response.errorMessage || 'Failed to pick media');
          return;
        }

        const asset = response.assets?.[0];
        if (!asset) return;

        if (type === 'photo' || asset.type?.startsWith('image')) {
          await handleImageSelection(asset);
        } else if (type === 'video' || asset.type?.startsWith('video')) {
          await handleVideoSelection(asset);
        } else if (includeDocuments) {
          await handleDocumentSelection(asset);
        }
      });
    } catch (error) {
      handleError(error.message);
    }
  };

  const handleImageSelection = async (asset) => {
    try {
      let fileType = asset.type || 'image/jpeg';
      if (fileType === 'image/heic' || fileType === 'image/heif') {
        fileType = 'image/jpeg';
      }

      const originalFilePath = asset.uri.replace('file://', '');
      const originalStats = await RNFS.stat(originalFilePath);
      const originalFileSize = originalStats.size;

      // Calculate aspect ratio
      const aspectRatio = calculateAspectRatio(asset.width, asset.height);

      const compressedImage = await ImageResizer.createResizedImage(
        asset.uri,
        asset.width,
        asset.height,
        'JPEG',
        70
      );

      const compressedFilePath = compressedImage.uri.replace('file://', '');
      const compressedStats = await RNFS.stat(compressedFilePath);
      const compressedFileSize = compressedStats.size;

      if (compressedFileSize > maxImageSizeMB * 1024 * 1024) {
        showToast(`Image size shouldn't exceed ${maxImageSizeMB}MB`, 'error');
        return;
      }

      const processedFile = {
        uri: compressedImage.uri,
        type: fileType,
        name: asset.fileName ? asset.fileName.replace(/\.[^/.]+$/, '.jpeg') : 'image.jpeg',
      };

      const meta = {
        originalSize: originalFileSize,
        compressedSize: compressedFileSize,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
        type: fileType,
        mimeType: fileType,
        aspectRatio,
      };

      onMediaSelected(processedFile, meta);
    } catch (error) {
      handleError(error.message);
    }
  };

  const handleVideoSelection = async (asset) => {
    try {
      const totalSeconds = Math.floor(asset.duration || 0);
      if (totalSeconds > maxVideoDuration) {
        showToast(`Please select a video of ${Math.floor(maxVideoDuration/60)} minutes or shorter`, "error");
        return;
      }

      // Calculate aspect ratio
      const aspectRatio = calculateAspectRatio(asset.width, asset.height);

      setIsCompressing(true);
      showToast("Processing video...", "info");

      const compressedUri = await compressVideo(asset.uri);
      setIsCompressing(false);

      if (!compressedUri) return;

      const compressedStats = await RNFS.stat(compressedUri.replace('file://', ''));
      const compressedSize = compressedStats.size;

      if (compressedSize > maxVideoSizeMB * 1024 * 1024) {
        showToast(`Video size shouldn't exceed ${maxVideoSizeMB}MB`, 'error');
        return;
      }

      const previewThumbnail = await generateVideoThumbnail(compressedUri);

      const processedFile = {
        uri: compressedUri,
        type: asset.type,
        name: asset.fileName || 'video.mp4',
      };

      const meta = {
        originalSize: asset.fileSize,
        compressedSize: compressedSize,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
        type: asset.type,
        duration: asset.duration,
        mimeType: asset.type,
        aspectRatio,
      };

      onMediaSelected(processedFile, meta);
    } catch (error) {
      setIsCompressing(false);
      handleError(error.message);
    }
  };

  const handleDocumentSelection = async (asset) => {
    try {
      const filePath = asset.uri.replace('file://', '');
      const stats = await RNFS.stat(filePath);
      
      const processedFile = {
        uri: asset.uri,
        type: asset.type,
        name: asset.fileName,
      };

      const meta = {
        originalSize: stats.size,
        fileName: asset.fileName,
        type: asset.type,
        mimeType: asset.type,
      };

      onMediaSelected(processedFile, meta);
    } catch (error) {
      handleError(error.message);
    }
  };

  const showMediaOptions = (includeRemove = false, onRemove = null) => {
    const options = [];
    
    if (includeCamera && (mediaType === 'photo' || mediaType === 'mixed')) {
      options.push({ 
        text: "Take Photo", 
        onPress: () => handleMediaSelection('photo', true) 
      });
    }

    if (mediaType === 'photo' || mediaType === 'mixed') {
      options.push({ 
        text: "Choose Photo", 
        onPress: () => handleMediaSelection('photo') 
      });
    }

    if (mediaType === 'video' || mediaType === 'mixed') {
      options.push({ 
        text: "Choose Video", 
        onPress: () => handleMediaSelection('video') 
      });
    }

    if (includeDocuments && mediaType === 'mixed') {
      options.push({ 
        text: "Choose File", 
        onPress: () => handleMediaSelection('mixed') 
      });
    }

    if (includeRemove && onRemove) {
      options.push({ 
        text: "Remove", 
        onPress: onRemove,
        style: "destructive" 
      });
    }

    options.push({ text: "Cancel", style: "cancel" });

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options.map(option => option.text),
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: options.findIndex(opt => opt.style === "destructive"),
        },
        (buttonIndex) => {
          const selectedOption = options[buttonIndex];
          if (selectedOption?.onPress) selectedOption.onPress();
        }
      );
    } else {
      Alert.alert(
        "Select Media",
        "Choose an option",
        options,
      );
    }
  };

  const handleError = (message) => {
    console.error("Media Picker Error:", message);
    if (onError) onError(message);
    showToast(message || "Something went wrong", "error");
  };

  return {
    handleMediaSelection,
    showMediaOptions,
    isCompressing,
    overlayRef,
  };
};
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import apiClient from '../ApiClient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { showToast } from './CustomToast';
import { useBottomSheet } from './SheetProvider';
import { EventRegister } from 'react-native-event-listeners';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg'
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;
const COLOR_SEND_BUTTON = '#007AFF';
const COLOR_PLACEHOLDER = '#888';
const COLOR_INPUT_BG = '#f1f1f1';

const CommentInputBar = ({
  storedUserId,
  forum_id,
  onCommentAdded,
  onEditComplete,
}) => {
  const navigation = useNavigation();
  const { setOnRequestInputBarClose, closeSheet } = useBottomSheet();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const profile = useSelector(state => state.CompanyProfile.profile);



  useEffect(() => {
    const listener = EventRegister.addEventListener('onEditComment', (comment) => {
      setSelectedComment(comment);
      setText(comment.text || '');
      inputRef.current?.focus();
    });
    return () => {
      EventRegister.removeEventListener(listener);
    };
  }, []);



  useEffect(() => {
    setOnRequestInputBarClose(() => {
      inputRef.current?.blur();
    });
  }, []);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    setLoading(true);

    try {
      if (selectedComment) {
        const updatePayload = {
          command: 'updateComment',
          user_id: storedUserId,
          comment_id: selectedComment.comment_id,
          text: trimmedText,
        };

        const response = await apiClient.post('/updateComment', updatePayload);

        if (response?.data?.status === 'SUCCESS') {
          const updatedCommentWithUrl = await getSignedUrlForComment({
            comment_id: selectedComment.comment_id,
            text: trimmedText,
            fileKey: selectedComment.fileKey,
          });

          showToast('Comment updated', 'success');
          onEditComplete?.(updatedCommentWithUrl);
          setText('');
          setSelectedComment(null);
        } else {

        }
      } else {
        const payload = {
          command: 'addComments',
          user_id: storedUserId,
          forum_id,
          text: trimmedText,
        };

        const response = await apiClient.post('/addComments', payload);

if (response?.data?.status === 'success') {
  const newCommentWithUrl = await getSignedUrlForComment(response.data.comment_details);
  onCommentAdded?.(newCommentWithUrl);
  setText('');
  showToast('Comment posted successfully', 'success');
  EventRegister.emit('onCommentAdded', { forum_id });
} else {
  const errorMessage = response?.data?.errorMessage || 'Failed to add comment';
  showToast(errorMessage, 'error');
  console.log('Failed to add comment:', response?.data);
}

      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.errorMessage || error?.message || 'Something went wrong';
      showToast(errorMessage, 'error');
      console.error('Comment action failed:', error);
    }
    finally {
      setLoading(false);
    }
  };



  const getSignedUrlForComment = async (comment) => {
    if (!comment.fileKey) {
      let defaultImageUri = defaultImageUriMale;

      if (profile.user_type === 'company') {
        defaultImageUri = defaultImageUriCompany;
      } else if (profile.user_gender === 'Female') {
        defaultImageUri = defaultImageUriFemale;
      }

      return {
        ...comment,
        signedUrl: defaultImageUri,
      };
    }

    try {
      const res = await apiClient.post('/getObjectSignedUrl', {
        command: 'getObjectSignedUrl',
        key: comment.fileKey,
      });

      if (typeof res.data === 'string' && res.data.startsWith('http')) {
        return {
          ...comment,
          signedUrl: res.data,
        };
      }

      if (res?.data?.status === 'success' && res.data.response?.signedUrl) {
        return {
          ...comment,
          signedUrl: res.data.response.signedUrl,
        };
      }

    } catch (e) {
      // Optional: add logging if needed
    }

    return comment;
  };

  const handleNavigate = () => {
    closeSheet();
    setTimeout(() => {
      if (profile.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: profile.user_id });
      } else if (profile.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: profile.user_id });
      }
    }, 300);
  };


  return (

    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TouchableOpacity onPress={() => handleNavigate()}>
          <Image
            source={{ uri: profile?.imageUrl }}
            style={{
              width: 35,
              height: 35,
              borderRadius: 20,
              marginRight: 10
            }}
          />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          onChangeText={setText}
          value={text}
          placeholder="Add a comment..."
          placeholderTextColor={COLOR_PLACEHOLDER}
          multiline
          accessibilityLabel="Message input"
          accessibilityHint="Type your message here"
          returnKeyType="default"
        />
        {text.trim().length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.iconWrapper,
              loading && styles.loadingIconWrapper,
              loading && { opacity: 0.6 },
              pressed && !loading && { opacity: 0.7 },
            ]}
            onPress={handleSend}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <View style={{ transform: [{ scale: 0.8 }] }}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <Icon name="send" size={18} color="#fff" />
            )}
          </Pressable>

        )}
      </View>
    </View>
  );


};


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 6, // Space between text and icon
    color: '#000',
  },
  iconWrapper: {
    backgroundColor: '#075cab',
    borderRadius: 20,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  loadingIconWrapper: {
    padding: 7,
  },

});



export default CommentInputBar;

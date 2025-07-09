

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, Image, StyleSheet, ToastAndroid, TouchableOpacity, Text, Alert, TextInput, RefreshControl, Share, SafeAreaView, Keyboard, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import FastImage from 'react-native-fast-image';
import Message from '../../components/Message';
import defaultImage from '../../images/homepage/image.jpg'
import { useDispatch, useSelector } from 'react-redux';
import apiClient from '../ApiClient';
import { clearMyForumPosts, deleteMyPost, setMyPostImageUrls, setMyPosts } from '../Redux/MyPosts/MyForumPost_Actions';
import { useFocusEffect } from '@react-navigation/native';
import { showToast } from '../AppUtils/CustomToast';
import { useNetwork } from '../AppUtils/IdProvider';
import { EventRegister } from 'react-native-event-listeners';
import { MyPostBody } from './forumBody';

const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];


const YourForumListScreen = ({ navigation, route }) => {
  const myForums = useSelector(state => state.myForums.posts);
  const imageUrls1 = useSelector(state => state.myForums.imageUrls);
  
  const { myId, myData } = useNetwork();

  const [allForumPost, setAllForumPost] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const scrollViewRef = useRef(null)
  const [fileKeyToDelete, setFileKeyToDelete] = useState(null);
  const defaultLogo = Image.resolveAssetSource(defaultImage).uri;

  const dispatch = useDispatch();

  useEffect(() => {

    fetchPosts();
  }, []);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);

  useEffect(() => {
    const listener = EventRegister.addEventListener('onForumPostCreated', async ({ newPost }) => {
      console.log('🔔 Forum Post Created Event Received:', newPost);

      try {
        const signedUrl = await getSignedUrlForPost(newPost, defaultLogo);
        const postWithMedia = { ...newPost, signedUrl };

        console.log('🖼️ Signed URL resolved:', signedUrl);
        console.log('✅ Adding post to forum list (with media):', postWithMedia);

        setAllForumPost((prev) => {
          const updated = [postWithMedia, ...prev];
          console.log('📥 Updated post list:', updated);
          return [...updated]; // force new reference
        });

      } catch (error) {
        console.error('⚠️ Failed to fetch media for new post:', error);
        console.log('📝 Fallback: Adding post without media:', newPost);

        setAllForumPost((prev) => {
          const updated = [newPost, ...prev];
          console.log('📥 Updated post list (fallback):', updated);
          return [...updated]; // ensure new array reference
        });
      }
    });

    const deleteListener = EventRegister.addEventListener('onForumPostDeleted', ({ forum_id }) => {
      console.log('❌ Post Deleted Event:', forum_id);

      setAllForumPost((prev) => {
        const updated = prev.filter((post) => post.forum_id !== forum_id);
        console.log('🗑️ Updated list after deletion:', updated);
        return [...updated];
      });
    });

    const updateListener = EventRegister.addEventListener('onForumPostUpdated', ({ updatedPost }) => {
      console.log('✏️ Post Updated Event:', updatedPost);

      setAllForumPost((prev) => {
        const updated = prev.map((post) =>
          post.forum_id === updatedPost.forum_id ? updatedPost : post
        );
        console.log('🔁 Updated list after edit:', updated);
        return [...updated];
      });
    });

    return () => {
      EventRegister.removeEventListener(listener);
      EventRegister.removeEventListener(deleteListener);
      EventRegister.removeEventListener(updateListener);
    };
  }, []);


  const fetchPosts = async (lastEvaluatedKey = null) => {
    if (!myId || loading || loadingMore) return;

    lastEvaluatedKey ? setLoadingMore(true) : setLoading(true);

    try {
      if (!lastEvaluatedKey) {
        setAllForumPost([]); // Clear list before fetching
      }

      const requestData = {
        command: "getUsersAllForumPosts",
        user_id: myId,
        limit: 10,
      };

      if (lastEvaluatedKey) {
        requestData.lastEvaluatedKey = lastEvaluatedKey;
      }

      const response = await apiClient.post("/getUsersAllForumPosts", requestData);

      if (response.data.status === "success") {
        let posts = response.data.response || [];
        posts.sort((a, b) => b.posted_on - a.posted_on);

        let updatedPosts;

        if (!lastEvaluatedKey) {
          updatedPosts = posts;
        } else {
          const newPosts = posts.filter(
            (post) =>
              !allForumPost.some((existingPost) => existingPost.forum_id === post.forum_id)
          );
          updatedPosts = [...allForumPost, ...newPosts];
        }

        setAllForumPost(updatedPosts);

        // Pagination
        if (response.data.lastEvaluatedKey) {
          setLastEvaluatedKey(response.data.lastEvaluatedKey);
          setHasMorePosts(true);
        } else {
          setHasMorePosts(false);
        }

        // Fetch signed URLs
        // Fetch signed URLs
        const urlsObject = {};
        await Promise.all(
          posts.map(async (post) => {
            urlsObject[post.forum_id] = await getSignedUrlForPost(post, defaultLogo);
          })
        );
        setImageUrls(urlsObject)

      }
    } catch (error) {

      setHasError(true);
      setAllForumPost([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);

    }
  };

  const getSignedUrlForPost = async (post, defaultLogo) => {
    const fileKey = post.fileKey?.split("?")[0]?.toLowerCase() || "";
    const isVideo = videoExtensions.some((ext) => fileKey.endsWith(ext));
    const keyToFetch = isVideo ? post.thumbnail_fileKey : post.fileKey;

    if (!keyToFetch) return defaultLogo;

    try {
      const response = await apiClient.post("/getObjectSignedUrl", {
        command: "getObjectSignedUrl",
        key: keyToFetch,
      });

      const img_url = response.data;
      return img_url ? `${img_url}?t=${Date.now()}` : defaultLogo;
    } catch (error) {
      console.error("Error getting signed URL:", error);
      return defaultLogo;
    }
  };

  const handleEditPress = (post, imageUrl) => {
    navigation.navigate("ForumEdit", { post, imageUrl });
  };

  const forumDetails = (forum_id) => {
    navigation.navigate("Comment", { forum_id });
  };
  const handleDelete = (forum_id, fileKey, thumbnail_fileKey) => {
    const filesToDelete = [fileKey, thumbnail_fileKey];

    setPostToDelete(forum_id);
    setFileKeyToDelete(filesToDelete);
    setShowDeleteConfirmation(true);
  };


  const confirmDelete = async () => {
    setShowDeleteConfirmation(false);

    if (fileKeyToDelete && fileKeyToDelete.length > 0) {
      try {
        for (const key of fileKeyToDelete) {
          if (key) {
            const fileDeleteResponse = await apiClient.post('/deleteFileFromS3', {
              command: 'deleteFileFromS3',
              key: key,
            });

            if (fileDeleteResponse.data.statusCode !== 200) {
              throw new Error(`Failed to delete file: ${key}`);
            }
          }
        }
      } catch (error) {
        showToast("Something went wrong", 'error');
        return;
      }
    }

    try {
      const response = await apiClient.post('/deleteForumPost', {
        command: "deleteForumPost",
        user_id: myId,
        forum_id: postToDelete,
      });

      if (response.data.status === 'success') {

        EventRegister.emit('onForumPostDeleted', { forum_id: postToDelete });

        showToast("Forum post deleted", 'success');
      } else {
        throw new Error(response.data.status_message || "Failed to delete post.");
      }
    } catch (error) {
      showToast("Something went wrong", 'error');
    }
  };




  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
    setPostToDelete(null);
    setFileKeyToDelete(null);
  };


  const RenderPostItem = ({ item }) => {

    const rawHtml = (item.forum_body || '').trim();
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(rawHtml);
    const forumBodyHtml = hasHtmlTags ? rawHtml : `<p>${rawHtml}</p>`;

    const imageUri = item.thumbnailUrl || imageUrls[item.forum_id] || item.imageUrl || item.signedUrl;
    const hasImage = !!imageUri;

    const formattedDate = new Date(item.posted_on * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '/');

    return (
      <TouchableOpacity activeOpacity={1} onPress={() => {
        forumDetails(item.forum_id);
      }}>
        <View style={styles.postContainer}>
          <View style={styles.imageContainer}>
            {hasImage && (
              <FastImage
                source={{
                  uri: imageUri,
                  priority: FastImage.priority.normal,
                  cache: FastImage.cacheControl.web,
                }}
                style={styles.image}
                resizeMode="contain"
              />
            )}


          </View>

          <View style={styles.textContainer}>
            <MyPostBody
              html={item.forum_body}
              forumId={item?.forum_id}
              numberOfLines={2}
            />
            <Text style={styles.value}>{formattedDate || ""}</Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditPress(item, imageUri)}
              >
                <Icon name="pencil" size={20} style={{ color: '#075cab' }} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.forum_id, item.fileKey, item.thumbnail_fileKey)}
              >
                <Icon name="delete" size={20} color="#FF0000" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const keyExtractor = (item) =>
    item.id ? item.id.toString() : Math.random().toString();

  if (Array.isArray(allForumPost) && allForumPost.length === 0 && !loading) {

    return (

      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#075cab" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.circle}
            onPress={() => navigation.navigate("ForumPost")} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color="#075cab" />
            <Text style={styles.shareText}>Post</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: 'gray' }}>No posts available</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (


    <SafeAreaView style={styles.container}>

      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#075cab" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.circle}
          onPress={() => navigation.navigate("ForumPost")} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={18} color="#075cab" />
          <Text style={styles.shareText}>Post</Text>
        </TouchableOpacity>

      </View>


      <FlatList
        data={allForumPost}
        renderItem={RenderPostItem}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        contentContainerStyle={{ paddingBottom: '20%' }}
        keyExtractor={(item) => item.forum_id}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        onEndReached={() => hasMorePosts && fetchPosts(lastEvaluatedKey)} // Fetch more posts
        onEndReachedThreshold={0.5}
        bounces={false}
      />


      {showDeleteConfirmation && (
        <Message
          visible={showDeleteConfirmation}
          onCancel={cancelDelete}
          onOk={confirmDelete}
          title="Delete Confirmation"
          iconType="warning"  // You can change this to any appropriate icon type
          message="Are you sure you want to delete this post?"
        />
      )}


      <Toast />

    </SafeAreaView>


  );
};



const styles = StyleSheet.create({

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10
  },
  postContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    marginHorizontal: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#ddd',
    shadowColor: '#000',
    top: 10
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPostsText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '400',
    padding: 10
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10
  },
  searchContainer: {
    flex: 1,
    padding: 10,
    alignSelf: 'center',
    backgroundColor: 'whitesmoke',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: 'whitesmoke',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    height: 30,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    color: "black",
    fontSize: 14,
    paddingTop: 0,
    paddingBottom: 0,
    lineHeight: 20,
  },

  plusicon: {
    color: 'white',
    backgroundColor: '#075cab',

  },
  circle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,

  },
  shareText: {
    color: '#075cab',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,

  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,

  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    // backgroundColor:'red',
    alignItems: 'center',
    padding: 10
  },

  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    // backgroundColor:'blue',
  },

  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 5
  },
  video: {
    width: 100,
    height: 100,
    borderRadius: 8

  },

  textContainer: {
    flex: 2,
    padding: 15,
    gap: 8,
  },

  title: {
    fontSize: 15,
    fontWeight: '600',
    color: "black"

  },
  body: {
    textAlign: 'justify',
    fontSize: 15,
    color: 'black',
    fontWeight: '400',
  },

  downtext: {
    fontSize: 15,
    marginLeft: 10,
    color: 'gray',
    fontWeight: "450"
  },
  value: {
    flex: 2,
    flexShrink: 1,
    color: 'black',
    fontWeight: '400',
    fontSize: 14,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 5,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    // elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 1 },

  },
  editButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: "#075cab",
  },
  deleteButtonText: {
    color: "#FF0000",
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 10,
    backgroundColor: '#ffffff',
    // elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 1 },

  },


  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    left: 10
  },
  shareButtonText: {
    color: "#075cab",
  },
  confirmationContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -150 }, { translateY: -120 }],
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    width: 320,
    alignItems: 'center',
    zIndex: 999,
    elevation: 10, // For shadow effect on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 15,
  },
  confirmationText: {
    fontSize: 15,
    textAlign: 'center',
    color: 'black',
    marginBottom: 25,
  },
  confirmationButtons: {
    flexDirection: 'row',


  },
  confirmButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#FF0000',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconStyle: {
    backgroundColor: 'whitesmoke',
    borderRadius: 25,
    padding: 10,
    marginBottom: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },


});
export default YourForumListScreen;







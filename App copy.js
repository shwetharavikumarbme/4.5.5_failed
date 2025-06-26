import React, { useState, useEffect, useCallback, useRef, Profiler, useMemo } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, textInputRef, TextInput, Dimensions, Modal, StyleSheet, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, SafeAreaView, ActivityIndicator, Linking, Share, Button, RefreshControl, Animated, PanResponder, ScrollView, Platform, InputAccessoryView } from "react-native";
import Video from "react-native-video";
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import { useIsFocused } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg';
import FastImage from "react-native-fast-image";
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from "../ApiClient";
import { useDispatch, useSelector } from "react-redux";
import { clearPosts, setCommentsCount, updateOrAddPosts } from "../Redux/Forum_Actions";
import { useNetwork } from "../AppUtils/IdProvider";
import { showToast } from "../AppUtils/CustomToast";
import Fuse from "fuse.js";
import CommentsSection from "../AppUtils/Comments";
import { useBottomSheet } from "../AppUtils/SheetProvider";
import CommentInputBar from "../AppUtils/InputBar";
import { EventRegister } from "react-native-event-listeners";
import { fetchCommentCount } from "../AppUtils/CommentCount";
import { useConnection } from "../AppUtils/ConnectionProvider";
import AppStyles from "../../assets/AppStyles";
import { getSignedUrl, getTimeDisplay } from "../helperComponents.jsx/signedUrls";
import { openMediaViewer } from "../helperComponents.jsx/mediaViewer";
import { fetchForumReactionsRaw } from "../helperComponents.jsx/ForumReactions";
import ReactionSheet from "../helperComponents.jsx/ReactionUserSheet";
import { ForumBody } from "./forumBody";

const width = Dimensions.get('window').width;
const ITEM_HEIGHT = 500; // Approximate height of your post items

const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];

// Create a simple URL cache
const urlCache = new Map();

const getCachedSignedUrl = async (type, key) => {
  const cacheKey = `${type}:${key}`;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey);
  }
  
  try {
    const res = await getSignedUrl(type, key);
    urlCache.set(cacheKey, res);
    return res;
  } catch (error) {
    return null;
  }
};

const Latest = ({ isPageFocused, scrollRef }) => {
  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();

  const [allPosts, setAllPosts] = useState();
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLimit, setSuggestionsLimit] = useState(5);
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  const dispatch = useDispatch();
  const videoRefs = useRef({});
  const navigation = useNavigation();
  const [localPosts, setLocalPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const isFocused = useIsFocused();
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchCount, setSearchCount] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(1);
  const [expandedTexts, setExpandedTexts] = useState({});
  const [searchResults, setSearchResults] = useState(false);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const reactionSheetRef = useRef(null);
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);
  const viewedForumIdsRef = useRef(new Set());
  const lastCheckedTimeRef = useRef(Math.floor(Date.now() / 1000));
  const [lastCheckedTime, setLastCheckedTime] = useState(lastCheckedTimeRef.current);
  const [newJobCount, setNewJobCount] = useState(0);
  const [showNewJobAlert, setShowNewJobAlert] = useState(false);

  const reactionConfig = [
    { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
    { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
    { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
    { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
    { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
  ];

  // Helper function to update or add post
  const updateOrAddPost = (posts, updatedPost) => {
    const existingIndex = posts.findIndex(p => p.forum_id === updatedPost.forum_id);
    if (existingIndex >= 0) {
      const newPosts = [...posts];
      newPosts[existingIndex] = { ...newPosts[existingIndex], ...updatedPost };
      return newPosts;
    }
    return [updatedPost, ...posts];
  };

  const fetchMediaForPost = async (post) => {
    const mediaData = { forum_id: post.forum_id };
    
    // First update with basic post data
    setLocalPosts(prev => updateOrAddPost(prev, { ...post, ...mediaData }));
    
    const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
    const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
    const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;

    if (post.fileKey) {
      try {
        const res = await getCachedSignedUrl('file', post.fileKey);
        const url = res?.file;

        if (url) {
          const updatedMedia = { ...mediaData, imageUrl: url };
          
          if (videoExtensions.some(ext => post.fileKey.toLowerCase().endsWith(ext))) {
            updatedMedia.videoUrl = url;
            // Don't wait for thumbnail - show video immediately
            setLocalPosts(prev => updateOrAddPost(prev, { ...post, ...updatedMedia }));
            
            // Fetch thumbnail in background
            if (post.thumbnail_fileKey) {
              getCachedSignedUrl('thumb', post.thumbnail_fileKey).then(thumbRes => {
                setLocalPosts(prev => updateOrAddPost(prev, { 
                  ...post, 
                  thumbnailUrl: thumbRes?.thumb 
                }));
              });
            }
          } else {
            setLocalPosts(prev => updateOrAddPost(prev, { ...post, ...updatedMedia }));
          }
        }
      } catch (error) {
        mediaData.imageUrl = null;
        mediaData.videoUrl = null;
      }
    }

    // Handle author image
    let authorImageUrl = null;
    if (post.author_fileKey) {
      try {
        const res = await getCachedSignedUrl('author', post.author_fileKey);
        authorImageUrl = res?.author;
      } catch (err) {
        console.warn("Failed to fetch author image:", err);
      }
    }

    if (!authorImageUrl) {
      const userType = (post.user_type || '').toLowerCase();
      const authorGender = (post.author_gender || '').toLowerCase();

      if (userType === 'company') {
        authorImageUrl = defaultImageUriCompany;
      } else if (userType === 'users' && authorGender === 'female') {
        authorImageUrl = defaultImageUriFemale;
      } else {
        authorImageUrl = defaultImageUriMale;
      }
    }

    mediaData.authorImageUrl = authorImageUrl;
    setLocalPosts(prev => updateOrAddPost(prev, { ...post, ...mediaData }));

    return { ...post, ...mediaData };
  };

  const fetchLatestPosts = async (lastKey = null) => {
    if (!isConnected) return;
    if (loading || loadingMore) return;

    const startTime = Date.now();
    lastKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command: 'getLatestPosts',
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };
      const response = await apiClient.post('/getLatestPosts', requestData);

      const newPosts = response?.data?.response || [];
      if (!newPosts.length) {
        setHasMorePosts(false);
        return;
      }

      const responseTime = Date.now() - startTime;
      if (responseTime < 500) {
        setFetchLimit(prev => Math.min(prev + 2, 30));
      } else if (responseTime > 1200) {
        setFetchLimit(prev => Math.max(prev - 1, 3));
      }

      // First update with basic post data
      setLocalPosts(prev => [...prev, ...newPosts]);
      
      // Then load media and additional data with priority
      newPosts.forEach((post, index) => {
        const priorityDelay = index < 3 ? 0 : index * 200;
        
        setTimeout(async () => {
          const postWithMedia = await fetchMediaForPost(post);
          const commentCount = await fetchCommentCount(post.forum_id);
          const { reactionsCount, totalReactions, userReaction } = await fetchForumReactionsRaw(post.forum_id, myId);

          setLocalPosts(prev => updateOrAddPost(prev, {
            ...postWithMedia,
            commentCount,
            reactionsCount,
            totalReactions,
            userReaction,
          }));
        }, priorityDelay);
      });

      setHasMorePosts(!!response.data.lastEvaluatedKey);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);
    } catch (error) {
      console.error('[fetchLatestPosts] error:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ... (keep all your existing useEffect hooks and other functions as they are)

  const renderItem = useCallback(({ item }) => {
    return (
      <View style={styles.comments}>
        <View style={styles.dpContainer}>
          <TouchableOpacity style={styles.dpContainer1} onPress={() => handleNavigate(item)}
            activeOpacity={0.8}>
            <FastImage
              source={{ 
                uri: item.authorImageUrl,
                priority: FastImage.priority.high,
                cache: FastImage.cacheControl.immutable
              }}
              style={styles.image1}
            />
          </TouchableOpacity>

          <View style={styles.textContainer}>
            <View style={styles.title3}>
              <TouchableOpacity onPress={() => handleNavigate(item)}>
                <Text style={{ flex: 1, alignSelf: 'flex-start', color: 'black', fontSize: 15, fontWeight: '600' }}>
                  {(item.author || '').trimStart().trimEnd()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={styles.title}>{item.author_category || ''}</Text>
              </View>
              <View>
                <Text style={[styles.date1]}>{getTimeDisplay(item.posted_on)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: 10, }}>
          <ForumBody
            html={item.forum_body}
            forumId={item.forum_id}
            isExpanded={expandedTexts[item.forum_id]}
            toggleFullText={toggleFullText}
          />
        </View>
        
        {item.videoUrl ? (
          <TouchableOpacity activeOpacity={1}>
            <Video
              ref={(ref) => {
                if (ref) {
                  videoRefs.current[item.forum_id] = ref;
                }
              }}
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
              }}
              controls
              paused={activeVideo !== item.forum_id}
              resizeMode="contain"
              poster={item.thumbnailUrl}
              repeat
              posterResizeMode="cover"
              bufferConfig={{
                minBufferMs: 15000,
                maxBufferMs: 30000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000
              }}
              maxBitRate={2000000}
              preferredForwardBufferDuration={5}
            />
          </TouchableOpacity>
        ) : (
          item.imageUrl && (
            <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])}
              activeOpacity={1}>
              <FastImage
                source={{ 
                  uri: item.imageUrl,
                  priority: FastImage.priority.high,
                  cache: FastImage.cacheControl.immutable
                }}
                style={{
                  width: '100%',
                  aspectRatio: item.aspectRatio || 1,
                }}
                resizeMode={FastImage.resizeMode.contain}
              />
            </TouchableOpacity>
          )
        )}

        {/* Rest of your renderItem content remains the same */}
        {/* ... */}
      </View>
    );
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId]);

  return (
    <Profiler id="ForumListCompanylatest">
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke' }}>
        {showNewJobAlert && (
          <TouchableOpacity onPress={handleRefresh} style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#075cab', padding: 10, borderRadius: 10, zIndex: 10 }}>
            <Text style={{ color: 'white' }}>{newJobCount} new post{newJobCount > 1 ? 's' : ''} available — Tap to refresh</Text>
          </TouchableOpacity>
        )}
        <View style={styles.container}>
          {suggestions.length > 0 && (
            <ScrollView
              style={styles.suggestionContainer}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ backgroundColor: '#fff' }}
            >
              {suggestions.slice(0, suggestionsLimit).map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    const slicedQuery = item?.forum_body.length > 100
                      ? `${item?.forum_body.slice(0, 30)}`
                      : item?.forum_body;

                    setSearchQuery(slicedQuery);
                    handleSearch(slicedQuery);
                    setSuggestions([]);
                    setSuggestionsLimit(5);
                    searchInputRef.current?.blur();
                  }}
                  style={styles.suggestionItem}
                >
                  <Text style={styles.suggestionTitle}>
                    {item?.forum_body.length > 100
                      ? `${item?.forum_body.slice(0, 40)}...`
                      : item?.forum_body}
                  </Text>
                </TouchableOpacity>
              ))}

              {suggestions.length > suggestionsLimit && (
                <TouchableOpacity
                  onPress={() => setSuggestionsLimit(suggestionsLimit + 5)}
                  style={styles.loadMoreButton}
                >
                  <Text style={styles.loadMoreText}>Load More</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <TouchableWithoutFeedback
            onPress={() => {
              Keyboard.dismiss();
              searchInputRef.current?.blur?.();
              setSuggestions([]);
            }}
          >
            {!loading ? (
              <FlatList
                data={!searchTriggered || searchQuery.trim() === '' ? localPosts : searchResults}
                renderItem={renderItem}
                ref={listRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => {
                  Keyboard.dismiss();
                  searchInputRef.current?.blur?.();
                  setSuggestions([]);
                }}
                keyExtractor={(item, index) => `${item.forum_id}-${index}`}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: '10%' }}
                initialNumToRender={3}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={100}
                windowSize={7}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                  length: ITEM_HEIGHT,
                  offset: ITEM_HEIGHT * index,
                  index,
                })}
                ListHeaderComponent={
                  <>
                    <View style={AppStyles.headerContainer}>
                      <View style={AppStyles.searchContainer}>
                        <View style={AppStyles.inputContainer}>
                          <TextInput
                            style={[AppStyles.searchInput]}
                            placeholder="Search"
                            ref={searchInputRef}
                            placeholderTextColor="gray"
                            value={searchQuery}
                            onChangeText={handleInputChange}
                            onSubmitEditing={() => {
                              if (searchQuery.trim() !== '') {
                                handleSearch(searchQuery);
                                setSearchTriggered(true);
                                setSuggestions([]);
                                searchInputRef.current?.blur();
                              }
                            }}
                            returnKeyType="search"
                          />

                          {searchTriggered ? (
                            <TouchableOpacity
                              onPress={() => {
                                setSearchQuery('');
                                setSearchTriggered(false);
                                setSearchResults([]);
                                setSearchCount(0);
                              }}
                              style={AppStyles.iconButton}
                            >
                              <Icon name="close-circle" size={20} color="gray" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={AppStyles.searchIconButton}
                            >
                              <Icon name="magnify" size={20} color="#075cab" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={AppStyles.circle}
                        onPress={() => {
                          if (isConnected) {
                            navigation.navigate("ForumPost");
                          } else {
                            showToast('No internet connection', 'error')
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#075cab" />
                        <Text style={AppStyles.shareText}>Post</Text>
                      </TouchableOpacity>
                    </View>
                    {searchTriggered && searchResults.length > 0 && (
                      <Text style={styles.companyCount}>
                        {searchResults.length} results found
                      </Text>
                    )}
                  </>
                }
                ListEmptyComponent={
                  (searchTriggered && searchResults.length === 0) ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                      <Text style={{ fontSize: 16, color: '#666' }}>No posts found</Text>
                    </View>
                  ) : null
                }
                ListFooterComponent={
                  loadingMore ? (
                    <View style={{ paddingVertical: 20 }}>
                      <ActivityIndicator size="small" color="#075cab" />
                    </View>
                  ) : null
                }
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={'#075cab'} size="large" />
              </View>
            )}
          </TouchableWithoutFeedback>
        </View>
        <ReactionSheet ref={reactionSheetRef} />
      </SafeAreaView>
    </Profiler>
  );
};

const styles = StyleSheet.create({
  companyCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  suggestionContainer: {
    position: 'absolute',
    top: 50, // adjust depending on your header/search bar height
    width: '95%',
    alignSelf: 'center',
    maxHeight: '45%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999, // ensures it's above FlatList
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionTitle: {
    fontSize: 14,
    color: 'black'
  },
  loadMoreButton: {
    paddingVertical: 10,
    alignItems: 'center',

  },
  loadMoreText: {
    fontWeight: '600',
    color: '#075cab',
  },

  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',

  },

  comments: {
    paddingHorizontal: 5,
    borderTopWidth: 0.5,
    borderColor: '#ccc',
    paddingVertical: 10,
    backgroundColor: 'white',
    minHeight: 120,

  },

  image1: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 100,
  },

  title: {
    fontSize: 13,
    color: 'black',
    // marginBottom: 5,
    fontWeight: '300',
    textAlign: 'justify',
    alignItems: 'center',
  },

  title3: {
    fontSize: 15,
    color: 'black',
    // marginBottom: 5,
    fontWeight: '500',
    flexDirection: 'row',  // Use row to align items horizontally
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',


  },
  date1: {
    fontSize: 13,
    color: 'black',
    // marginBottom: 5,
    fontWeight: '300',


  },
  title1: {
    backgroundColor: 'red'

  },

  readMore: {
    color: 'gray', // Blue color for "Read More"
    fontWeight: '300', // Make it bold if needed
    fontSize: 13,
  },

  dpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10

  },
  dpContainer1: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    alignSelf: 'flex-start',

  },
  textContainer: {
    flex: 1,
    justifyContent: 'space-between',

  },
  iconContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  iconText: {
    fontSize: 12,
    color: '#075cab',
  },

  backButton: {
    alignSelf: 'flex-start',
    padding: 10

  },

  iconTextUnderlined: {
    fontSize: 13,
    fontWeight: '400',
    color: '#075cab',
    marginLeft: 1,
    marginRight: 3
  },


});


export default Latest;
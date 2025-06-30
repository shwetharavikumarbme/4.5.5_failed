import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, SafeAreaView, Keyboard } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FastImage from "react-native-fast-image";
import Video from "react-native-video";

import apiClient from "../ApiClient";
import { useNetwork } from "../AppUtils/IdProvider";
import { useConnection } from "../AppUtils/ConnectionProvider";
import { useBottomSheet } from "../AppUtils/SheetProvider";
import { showToast } from "../AppUtils/CustomToast";
import { clearPosts } from "../Redux/Forum_Actions";
import { getTimeDisplay } from "../helperComponents.jsx/signedUrls";
import { openMediaViewer } from "../helperComponents.jsx/mediaViewer";
import { fetchForumReactionsBatch } from "../helperComponents.jsx/ForumReactions";
import { fetchMediaForPost } from "../helperComponents.jsx/forumViewableItems";
import { fetchCommentCount } from "../AppUtils/CommentCount";
import ReactionSheet from "../helperComponents.jsx/ReactionUserSheet";
import CommentsSection from "../AppUtils/Comments";
import CommentInputBar from "../AppUtils/InputBar";
import AppStyles from "../../assets/AppStyles";
import { ForumBody, generateHighlightedHTML } from "./forumBody";
import { EventRegister } from "react-native-event-listeners";

const reactionConfig = [
  { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
  { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
  { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
  { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
  { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
];

const withTimeout = (promise, timeout = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
  ]);
};

const BaseForumComponent = ({ 
  fetchCommand, 
  searchCommand, 
  type = null,
  isPageFocused,
  scrollRef,
  showPostButton = true
}) => {
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const { openSheet } = useBottomSheet();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  const [localPosts, setLocalPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(3);
  const [expandedTexts, setExpandedTexts] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);
  const [newPostCount, setNewPostCount] = useState(0);
  const [showNewPostAlert, setShowNewPostAlert] = useState(false);

  const videoRefs = useRef({});
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const reactionSheetRef = useRef(null);
  const commentSectionRef = useRef(null);
  const lastCheckedTimeRef = useRef(Math.floor(Date.now() / 1000));
  const isRefreshingRef = useRef(false);
  const debounceTimeout = useRef(null);
  const viewedForumIdsRef = useRef(new Set());

  // Fetch posts with the configured command
  const fetchPosts = async (lastKey = null) => {
    if (!isConnected || loading || loadingMore) return;
    
    const startTime = Date.now();
    lastKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command: fetchCommand,
        limit: fetchLimit,
        ...(type && { type }),
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };

      const response = await withTimeout(
        apiClient.post(`/${fetchCommand}`, requestData),
        10000
      );

      const newPosts = response?.data?.response || [];
      
      if (!newPosts.length) {
        setHasMorePosts(false);
        return;
      }

      // Adjust fetch limit based on response time
      const responseTime = Date.now() - startTime;
      if (responseTime < 500) setFetchLimit(prev => Math.min(prev + 2, 10));
      else if (responseTime > 1200) setFetchLimit(prev => Math.max(prev - 1, 3));

      const sortedNewPosts = newPosts.sort((a, b) => b.posted_on - a.posted_on);
      const forumIds = sortedNewPosts.map(p => p.forum_id);

      const [postsWithMedia, reactionMap, commentCountsArray] = await Promise.all([
        fetchMediaForPost(sortedNewPosts),
        fetchForumReactionsBatch(forumIds, myId),
        Promise.all(forumIds.map(id => fetchCommentCount(id))),
      ]);

      // Map comment counts to forumIds
      const commentCounts = {};
      forumIds.forEach((id, idx) => {
        commentCounts[id] = commentCountsArray[idx];
      });

      const postsWithExtras = postsWithMedia.map((post) => {
        const forumId = post.forum_id;
        const reactions = reactionMap[forumId] || {};

        return {
          ...post,
          commentCount: commentCounts[forumId] || 0,
          reactionsCount: reactions.reactionsCount || {},
          totalReactions: reactions.totalReactions || 0,
          userReaction: reactions.userReaction || null,
        };
      });

      setLocalPosts(prev => {
        const combined = [...prev, ...postsWithExtras];
        const unique = combined.filter(
          (p, i, arr) => i === arr.findIndex(pp => pp.forum_id === p.forum_id)
        );
        return unique;
      });

      setHasMorePosts(!!response.data.lastEvaluatedKey);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);
    } catch (error) {
      console.error(`[${fetchCommand}] error:`, error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Handle search with the configured command
  const handleSearch = useCallback(async (text) => {
    if (!isConnected) {
      showToast('No internet connection', 'error');
      return;
    }

    const trimmedText = text.trim();
    setSearchQuery(trimmedText);

    if (trimmedText === '') {
      setSearchResults([]);
      setSearchTriggered(false);
      return;
    }

    try {
      const requestData = {
        command: searchCommand,
        searchQuery: trimmedText,
      };

      const res = await withTimeout(apiClient.post(`/${searchCommand}`, requestData), 10000);
      const forumPosts = res.data.response || [];
      const count = res.data.count || forumPosts.length;

      const postsWithMedia = await Promise.all(
        forumPosts.map(post => fetchMediaForPost(post))
      );

      setSearchResults(postsWithMedia);
      setSearchTriggered(true);
    } catch (error) {
      console.error(`[${searchCommand}] error:`, error);
    }
  }, [isConnected, searchCommand]);

  // Debounced search handler
  const handleDebouncedTextChange = useCallback((text) => {
    setSearchQuery(text);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    const trimmedText = text.trim();
    if (trimmedText === '') {
      setSearchTriggered(false);
      setSearchResults([]);
      return;
    }
    
    debounceTimeout.current = setTimeout(() => {
      handleSearch(trimmedText); 
    }, 300);
  }, [handleSearch]);

  // Check for new posts
  const checkForNewPosts = async () => {
    const now = Math.floor(Date.now() / 1000);

    try {
      const response = await apiClient.post('/getNewLatestForumPostsCount', {
        command: 'getNewLatestForumPostsCount',
        user_id: myId,
        lastVisitedTime: lastCheckedTimeRef.current,
      });

      const { count = 0, user_ids = [] } = response?.data || {};
      const filteredUserIds = user_ids.filter(id => id !== myId);
      const filteredCount = filteredUserIds.length;

      if (filteredCount > 0) {
        setNewPostCount(filteredCount);
        setShowNewPostAlert(true);
      } else {
        setShowNewPostAlert(false);
      }
    } catch (error) {
      console.error('Error checking for new posts:', error);
    }
  };

  // Refresh control
  const handleRefresh = useCallback(async () => {
    if (!isConnected || isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    setSearchQuery('');
    setSearchTriggered(false);
    setSearchResults([]);
    if (searchInputRef.current) searchInputRef.current.blur();
    setExpandedTexts({});

    setLocalPosts([]);
    setHasMorePosts(true);
    setLastEvaluatedKey(null);
    setNewPostCount(0);
    setShowNewPostAlert(false);
    lastCheckedTimeRef.current = Math.floor(Date.now() / 1000);

    dispatch(clearPosts());
    await fetchPosts(null);

    setIsRefreshing(false);
    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [fetchPosts, dispatch, isConnected]);

  // Handle end reached
  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMorePosts) return;
    fetchPosts(lastEvaluatedKey);
  }, [loading, loadingMore, hasMorePosts, lastEvaluatedKey, fetchPosts]);

  // Increment view count
  const incrementViewCount = async (forumId) => {
    try {
      await apiClient.post('/forumViewCounts', {
        command: 'forumViewCounts',
        forum_id: forumId,
      });
    } catch (error) {
      console.error("Error incrementing view count", error);
    }
  };

  // Viewable items changed handler
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!isFocused || !isPageFocused) {
      setActiveVideo(null);
      return;
    }

    if (viewableItems.length === 0) {
      setActiveVideo(null);
      return;
    }

    const visibleVideos = viewableItems
      .filter((item) => item.item.videoUrl && item.item.forum_id)
      .sort((a, b) => a.index - b.index);

    if (visibleVideos.length > 0) {
      const firstVisibleVideo = visibleVideos[0];
      const isCurrentVisible = viewableItems.some(
        (item) => item.item.forum_id === activeVideo
      );

      if (activeVideo && !isCurrentVisible) {
        setActiveVideo(null);
      }

      if (!activeVideo || firstVisibleVideo.item.forum_id !== activeVideo) {
        setActiveVideo(firstVisibleVideo.item.forum_id);
      }
    } else {
      setActiveVideo(null);
    }

    viewableItems.forEach(({ item }) => {
      const forumId = item.forum_id;
      if (forumId && !viewedForumIdsRef.current.has(forumId)) {
        viewedForumIdsRef.current.add(forumId);
        incrementViewCount(forumId);
      }
    });
  }).current;

  // Navigate to user/company profile
  const handleNavigate = (item) => {
    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 100);
  };

  // Open comment sheet
  const openCommentSheet = (forum_id, user_id) => {
    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          ref={commentSectionRef}
        />
        <CommentInputBar
          storedUserId={myId}
          forum_id={forum_id}
          onCommentAdded={(newCommentData) => {
            commentSectionRef.current?.handleCommentAdded(newCommentData);
          }}
          onEditComplete={(updatedComment) => {
            commentSectionRef.current?.handleEditComplete(updatedComment);
          }}
        />
      </View>,
      -Dimensions.get('window').height * 0.9
    );
  };

  // Toggle full text
  const toggleFullText = (id) => {
    setExpandedTexts(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Share post
  const sharePost = async (item) => {
    try {
      const baseUrl = 'https://bmebharat.com/latest/comment/';
      const postUrl = `${baseUrl}${item.forum_id}`;
      await Share.share({ message: postUrl });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  // Handle reaction
  const handleReaction = async (forumId, reactionType) => {
    try {
      setLocalPosts(prev =>
        prev.map(post => {
          if (post.forum_id !== forumId) return post;

          let newTotal = Number(post.totalReactions || 0);
          let newReaction = reactionType;

          const hadReaction = post.userReaction && post.userReaction !== 'None';

          if (reactionType === 'None') {
            if (hadReaction) newTotal -= 1;
            newReaction = null;
          } else if (!hadReaction) {
            newTotal += 1;
          }

          return {
            ...post,
            userReaction: newReaction,
            totalReactions: newTotal,
          };
        })
      );

      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
      });
    } catch (err) {
      console.warn('Reaction update failed', err);
    }
  };

  // Render each post item
  const renderItem = useCallback(({ item }) => {
    return (
      <View style={styles.comments}>
        <View style={styles.dpContainer}>
          <TouchableOpacity 
            style={styles.dpContainer1} 
            onPress={() => handleNavigate(item)}
            activeOpacity={0.8}
          >
            <FastImage
              source={item.authorImageUrl ? { uri: item.authorImageUrl } : null}
              style={styles.image1}
            />
          </TouchableOpacity>

          <View style={styles.textContainer}>
            <View style={styles.title3}>
              <TouchableOpacity onPress={() => handleNavigate(item)}>
                <Text style={styles.authorName}>
                  {(item.author || '').trim()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metaContainer}>
              <View>
                <Text style={styles.title}>{item.author_category || ''}</Text>
              </View>
              <View>
                <Text style={styles.date}>{getTimeDisplay(item.posted_on)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <ForumBody
            html={generateHighlightedHTML(item.forum_body, searchQuery)}
            forumId={item.forum_id}
            isExpanded={expandedTexts[item.forum_id]}
            toggleFullText={toggleFullText}
          />
        </View>

        {item.videoUrl ? (
          <TouchableOpacity activeOpacity={1}>
            <Video
              ref={(ref) => {
                if (ref) videoRefs.current[item.forum_id] = ref;
                else delete videoRefs.current[item.forum_id];
              }}
              source={{ uri: item.videoUrl }}
              style={styles.video}
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
              controlTimeout={2000}
            />
          </TouchableOpacity>
        ) : item.imageUrl && (
          <TouchableOpacity 
            onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])}
            activeOpacity={1}
          >
            <FastImage
              source={{ uri: item.imageUrl }}
              style={styles.image}
              resizeMode={FastImage.resizeMode.contain}
            />
          </TouchableOpacity>
        )}

        <View style={styles.reactionContainer}>
          <View>
            <TouchableOpacity
              onLongPress={() => setActiveReactionForumId(
                prev => prev === item.forum_id ? null : item.forum_id
              )}
              activeOpacity={0.7}
              style={styles.reactionButton}
              onPress={async () => {
                const currentReaction = item.userReaction || 'None';
                const selectedType = currentReaction !== 'None' ? 'None' : 'Like';
                await handleReaction(item.forum_id, selectedType);
              }}
            >
              {item.userReaction && item.userReaction !== 'None' ? (
                <>
                  <Text style={styles.reactionEmoji}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.emoji || '👍'}
                  </Text>
                  <Text style={styles.reactionLabel}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.label || 'Like'}
                  </Text>
                </>
              ) : (
                <View style={styles.defaultReaction}>
                  <Text style={styles.reactText}>React: </Text>
                  <Icon name="thumb-up-outline" size={18} color="#999" />
                </View>
              )}
            </TouchableOpacity>

            {activeReactionForumId === item.forum_id && (
              <>
                <TouchableWithoutFeedback onPress={() => setActiveReactionForumId(null)}>
                  <View style={styles.reactionOverlay} />
                </TouchableWithoutFeedback>

                <View style={styles.reactionPickerContainer}>
                  <View style={styles.reactionPicker}>
                    {reactionConfig.map(({ type, emoji }) => {
                      const isSelected = item.userReaction === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          onPress={async () => {
                            const selectedType = item.userReaction === type ? 'None' : type;
                            await handleReaction(item.forum_id, selectedType);
                            setActiveReactionForumId(null);
                          }}
                          style={[
                            styles.reactionOption,
                            isSelected && styles.selectedReaction
                          ]}
                        >
                          <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.reactionSummary}>
            <TouchableOpacity
              onPress={() => reactionSheetRef.current?.open(item.forum_id, 'All')}
              style={styles.reactionCountButton}
            >
              {item.totalReactions > 0 && (
                <Text style={styles.reactionCount}>({item.totalReactions})</Text>
              )}
            </TouchableOpacity>

            <View style={styles.reactionIcons}>
              {reactionConfig.map(({ type, emoji }, index) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => reactionSheetRef.current?.open(item.forum_id, 'All')}
                  activeOpacity={0.8}
                  style={styles.reactionIcon}
                >
                  <Text style={styles.reactionIconEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.actionContainer}>
          <View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openCommentSheet(item.forum_id, item.user_id)}
            >
              <Icon name="comment-outline" size={17} color="#075cab" />
              <Text style={styles.actionText}>
                Comments{item.commentCount > 0 ? ` ${item.commentCount}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="eye-outline" size={20} color="#075cab" />
              <Text style={styles.actionText}>Views {item.viewsCount || '0'}</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => sharePost(item)}
            >
              <Icon name="share-outline" size={21} color="#075cab" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId, searchQuery]);

  // Set up scroll ref
  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = {
        scrollToTop: () => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }),
        handleRefresh: handleRefresh,
      };
    }
  }, [scrollRef, handleRefresh]);

  // Set up active video ref
  useEffect(() => {
    if (!isFocused || !isPageFocused) {
      setActiveVideo(null);
    }
  }, [isFocused, isPageFocused]);

  // Set up event listeners
  useEffect(() => {
    const listeners = [
      EventRegister.addEventListener('onForumPostCreated', async ({ newPost }) => {
        try {
          const postWithMedia = await fetchMediaForPost(newPost);
          setLocalPosts(prev => [postWithMedia, ...prev]);
        } catch (error) {
          setLocalPosts(prev => [newPost, ...prev]);
        }
      }),
      EventRegister.addEventListener('onForumPostDeleted', ({ forum_id }) => {
        setLocalPosts(prev => prev.filter(post => post.forum_id !== forum_id));
      }),
      EventRegister.addEventListener('onForumPostUpdated', async ({ updatedPost }) => {
        try {
          const postWithMedia = await fetchMediaForPost(updatedPost);
          setLocalPosts(prev =>
            prev.map(post => post.forum_id === postWithMedia.forum_id ? postWithMedia : post)
          );
        } catch (error) {
          setLocalPosts(prev =>
            prev.map(post => post.forum_id === updatedPost.forum_id ? updatedPost : post)
          );
        }
      }),
      EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
        setLocalPosts(prev =>
          prev.map(post => {
            if (post.forum_id === forum_id) {
              return {
                ...post,
                commentCount: Math.max((post.commentCount || 0) - 1, 0),
                comments_count: Math.max((post.comments_count || 0) - 1, 0),
              };
            }
            return post;
          })
        );
      }),
      EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
        setLocalPosts(prev =>
          prev.map(post => {
            if (post.forum_id === forum_id) {
              return {
                ...post,
                commentCount: (post.commentCount || 0) + 1,
                comments_count: (post.comments_count || 0) + 1,
              };
            }
            return post;
          })
        );
      })
    ];

    return () => {
      listeners.forEach(listener => EventRegister.removeEventListener(listener));
    };
  }, []);

  // Initial fetch and check for new posts
  useEffect(() => {
    if (isPageFocused) {
      fetchPosts();
      
      const interval = setInterval(() => {
        checkForNewPosts();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [isPageFocused]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke' }}>
      <View style={AppStyles.headerContainer}>
        <View style={AppStyles.searchContainer}>
          <View style={AppStyles.inputContainer}>
            <TextInput
              style={AppStyles.searchInput}
              placeholder="Search"
              ref={searchInputRef}
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={handleDebouncedTextChange}
            />
            {searchTriggered ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchTriggered(false);
                  setSearchResults([]);
                }}
                style={AppStyles.iconButton}
              >
                <Icon name="close-circle" size={20} color="gray" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={AppStyles.searchIconButton}>
                <Icon name="magnify" size={20} color="#075cab" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showPostButton && (
          <TouchableOpacity
            style={AppStyles.circle}
            onPress={() => {
              if (isConnected) {
                navigation.navigate("ForumPost");
              } else {
                showToast('No internet connection', 'error');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#075cab" />
            <Text style={AppStyles.shareText}>Post</Text>
          </TouchableOpacity>
        )}
      </View>

      {showNewPostAlert && (
        <TouchableOpacity 
          onPress={handleRefresh} 
          style={styles.newPostAlert}
        >
          <Text style={styles.newPostAlertText}>
            {newPostCount} new post{newPostCount > 1 ? 's' : ''} available — Tap to refresh
          </Text>
        </TouchableOpacity>
      )}

      {!loading ? (
        <FlatList
          data={!searchTriggered || searchQuery.trim() === '' ? localPosts : searchResults}
          renderItem={renderItem}
          ref={listRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={3}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={100}
          windowSize={7}
          removeClippedSubviews={true}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
            searchInputRef.current?.blur?.();
          }}
          keyExtractor={(item, index) => `${item.forum_id}-${index}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh} 
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: '10%' }}
          ListHeaderComponent={
            <>
              {searchTriggered && searchResults.length > 0 && (
                <Text style={styles.resultCount}>
                  {searchResults.length} results found
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            (searchTriggered && searchResults.length === 0) ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>No posts found</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#075cab" />
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={'#075cab'} size="large" />
        </View>
      )}

      <ReactionSheet ref={reactionSheetRef} />
    </SafeAreaView>
  );
};

const styles = {
  comments: {
    paddingHorizontal: 5,
    borderTopWidth: 0.5,
    borderColor: '#ccc',
    paddingVertical: 10,
    backgroundColor: 'white',
    minHeight: 120,
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
  image1: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 100,
    backgroundColor: '#eee'
  },
  textContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  authorName: {
    flex: 1, 
    alignSelf: 'flex-start', 
    color: 'black', 
    fontSize: 15, 
    fontWeight: '600'
  },
  metaContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 13,
    color: 'black',
    fontWeight: '300',
  },
  date: {
    fontSize: 13,
    color: 'black',
    fontWeight: '300',
  },
  contentContainer: {
    paddingHorizontal: 10,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginVertical: 5
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    marginVertical: 5
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10
  },
  reactionButton: {
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 15
  },
  reactionLabel: {
    fontSize: 12, 
    color: '#777', 
    marginLeft: 4
  },
  defaultReaction: {
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
  },
  reactText: {
    fontSize: 12, 
    color: '#777', 
    marginRight: 6
  },
  reactionOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  reactionPickerContainer: {
    position: 'absolute',
    top: -65,
    left: 0,
    zIndex: 1,
  },
  reactionPicker: {
    flexDirection: 'row',
    padding: 5,
    backgroundColor: '#fff',
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  reactionOption: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 8,
    justifyContent: 'center',
  },
  selectedReaction: {
    backgroundColor: '#e0f2f1'
  },
  reactionOptionEmoji: {
    fontSize: 20
  },
  reactionSummary: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  reactionCountButton: {
    paddingHorizontal: 8
  },
  reactionCount: {
    color: '#333', 
    fontSize: 12, 
    fontWeight: '500'
  },
  reactionIcons: {
    flexDirection: 'row'
  },
  reactionIcon: {
    marginLeft: -10,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionIconEmoji: {
    fontSize: 10
  },
  actionContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  actionText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#075cab',
    marginLeft: 1,
    marginRight: 3
  },
  newPostAlert: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: '#075cab',
    padding: 10,
    borderRadius: 10,
    zIndex: 10
  },
  newPostAlertText: {
    color: 'white'
  },
  resultCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  emptyResults: {
    alignItems: 'center',
    marginTop: 40
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666'
  },
  loadingMore: {
    paddingVertical: 20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
};

export default BaseForumComponent;
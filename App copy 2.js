
import { TabView, TabBar } from 'react-native-tab-view';
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
import { useConnection } from "../AppUtils/ConnectionProvider";
import AppStyles from "../../assets/AppStyles";
import { getSignedUrl, getTimeDisplay } from "../helperComponents.jsx/signedUrls";
import { openMediaViewer } from "../helperComponents.jsx/mediaViewer";
import { fetchForumReactionsBatch, fetchForumReactionsRaw } from "../helperComponents.jsx/ForumReactions";

import ReactionSheet from "../helperComponents.jsx/ReactionUserSheet";
import { ForumBody, generateHighlightedHTML } from "./forumBody";
import { fetchMediaForPost } from "../helperComponents.jsx/forumViewableItems";
import { fetchCommentCount, fetchCommentCounts } from "../AppUtils/CommentCount";

const initialLayout = { width: Dimensions.get('window').width };

const PageView = () => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'all', title: 'All' },
    { key: 'latest', title: 'Latest' },
    { key: 'trending', title: 'Trending' },
    { key: 'post', title: 'Post' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const isFocused = useIsFocused();

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'all': return <AllPosts />;
      case 'latest': return <LatestPosts />;
      case 'trending': return <TrendingPosts />;
      case 'post': return <CreatePost />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="gray"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="gray" />
            </TouchableOpacity>
          ) : (
            <Icon name="magnify" size={20} color="#075cab" />
          )}
        </View>
      </View>

      {/* Tab View */}
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={styles.indicator}
            style={styles.tabBar}
            labelStyle={styles.label}
            activeColor="#075cab"
            inactiveColor="#666"
          />
        )}
        lazy
      />
    </SafeAreaView>
  );
};

// All Posts Component
const AllPosts = ({ isPageFocused, scrollRef }) => {

  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  // const commentsCount = useSelector((state) => state.forum.commentsCount);

  // const storePosts = useSelector((state) => state.forum.posts);


  const dispatch = useDispatch();
  const videoRefs = useRef({});
  const navigation = useNavigation();
  const [localPosts, setLocalPosts] = useState([]);
console.log(localPosts[0])
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const isFocused = useIsFocused();
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchCount, setSearchCount] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(3);
  const [expandedTexts, setExpandedTexts] = useState({});
  const [searchResults, setSearchResults] = useState(false);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const searchInputRef = useRef(null);

  const listRef = useRef(null);

  useScrollToTop(listRef);

  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = {
        scrollToTop: () => {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        },
        handleRefresh: () => {
          // your refresh logic here
        },
      };
    }
  }, [scrollRef]);


  const withTimeout = (promise, timeout = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };

  const reactionSheetRef = useRef(null);
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);

  const reactionConfig = [
    { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
    { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
    { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
    { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
    { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
  ];

  const fetchLatestPosts = async (lastKey = null) => {
    if (!isConnected || loading || loadingMore) return;
  
    const startTime = Date.now();
    lastKey ? setLoadingMore(true) : setLoading(true);
  
    try {
      const requestData = {
        command: 'getAllForumPosts',
        type:'All',
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };
  
      const response = await withTimeout(
        apiClient.post('/getAllForumPosts', requestData),
        10000
      );
  
      const newPosts = response?.data?.response || [];
  
      if (!newPosts.length) {
        setHasMorePosts(false);
        return;
      }
  
      // Adjust fetchLimit based on response speed
      const responseTime = Date.now() - startTime;
      if (responseTime < 500) setFetchLimit(prev => Math.min(prev + 2, 10));
      else if (responseTime > 1200) setFetchLimit(prev => Math.max(prev - 1, 3));
  
      const sortedNewPosts = newPosts.sort((a, b) => b.posted_on - a.posted_on);
      const forumIds = sortedNewPosts.map(p => p.forum_id);
  
      const [postsWithMedia, reactionMap, commentCountsArray] = await Promise.all([
        fetchMediaForPost(sortedNewPosts),
        fetchForumReactionsBatch(forumIds, myId),
        Promise.all(forumIds.map(id => fetchCommentCount(id))), // ✅ updated
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
      console.error('[fetchLatestPosts] error:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  



  useEffect(() => {
    const listener = EventRegister.addEventListener('onForumPostCreated', async ({ newPost }) => {
      try {
        const postWithMedia = await fetchMediaForPost(newPost);
        setLocalPosts((prev) => [postWithMedia, ...prev]);
      } catch (error) {
        setLocalPosts((prev) => [newPost, ...prev]);
      }
    });

    const deleteListener = EventRegister.addEventListener('onForumPostDeleted', ({ forum_id }) => {
      setLocalPosts((prev) => prev.filter((post) => post.forum_id !== forum_id));
    });

    const updateListener = EventRegister.addEventListener('onForumPostUpdated', async ({ updatedPost }) => {
      try {
        const postWithMedia = await fetchMediaForPost(updatedPost);
        setLocalPosts((prev) =>
          prev.map((post) =>
            post.forum_id === postWithMedia.forum_id ? postWithMedia : post
          )
        );
      } catch (error) {
        setLocalPosts((prev) =>
          prev.map((post) =>
            post.forum_id === updatedPost.forum_id ? updatedPost : post
          )
        );
      }
    });

    // 🔻 Listener to DECREASE comment count on deletion
    const commentDeletedListener = EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
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
    });

    // 🔺 Listener to INCREASE comment count on comment added
    const commentAddedListener = EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
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
    });

    return () => {
      EventRegister.removeEventListener(listener);
      EventRegister.removeEventListener(deleteListener);
      EventRegister.removeEventListener(updateListener);
      EventRegister.removeEventListener(commentDeletedListener);
      EventRegister.removeEventListener(commentAddedListener);
    };
  }, []);

  useEffect(() => {
    if (isPageFocused && !hasFetchedPosts) {
      fetchLatestPosts();
      setHasFetchedPosts(true);
    }
  }, [isPageFocused, hasFetchedPosts]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMorePosts) return;
    fetchLatestPosts(lastEvaluatedKey);
  }, [loading, loadingMore, hasMorePosts, lastEvaluatedKey]);


  const viewedForumIdsRef = useRef(new Set());

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


  const activeVideoRef = useRef(null);
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);
  
  useEffect(() => {
    if (!isFocused || !isPageFocused) {
      setActiveVideo(null);
    }
  
    return () => {
      setActiveVideo(null);
    };
  }, [isFocused, isPageFocused]);
  
  




  const handleNavigate = (item) => {

    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 100);
  };


  const commentSectionRef = useRef();
  const bottomSheetRef = useRef(null);



  const openCommentSheet = (forum_id, user_id, myId) => {
    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          // onEditComment={handleEditComment}
          ref={commentSectionRef}
          closeBottomSheet={() => bottomSheetRef.current?.scrollTo(0)}

        />

        <InputAccessoryView backgroundColor="#f2f2f2">
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
        </InputAccessoryView>
      </View>,
      -screenHeight * 0.9
    );
  };

  const toggleFullText = (id) => {
    setExpandedTexts(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };


  const sharePost = async (item) => {
    try {
      const baseUrl = 'https://bmebharat.com/latest/comment/';
      const jobUrl = `${baseUrl}${item.forum_id}`;

      const result = await Share.share({
        message: jobUrl, // No extra space before URL
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {

        } else {

        }
      } else if (result.action === Share.dismissedAction) {

      }
    } catch (error) {

    }
  };


  const { height: screenHeight } = Dimensions.get('window');

  const renderItem = useCallback(({ item }) => {

    // console.log('Render', item.forum_id, item.totalReactions, item.userReaction);
    return (

      <View style={styles.comments}>
        <View style={styles.dpContainer}>
          <TouchableOpacity style={styles.dpContainer1} onPress={() => handleNavigate(item)}
            activeOpacity={0.8}>
            <FastImage
              source={item.authorImageUrl ? { uri: item.authorImageUrl } : null}
              style={styles.image1}
              onError={() => {
                // Optional error handling
              }}
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
            html={generateHighlightedHTML(item.forum_body, searchQuery)}
            forumId={item.forum_id}
            isExpanded={expandedTexts[item.forum_id]}
            toggleFullText={toggleFullText}
          />
        </View>
        {item.videoUrl ? (
          <TouchableOpacity activeOpacity={1} >
            <Video
              ref={(ref) => {
                if (ref) {
                  videoRefs.current[item.forum_id] = ref;
                } else {
                  delete videoRefs.current[item.forum_id];
                }
              }}
            
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
                marginVertical: 5
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
              controlTimeout={2000}

            />
          </TouchableOpacity>

        ) : (
          item.imageUrl && (
            <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])}
              activeOpacity={1} >
              <FastImage
                source={{
                  uri: item.imageUrl,
                  priority: FastImage.priority.high,
                  cache: FastImage.cacheControl.immutable
                }}
                style={{
                  width: '100%',
                  aspectRatio: item.aspectRatio || 1,
                  marginVertical: 5

                }}
                resizeMode={FastImage.resizeMode.contain}
              />
            </TouchableOpacity>

          )
        )}


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
          <View>
            <TouchableOpacity
              onLongPress={() => {

                setActiveReactionForumId(prev =>
                  prev === item.forum_id ? null : item.forum_id
                );
              }}
              activeOpacity={0.7}
              style={{
                padding: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              onPress={async () => {

                const post = localPosts.find(p => p.forum_id === item.forum_id);
                const currentReaction = post?.userReaction || 'None';

                // ⛳️ If there's any existing reaction, remove it
                const selectedType = currentReaction !== 'None' && currentReaction !== null
                  ? 'None'
                  : 'Like';

                setLocalPosts(prev =>
                  prev.map(p => {
                    if (p.forum_id !== item.forum_id) return p;

                    let newTotal = Number(p.totalReactions || 0);
                    let newReaction = selectedType;

                    const hadReaction = currentReaction && currentReaction !== 'None';

                    if (selectedType === 'None') {
                      if (hadReaction) newTotal -= 1;
                      newReaction = null;
                    } else if (!hadReaction) {
                      newTotal += 1;
                    }

                    return {
                      ...p,
                      userReaction: newReaction,
                      totalReactions: newTotal,
                    };
                  })
                );

                try {
                  await apiClient.post('/addOrUpdateForumReaction', {
                    command: 'addOrUpdateForumReaction',
                    forum_id: item.forum_id,
                    user_id: myId,
                    reaction_type: selectedType,
                  });

                } catch (err) {

                  setLocalPosts(prev =>
                    prev.map(p => {
                      if (p.forum_id !== item.forum_id) return p;
                      return {
                        ...p,
                        userReaction: currentReaction,
                        totalReactions: p.totalReactions,
                      };
                    })
                  );
                }
              }}

            >

              {item.userReaction && item.userReaction !== 'None' ? (
                <>
                  <Text style={{ fontSize: 15 }}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.emoji || '👍'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#777', marginLeft: 4 }}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.label || 'Like'}
                  </Text>
                </>
              ) : (
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', }}>
                  <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text>
                  <Icon name="thumb-up-outline" size={18} color="#999" />
                </View>
              )}
            </TouchableOpacity>


            {activeReactionForumId === item.forum_id && (
              <>
                {/* Overlay to catch outside taps */}
                <TouchableWithoutFeedback onPress={() => setActiveReactionForumId(null)}>
                  <View
                    style={{
                      position: 'absolute',
                      top: -1000,
                      left: -1000,
                      right: -1000,
                      bottom: -1000,
                      backgroundColor: 'transparent',
                      zIndex: 0,
                    }}
                  />
                </TouchableWithoutFeedback>

                <View
                  style={{
                    position: 'absolute',
                    top: -65,
                    left: 0,
                    zIndex: 1,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      padding: 5,
                      backgroundColor: '#fff',
                      borderRadius: 30,
                      elevation: 6,
                      shadowColor: '#000',
                      shadowOpacity: 0.1,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },

                    }}
                  >
                    {reactionConfig.map(({ type, emoji, label }) => {
                      const isSelected = item.userReaction === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          onPress={async () => {
                            const selectedType = item.userReaction === type ? 'None' : type;

                            try {
                              await apiClient.post('/addOrUpdateForumReaction', {
                                command: 'addOrUpdateForumReaction',
                                forum_id: item.forum_id,
                                user_id: myId,
                                reaction_type: selectedType,
                              });

                              setLocalPosts(prev =>
                                prev.map(p => {
                                  if (p.forum_id !== item.forum_id) return p;

                                  let newTotal = Number(p.totalReactions || 0);
                                  let newReaction = selectedType;

                                  const hadReaction = p.userReaction && p.userReaction !== 'None';

                                  if (selectedType === 'None') {
                                    if (hadReaction) newTotal -= 1;
                                    newReaction = null;
                                  } else if (!hadReaction) {
                                    newTotal += 1;
                                  } else if (p.userReaction !== selectedType) {
                                    newTotal = p.totalReactions;
                                  }

                                  return {
                                    ...p,
                                    userReaction: newReaction,
                                    totalReactions: newTotal,
                                  };
                                })
                              );
                            } catch (err) {
                              console.warn('Reaction update failed', err);
                            }

                            setActiveReactionForumId(null);
                          }}
                          style={{
                            backgroundColor: isSelected ? '#e0f2f1' : 'transparent',
                            alignItems: 'center',
                            borderRadius: 20,
                            padding: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{emoji}</Text>
                          {/* <Text style={{ fontSize: 8 }}>{label}</Text> */}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                reactionSheetRef.current?.open(item.forum_id, 'All');
              }}
              style={{ paddingHorizontal: 8 }}
            >
              {item.totalReactions > 0 && (
                <Text style={{ color: '#333', fontSize: 12, fontWeight: '500' }}>
                  ({item.totalReactions})
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row' }}>
              {reactionConfig.map(({ type, emoji }, index) => {
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      reactionSheetRef.current?.open(item.forum_id, 'All');
                    }}
                    activeOpacity={0.8}
                    style={{
                      marginLeft: index === 0 ? 0 : -10,
                      backgroundColor: '#fff',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#f0f0f0',
                      padding: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10 }}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>


        <View style={styles.iconContainer}>
          <View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openCommentSheet(item.forum_id, item.user_id, myId)}
            >
              <Icon name="comment-outline" size={17} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>
                Comments{item.commentCount > 0 ? ` ${item.commentCount}` : ''}
              </Text>
            </TouchableOpacity>

          </View>
          <View>
            <TouchableOpacity style={styles.iconButton}>
              <Icon name="eye-outline" size={20} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>Views {item.viewsCount || '0'}</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity style={styles.iconButton} onPress={() => sharePost(item)}>
              <Icon name="share-outline" size={21} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>


      </View>

    );
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId]);


  const lastCheckedTimeRef = useRef(Math.floor(Date.now() / 1000));
  const [lastCheckedTime, setLastCheckedTime] = useState(lastCheckedTimeRef.current);
  const [newJobCount, setNewJobCount] = useState(0);
  const [showNewJobAlert, setShowNewJobAlert] = useState(false);

  const updateLastCheckedTime = (time) => {
    lastCheckedTimeRef.current = time;
    setLastCheckedTime(time);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      checkForNewJobs();
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const checkForNewJobs = async () => {
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
        setNewJobCount(filteredCount);
        setShowNewJobAlert(true);
      } else {

        setShowNewJobAlert(false);
      }
    } catch (error) {

    }
  };




  const handleRefresh = useCallback(async () => {
    if (!isConnected) {

      return;
    }
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    setSearchQuery('');
    setSearchTriggered(false);
    setSearchResults([]);
    setSearchCount(0);

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setExpandedTexts(false);

    setLocalPosts([]);
    setHasMorePosts(true);
    setLastEvaluatedKey(null);
    setNewJobCount(0);
    setShowNewJobAlert(false);
    updateLastCheckedTime(Math.floor(Date.now() / 1000));

    dispatch(clearPosts());
    await fetchLatestPosts(null);

    setIsRefreshing(false);

    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [fetchLatestPosts, dispatch]);


  const debounceTimeout = useRef(null);

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


  const handleSearch = useCallback(async (text) => {
    if (!isConnected) {
      showToast('No internet connection', 'error');
      return;
    }

    setSearchQuery(text);

    const trimmedText = text.trim();

    if (trimmedText === '') {
      setSearchResults([]);
      return;
    }

    try {
      const requestData = {
        command: 'searchLatestForumPosts',
        searchQuery: trimmedText,
      };

      const res = await withTimeout(apiClient.post('/searchLatestForumPosts', requestData), 10000);
      const forumPosts = res.data.response || [];
      const count = res.data.count || forumPosts.length;

      const postsWithMedia = await Promise.all(
        forumPosts.map(post => fetchMediaForPost(post))
      );

      setSearchResults(postsWithMedia);
      setSearchCount(count);

    } catch (error) {
      // Optional: Log or show error
    } finally {
      setSearchTriggered(true);

    }
  }, [isConnected]);




  const onRender = (id, phase, actualDuration) => {
    // console.log(`[Profiler] ${id} - ${phase}`);
    // console.log(`Actual render duration: ${actualDuration}ms`);
  };
  

  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>

        <View style={AppStyles.headerContainer}>
          <View style={AppStyles.searchContainer}>
            <View style={AppStyles.inputContainer}>
              <TextInput
                style={[AppStyles.searchInput]}
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
                    setSearchCount(0);
                  }}
                  style={AppStyles.iconButton}
                >
                  <Icon name="close-circle" size={20} color="gray" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  // onPress={() => handleSearch(searchQuery)}
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

        {showNewJobAlert && (
          <TouchableOpacity onPress={handleRefresh} style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#075cab', padding: 10, borderRadius: 10, zIndex: 10 }}>
            <Text style={{ color: 'white' }}>{newJobCount} new post{newJobCount > 1 ? 's' : ''} available — Tap to refresh</Text>
          </TouchableOpacity>
        )}
        <View style={styles.container}>



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
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
              }

              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: '10%' }}
              ListHeaderComponent={
                <>
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


        </View>
        <ReactionSheet ref={reactionSheetRef} />

      </SafeAreaView>
    </Profiler>
  );
};

// Latest Posts Component
const LatestPosts = ({ isPageFocused, scrollRef }) => {

  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  // const commentsCount = useSelector((state) => state.forum.commentsCount);

  // const storePosts = useSelector((state) => state.forum.posts);


  const dispatch = useDispatch();
  const videoRefs = useRef({});
  const navigation = useNavigation();
  const [localPosts, setLocalPosts] = useState([]);
console.log(localPosts[0])
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const isFocused = useIsFocused();
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchCount, setSearchCount] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(3);
  const [expandedTexts, setExpandedTexts] = useState({});
  const [searchResults, setSearchResults] = useState(false);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const searchInputRef = useRef(null);

  const listRef = useRef(null);

  useScrollToTop(listRef);

  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = {
        scrollToTop: () => {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        },
        handleRefresh: () => {
          // your refresh logic here
        },
      };
    }
  }, [scrollRef]);


  const withTimeout = (promise, timeout = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };

  const reactionSheetRef = useRef(null);
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);

  const reactionConfig = [
    { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
    { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
    { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
    { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
    { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
  ];

  const fetchLatestPosts = async (lastKey = null) => {
    if (!isConnected || loading || loadingMore) return;
  
    const startTime = Date.now();
    lastKey ? setLoadingMore(true) : setLoading(true);
  
    try {
      const requestData = {
        command: 'getLatestPosts',
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };
  
      const response = await withTimeout(
        apiClient.post('/getLatestPosts', requestData),
        10000
      );
  
      const newPosts = response?.data?.response || [];
  
      if (!newPosts.length) {
        setHasMorePosts(false);
        return;
      }
  
      // Adjust fetchLimit based on response speed
      const responseTime = Date.now() - startTime;
      if (responseTime < 500) setFetchLimit(prev => Math.min(prev + 2, 10));
      else if (responseTime > 1200) setFetchLimit(prev => Math.max(prev - 1, 3));
  
      const sortedNewPosts = newPosts.sort((a, b) => b.posted_on - a.posted_on);
      const forumIds = sortedNewPosts.map(p => p.forum_id);
  
      const [postsWithMedia, reactionMap, commentCountsArray] = await Promise.all([
        fetchMediaForPost(sortedNewPosts),
        fetchForumReactionsBatch(forumIds, myId),
        Promise.all(forumIds.map(id => fetchCommentCount(id))), // ✅ updated
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
      console.error('[fetchLatestPosts] error:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  



  useEffect(() => {
    const listener = EventRegister.addEventListener('onForumPostCreated', async ({ newPost }) => {
      try {
        const postWithMedia = await fetchMediaForPost(newPost);
        setLocalPosts((prev) => [postWithMedia, ...prev]);
      } catch (error) {
        setLocalPosts((prev) => [newPost, ...prev]);
      }
    });

    const deleteListener = EventRegister.addEventListener('onForumPostDeleted', ({ forum_id }) => {
      setLocalPosts((prev) => prev.filter((post) => post.forum_id !== forum_id));
    });

    const updateListener = EventRegister.addEventListener('onForumPostUpdated', async ({ updatedPost }) => {
      try {
        const postWithMedia = await fetchMediaForPost(updatedPost);
        setLocalPosts((prev) =>
          prev.map((post) =>
            post.forum_id === postWithMedia.forum_id ? postWithMedia : post
          )
        );
      } catch (error) {
        setLocalPosts((prev) =>
          prev.map((post) =>
            post.forum_id === updatedPost.forum_id ? updatedPost : post
          )
        );
      }
    });

    // 🔻 Listener to DECREASE comment count on deletion
    const commentDeletedListener = EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
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
    });

    // 🔺 Listener to INCREASE comment count on comment added
    const commentAddedListener = EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
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
    });

    return () => {
      EventRegister.removeEventListener(listener);
      EventRegister.removeEventListener(deleteListener);
      EventRegister.removeEventListener(updateListener);
      EventRegister.removeEventListener(commentDeletedListener);
      EventRegister.removeEventListener(commentAddedListener);
    };
  }, []);

  useEffect(() => {
    if (isPageFocused && !hasFetchedPosts) {
      fetchLatestPosts();
      setHasFetchedPosts(true);
    }
  }, [isPageFocused, hasFetchedPosts]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMorePosts) return;
    fetchLatestPosts(lastEvaluatedKey);
  }, [loading, loadingMore, hasMorePosts, lastEvaluatedKey]);


  const viewedForumIdsRef = useRef(new Set());

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


  const activeVideoRef = useRef(null);
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);
  
  useEffect(() => {
    if (!isFocused || !isPageFocused) {
      setActiveVideo(null);
    }
  
    return () => {
      setActiveVideo(null);
    };
  }, [isFocused, isPageFocused]);
  
  




  const handleNavigate = (item) => {

    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 100);
  };


  const commentSectionRef = useRef();
  const bottomSheetRef = useRef(null);



  const openCommentSheet = (forum_id, user_id, myId) => {
    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          // onEditComment={handleEditComment}
          ref={commentSectionRef}
          closeBottomSheet={() => bottomSheetRef.current?.scrollTo(0)}

        />

        <InputAccessoryView backgroundColor="#f2f2f2">
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
        </InputAccessoryView>
      </View>,
      -screenHeight * 0.9
    );
  };

  const toggleFullText = (id) => {
    setExpandedTexts(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };


  const sharePost = async (item) => {
    try {
      const baseUrl = 'https://bmebharat.com/latest/comment/';
      const jobUrl = `${baseUrl}${item.forum_id}`;

      const result = await Share.share({
        message: jobUrl, // No extra space before URL
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {

        } else {

        }
      } else if (result.action === Share.dismissedAction) {

      }
    } catch (error) {

    }
  };


  const { height: screenHeight } = Dimensions.get('window');

  const renderItem = useCallback(({ item }) => {

    // console.log('Render', item.forum_id, item.totalReactions, item.userReaction);
    return (

      <View style={styles.comments}>
        <View style={styles.dpContainer}>
          <TouchableOpacity style={styles.dpContainer1} onPress={() => handleNavigate(item)}
            activeOpacity={0.8}>
            <FastImage
              source={item.authorImageUrl ? { uri: item.authorImageUrl } : null}
              style={styles.image1}
              onError={() => {
                // Optional error handling
              }}
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
            html={generateHighlightedHTML(item.forum_body, searchQuery)}
            forumId={item.forum_id}
            isExpanded={expandedTexts[item.forum_id]}
            toggleFullText={toggleFullText}
          />
        </View>
        {item.videoUrl ? (
          <TouchableOpacity activeOpacity={1} >
            <Video
              ref={(ref) => {
                if (ref) {
                  videoRefs.current[item.forum_id] = ref;
                } else {
                  delete videoRefs.current[item.forum_id];
                }
              }}
            
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
                marginVertical: 5
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
              controlTimeout={2000}

            />
          </TouchableOpacity>

        ) : (
          item.imageUrl && (
            <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])}
              activeOpacity={1} >
              <FastImage
                source={{
                  uri: item.imageUrl,
                  priority: FastImage.priority.high,
                  cache: FastImage.cacheControl.immutable
                }}
                style={{
                  width: '100%',
                  aspectRatio: item.aspectRatio || 1,
                  marginVertical: 5

                }}
                resizeMode={FastImage.resizeMode.contain}
              />
            </TouchableOpacity>

          )
        )}


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
          <View>
            <TouchableOpacity
              onLongPress={() => {

                setActiveReactionForumId(prev =>
                  prev === item.forum_id ? null : item.forum_id
                );
              }}
              activeOpacity={0.7}
              style={{
                padding: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              onPress={async () => {

                const post = localPosts.find(p => p.forum_id === item.forum_id);
                const currentReaction = post?.userReaction || 'None';

                // ⛳️ If there's any existing reaction, remove it
                const selectedType = currentReaction !== 'None' && currentReaction !== null
                  ? 'None'
                  : 'Like';

                setLocalPosts(prev =>
                  prev.map(p => {
                    if (p.forum_id !== item.forum_id) return p;

                    let newTotal = Number(p.totalReactions || 0);
                    let newReaction = selectedType;

                    const hadReaction = currentReaction && currentReaction !== 'None';

                    if (selectedType === 'None') {
                      if (hadReaction) newTotal -= 1;
                      newReaction = null;
                    } else if (!hadReaction) {
                      newTotal += 1;
                    }

                    return {
                      ...p,
                      userReaction: newReaction,
                      totalReactions: newTotal,
                    };
                  })
                );

                try {
                  await apiClient.post('/addOrUpdateForumReaction', {
                    command: 'addOrUpdateForumReaction',
                    forum_id: item.forum_id,
                    user_id: myId,
                    reaction_type: selectedType,
                  });

                } catch (err) {

                  setLocalPosts(prev =>
                    prev.map(p => {
                      if (p.forum_id !== item.forum_id) return p;
                      return {
                        ...p,
                        userReaction: currentReaction,
                        totalReactions: p.totalReactions,
                      };
                    })
                  );
                }
              }}

            >

              {item.userReaction && item.userReaction !== 'None' ? (
                <>
                  <Text style={{ fontSize: 15 }}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.emoji || '👍'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#777', marginLeft: 4 }}>
                    {reactionConfig.find(r => r.type === item.userReaction)?.label || 'Like'}
                  </Text>
                </>
              ) : (
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', }}>
                  <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text>
                  <Icon name="thumb-up-outline" size={18} color="#999" />
                </View>
              )}
            </TouchableOpacity>


            {activeReactionForumId === item.forum_id && (
              <>
                {/* Overlay to catch outside taps */}
                <TouchableWithoutFeedback onPress={() => setActiveReactionForumId(null)}>
                  <View
                    style={{
                      position: 'absolute',
                      top: -1000,
                      left: -1000,
                      right: -1000,
                      bottom: -1000,
                      backgroundColor: 'transparent',
                      zIndex: 0,
                    }}
                  />
                </TouchableWithoutFeedback>

                <View
                  style={{
                    position: 'absolute',
                    top: -65,
                    left: 0,
                    zIndex: 1,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      padding: 5,
                      backgroundColor: '#fff',
                      borderRadius: 30,
                      elevation: 6,
                      shadowColor: '#000',
                      shadowOpacity: 0.1,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },

                    }}
                  >
                    {reactionConfig.map(({ type, emoji, label }) => {
                      const isSelected = item.userReaction === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          onPress={async () => {
                            const selectedType = item.userReaction === type ? 'None' : type;

                            try {
                              await apiClient.post('/addOrUpdateForumReaction', {
                                command: 'addOrUpdateForumReaction',
                                forum_id: item.forum_id,
                                user_id: myId,
                                reaction_type: selectedType,
                              });

                              setLocalPosts(prev =>
                                prev.map(p => {
                                  if (p.forum_id !== item.forum_id) return p;

                                  let newTotal = Number(p.totalReactions || 0);
                                  let newReaction = selectedType;

                                  const hadReaction = p.userReaction && p.userReaction !== 'None';

                                  if (selectedType === 'None') {
                                    if (hadReaction) newTotal -= 1;
                                    newReaction = null;
                                  } else if (!hadReaction) {
                                    newTotal += 1;
                                  } else if (p.userReaction !== selectedType) {
                                    newTotal = p.totalReactions;
                                  }

                                  return {
                                    ...p,
                                    userReaction: newReaction,
                                    totalReactions: newTotal,
                                  };
                                })
                              );
                            } catch (err) {
                              console.warn('Reaction update failed', err);
                            }

                            setActiveReactionForumId(null);
                          }}
                          style={{
                            backgroundColor: isSelected ? '#e0f2f1' : 'transparent',
                            alignItems: 'center',
                            borderRadius: 20,
                            padding: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{emoji}</Text>
                          {/* <Text style={{ fontSize: 8 }}>{label}</Text> */}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                reactionSheetRef.current?.open(item.forum_id, 'All');
              }}
              style={{ paddingHorizontal: 8 }}
            >
              {item.totalReactions > 0 && (
                <Text style={{ color: '#333', fontSize: 12, fontWeight: '500' }}>
                  ({item.totalReactions})
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row' }}>
              {reactionConfig.map(({ type, emoji }, index) => {
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      reactionSheetRef.current?.open(item.forum_id, 'All');
                    }}
                    activeOpacity={0.8}
                    style={{
                      marginLeft: index === 0 ? 0 : -10,
                      backgroundColor: '#fff',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#f0f0f0',
                      padding: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10 }}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>


        <View style={styles.iconContainer}>
          <View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openCommentSheet(item.forum_id, item.user_id, myId)}
            >
              <Icon name="comment-outline" size={17} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>
                Comments{item.commentCount > 0 ? ` ${item.commentCount}` : ''}
              </Text>
            </TouchableOpacity>

          </View>
          <View>
            <TouchableOpacity style={styles.iconButton}>
              <Icon name="eye-outline" size={20} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>Views {item.viewsCount || '0'}</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity style={styles.iconButton} onPress={() => sharePost(item)}>
              <Icon name="share-outline" size={21} color="#075cab" />
              <Text style={styles.iconTextUnderlined}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>


      </View>

    );
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId]);


  const lastCheckedTimeRef = useRef(Math.floor(Date.now() / 1000));
  const [lastCheckedTime, setLastCheckedTime] = useState(lastCheckedTimeRef.current);
  const [newJobCount, setNewJobCount] = useState(0);
  const [showNewJobAlert, setShowNewJobAlert] = useState(false);

  const updateLastCheckedTime = (time) => {
    lastCheckedTimeRef.current = time;
    setLastCheckedTime(time);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      checkForNewJobs();
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const checkForNewJobs = async () => {
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
        setNewJobCount(filteredCount);
        setShowNewJobAlert(true);
      } else {

        setShowNewJobAlert(false);
      }
    } catch (error) {

    }
  };




  const handleRefresh = useCallback(async () => {
    if (!isConnected) {

      return;
    }
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    setSearchQuery('');
    setSearchTriggered(false);
    setSearchResults([]);
    setSearchCount(0);

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setExpandedTexts(false);

    setLocalPosts([]);
    setHasMorePosts(true);
    setLastEvaluatedKey(null);
    setNewJobCount(0);
    setShowNewJobAlert(false);
    updateLastCheckedTime(Math.floor(Date.now() / 1000));

    dispatch(clearPosts());
    await fetchLatestPosts(null);

    setIsRefreshing(false);

    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [fetchLatestPosts, dispatch]);


  const debounceTimeout = useRef(null);

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


  const handleSearch = useCallback(async (text) => {
    if (!isConnected) {
      showToast('No internet connection', 'error');
      return;
    }

    setSearchQuery(text);

    const trimmedText = text.trim();

    if (trimmedText === '') {
      setSearchResults([]);
      return;
    }

    try {
      const requestData = {
        command: 'searchLatestForumPosts',
        searchQuery: trimmedText,
      };

      const res = await withTimeout(apiClient.post('/searchLatestForumPosts', requestData), 10000);
      const forumPosts = res.data.response || [];
      const count = res.data.count || forumPosts.length;

      const postsWithMedia = await Promise.all(
        forumPosts.map(post => fetchMediaForPost(post))
      );

      setSearchResults(postsWithMedia);
      setSearchCount(count);

    } catch (error) {
      // Optional: Log or show error
    } finally {
      setSearchTriggered(true);

    }
  }, [isConnected]);




  const onRender = (id, phase, actualDuration) => {
    // console.log(`[Profiler] ${id} - ${phase}`);
    // console.log(`Actual render duration: ${actualDuration}ms`);
  };
  

  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>

        <View style={AppStyles.headerContainer}>
          <View style={AppStyles.searchContainer}>
            <View style={AppStyles.inputContainer}>
              <TextInput
                style={[AppStyles.searchInput]}
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
                    setSearchCount(0);
                  }}
                  style={AppStyles.iconButton}
                >
                  <Icon name="close-circle" size={20} color="gray" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  // onPress={() => handleSearch(searchQuery)}
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

        {showNewJobAlert && (
          <TouchableOpacity onPress={handleRefresh} style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#075cab', padding: 10, borderRadius: 10, zIndex: 10 }}>
            <Text style={{ color: 'white' }}>{newJobCount} new post{newJobCount > 1 ? 's' : ''} available — Tap to refresh</Text>
          </TouchableOpacity>
        )}
        <View style={styles.container}>



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
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
              }

              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: '10%' }}
              ListHeaderComponent={
                <>
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


        </View>
        <ReactionSheet ref={reactionSheetRef} />

      </SafeAreaView>
    </Profiler>
  );
};

// Trending Posts Component
const TrendingPosts = ({ isPageFocused, scrollRef }) => {
  const dispatch = useDispatch();
  const { openSheet, closeSheet } = useBottomSheet();

  const commentsCount = useSelector((state) => state.forum.commentsCount);

  const { myId } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);





  const videoRefs = useRef({});
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);
  const isFocused = useIsFocused();
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchCount, setSearchCount] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(3);
  const [expandedTexts, setExpandedTexts] = useState({});
  const [searchResults, setSearchResults] = useState(false);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchInputRef = useRef(null);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [count, setCount] = useState()

  const listRef = useRef(null);

  useScrollToTop(listRef);

  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = {
        scrollTo: (options) => listRef.current?.scrollTo?.(options),
        handleRefresh: () => handleRefresh(),
      };
    }
  }, [scrollRef]);

  useEffect(() => {
    // 🔻 Listener to DECREASE comment count on deletion
    const commentDeletedListener = EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
      setPosts(prev =>
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
    });

    // 🔺 Listener to INCREASE comment count on comment added
    const commentAddedListener = EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
      setPosts(prev =>
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
    });

    return () => {
      EventRegister.removeEventListener(commentDeletedListener);
      EventRegister.removeEventListener(commentAddedListener);
    };
  }, []);


  const withTimeout = (promise, timeout = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };


  const reactionSheetRef = useRef(null);
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);


  const reactionConfig = [
    { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
    { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
    { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
    { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
    { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
  ];

  const fetchTrendingPosts = async (lastKey = null) => {
    if (!isConnected) return;
    if (loading || loadingMore) return;

    const startTime = Date.now();
    lastKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command: "getAllTrendingPosts",
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };
      const response = await withTimeout(apiClient.post('/getAllTrendingPosts', requestData), 10000);

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

      const sortedNewPosts = newPosts.sort((a, b) => b.posted_on - a.posted_on);

      const postsWithExtras = await Promise.all(
        sortedNewPosts.map(async (post) => {
          const postWithMedia = await fetchMediaForPost(post);
          const commentCount = await fetchCommentCount(post.forum_id);
          const { reactionsCount, totalReactions, userReaction } = await fetchForumReactionsRaw(post.forum_id, myId);

          return {
            ...postWithMedia,
            commentCount,
            reactionsCount,
            totalReactions,
            userReaction,
          };
        })
      );

      setPosts(prevPosts => {
        const uniquePosts = [...prevPosts, ...postsWithExtras].filter(
          (post, index, self) =>
            index === self.findIndex(p => p.forum_id === post.forum_id)
        );
        return uniquePosts;
      });

      setHasMorePosts(!!response.data.lastEvaluatedKey);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);
    } catch (error) {

    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };



  useEffect(() => {
    if (isPageFocused && !hasFetchedPosts) {
      fetchTrendingPosts();
      setHasFetchedPosts(true);
    }
  }, [isPageFocused, hasFetchedPosts]);

  const viewedForumIdsRef = useRef(new Set());

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

    // 🔁 Increment view count for newly viewed forum posts
    viewableItems.forEach(({ item }) => {
      const forumId = item.forum_id;
      if (forumId && !viewedForumIdsRef.current.has(forumId)) {
        viewedForumIdsRef.current.add(forumId);
        incrementViewCount(forumId);
      }
    });
  }).current;

  useEffect(() => {
    if (!isFocused || !isPageFocused) {
      setActiveVideo(null);
    }
  }, [isFocused, isPageFocused]);

  const [authorImageUrls, setAuthorImageUrls] = useState({});


  const handleNavigate = (item) => {

    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 300);
  };


  const commentSectionRef = useRef();
  const bottomSheetRef = useRef(null);

  const openCommentSheet = (forum_id,) => {
    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          // onEditComment={handleEditComment}
          ref={commentSectionRef}
          closeBottomSheet={() => bottomSheetRef.current?.scrollTo(0)}

        />

        <InputAccessoryView backgroundColor="#f2f2f2">
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
        </InputAccessoryView>
      </View>,
      -screenHeight * 0.9
    );
  };




  const toggleFullText = (itemId) => {
    setExpandedTexts((prev) => ({
      ...prev,
      [itemId]: !prev[itemId], // Toggle the specific item's expanded state
    }));
  };

  const getText1 = (text, itemId) => {
    if (expandedTexts[itemId] || text.length <= 200) {
      return text;
    }
    return text.slice(0, 200) + ' ...';
  };

  const handleUrlPress = (url) => {
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }

    Linking.openURL(url)
      .catch((err) => {

        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Failed to open the link',
          text2: 'Please try again later.',
        });
      });
  };

  const sharePost = async (item) => {
    try {
      const baseUrl = 'https://bmebharat.com/latest/comment/';
      const jobUrl = `${baseUrl}${item.forum_id}`;

      const result = await Share.share({
        message: jobUrl,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {

        } else {

        }
      } else if (result.action === Share.dismissedAction) {

      }
    } catch (error) {

    }
  };
    const activeVideoRef = useRef(null);
  
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);
  
 useEffect(() => {
     if (!isFocused || !isPageFocused) {
       setActiveVideo(null);
     }
   
     return () => {
       setActiveVideo(null);
     };
   }, [isFocused, isPageFocused]);
  

  const { height: screenHeight } = Dimensions.get('window');

  const renderItem = useCallback(({ item }) => {

    return (
      <TouchableOpacity activeOpacity={1}>
        <View style={styles.comments}>
          <View style={styles.dpContainer}>
            <View style={styles.dpContainer1}>
              <FastImage
                source={
                  item.author_fileKey
                    ? { uri: authorImageUrls[item.forum_id] || item.authorImageUrl }
                    : item.user_type === 'company'
                      ? companyImage
                      : item.author_gender === 'Male' ||
                        item.author_gender === 'Others'
                        ? maleImage
                        : femaleImage
                }

                style={styles.image1}
                onError={() => {
                  setAuthorImageUrls((prev) => ({
                    ...prev,
                    [item.forum_id]: null, // Ensure fallback is applied when error occurs
                  }));
                }}
              />
            </View>


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
              html={generateHighlightedHTML(item.forum_body || '', searchQuery)}
              forumId={item.forum_id}
              isExpanded={expandedTexts[item.forum_id]}
              toggleFullText={toggleFullText}
            />
          </View>
          {item.videoUrl ? (
            <TouchableOpacity activeOpacity={1} >
              <Video
              ref={(ref) => {
                if (ref) {
                  videoRefs.current[item.forum_id] = ref;
                } else {
                  // Clean up ref when unmounted
                  delete videoRefs.current[item.forum_id];
                }
              }}
            
                source={{ uri: item.videoUrl }}
                style={{
                  width: '100%',
                  aspectRatio: item.aspectRatio || 16 / 9,
                  marginVertical: 5
                }}
                controls
                paused={activeVideo !== item.forum_id}
                resizeMode="contain"
                poster={item.thumbnailUrl}
                repeat
                posterResizeMode="cover"
                controlTimeout={2000}

              />
            </TouchableOpacity>

          ) : (
            item.imageUrl && (
              <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])} activeOpacity={1} >
                <FastImage
                  source={{ uri: item.imageUrl }}
                  style={{
                    width: '100%',
                    aspectRatio: item.aspectRatio || 1,
                    marginVertical: 5

                  }}
                />
              </TouchableOpacity>

            )
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
            <View>
              <TouchableOpacity
                onLongPress={() => {
                  console.log('🟡 Long press detected → showing emoji picker');
                  setActiveReactionForumId(prev =>
                    prev === item.forum_id ? null : item.forum_id
                  );
                }}
                activeOpacity={0.7}
                style={{
                  padding: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={async () => {
                  console.log('🟢 onPress triggered → toggle reaction');

                  const post = posts.find(p => p.forum_id === item.forum_id);
                  const currentReaction = post?.userReaction || 'None';

                  // ⛳️ If there's any existing reaction, remove it
                  const selectedType = currentReaction !== 'None' && currentReaction !== null
                    ? 'None'
                    : 'Like';

                  setPosts(prev =>
                    prev.map(p => {
                      if (p.forum_id !== item.forum_id) return p;

                      let newTotal = Number(p.totalReactions || 0);
                      let newReaction = selectedType;

                      const hadReaction = currentReaction && currentReaction !== 'None';

                      if (selectedType === 'None') {
                        if (hadReaction) newTotal -= 1;
                        newReaction = null;
                      } else if (!hadReaction) {
                        newTotal += 1;
                      }

                      console.log('🔄 Updating local post:', {
                        forum_id: p.forum_id,
                        newReaction,
                        newTotal,
                      });

                      return {
                        ...p,
                        userReaction: newReaction,
                        totalReactions: newTotal,
                      };
                    })
                  );

                  try {
                    await apiClient.post('/addOrUpdateForumReaction', {
                      command: 'addOrUpdateForumReaction',
                      forum_id: item.forum_id,
                      user_id: myId,
                      reaction_type: selectedType,
                    });
                    console.log('✅ Reaction API success');
                  } catch (err) {
                    console.warn('❌ Reaction update failed, reverting...', err);
                    setPosts(prev =>
                      prev.map(p => {
                        if (p.forum_id !== item.forum_id) return p;
                        return {
                          ...p,
                          userReaction: currentReaction,
                          totalReactions: p.totalReactions,
                        };
                      })
                    );
                  }
                }}

              >

                {item.userReaction && item.userReaction !== 'None' ? (
                  <>
                    <Text style={{ fontSize: 15 }}>
                      {reactionConfig.find(r => r.type === item.userReaction)?.emoji || '👍'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#777', marginLeft: 4 }}>
                      {reactionConfig.find(r => r.type === item.userReaction)?.label || 'Like'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text>
                    <Icon name="thumb-up-outline" size={18} color="#999" />
                  </>
                )}
              </TouchableOpacity>


              {activeReactionForumId === item.forum_id && (
                <>
                  {/* Overlay to catch outside taps */}
                  <TouchableWithoutFeedback onPress={() => setActiveReactionForumId(null)}>
                    <View
                      style={{
                        position: 'absolute',
                        top: -1000,
                        left: -1000,
                        right: -1000,
                        bottom: -1000,
                        backgroundColor: 'transparent',
                        zIndex: 0,
                      }}
                    />
                  </TouchableWithoutFeedback>

                  <View
                    style={{
                      position: 'absolute',
                      top: -65,
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        padding: 5,
                        backgroundColor: '#fff',
                        borderRadius: 30,
                        elevation: 6,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },

                      }}
                    >
                      {reactionConfig.map(({ type, emoji, label }) => {
                        const isSelected = item.userReaction === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            onPress={async () => {
                              const selectedType = item.userReaction === type ? 'None' : type;

                              console.log('Updating reaction:', {
                                forumId: item.forum_id,
                                userId: myId,
                                selectedType,
                              });

                              try {
                                await apiClient.post('/addOrUpdateForumReaction', {
                                  command: 'addOrUpdateForumReaction',
                                  forum_id: item.forum_id,
                                  user_id: myId,
                                  reaction_type: selectedType,
                                });

                                setPosts(prev =>
                                  prev.map(p => {
                                    if (p.forum_id !== item.forum_id) return p;

                                    let newTotal = Number(p.totalReactions || 0);
                                    let newReaction = selectedType;

                                    const hadReaction = p.userReaction && p.userReaction !== 'None';

                                    if (selectedType === 'None') {
                                      if (hadReaction) newTotal -= 1;
                                      newReaction = null;
                                    } else if (!hadReaction) {
                                      newTotal += 1;
                                    } else if (p.userReaction !== selectedType) {
                                      newTotal = p.totalReactions;
                                    }

                                    return {
                                      ...p,
                                      userReaction: newReaction,
                                      totalReactions: newTotal,
                                    };
                                  })
                                );
                              } catch (err) {
                                console.warn('Reaction update failed', err);
                              }

                              setActiveReactionForumId(null);
                            }}
                            style={{
                              backgroundColor: isSelected ? '#e0f2f1' : 'transparent',
                              alignItems: 'center',
                              borderRadius: 20,
                              padding: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 20 }}>{emoji}</Text>
                            {/* <Text style={{ fontSize: 8 }}>{label}</Text> */}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  reactionSheetRef.current?.open(item.forum_id, 'All');
                }}
                style={{ paddingHorizontal: 8 }}
              >
                {item.totalReactions > 0 && (
                  <Text style={{ color: '#333', fontSize: 12, fontWeight: '500' }}>
                    ({item.totalReactions})
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row' }}>
                {reactionConfig.map(({ type, emoji }, index) => {
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        reactionSheetRef.current?.open(item.forum_id, 'All');
                      }}
                      activeOpacity={0.8}
                      style={{
                        marginLeft: index === 0 ? 0 : -10,
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: '#f0f0f0',
                        padding: 4,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.iconContainer}>
            <View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => openCommentSheet(item.forum_id, item.user_id, myId)}
              >
                <Icon name="comment-outline" size={17} color="#075cab" />
                <Text style={styles.iconTextUnderlined}>
                  Comments{item.commentCount > 0 ? ` ${item.commentCount}` : ''}
                </Text>
              </TouchableOpacity>

            </View>
            <View>
              <TouchableOpacity style={styles.iconButton}>
                <Icon name="eye-outline" size={20} color="#075cab" />
                <Text style={styles.iconTextUnderlined}>Views {item.viewsCount || '0'}</Text>
              </TouchableOpacity>
            </View>
            <View>
              <TouchableOpacity style={styles.iconButton} onPress={() => sharePost(item)}>
                <Icon name="share-outline" size={21} color="#075cab" />
                <Text style={styles.iconTextUnderlined}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>


        </View>
      </TouchableOpacity>
    );
  }, [posts, activeVideo, expandedTexts, activeReactionForumId]);


  const handleEndReached = useCallback(() => {

    if (loading || loadingMore || !hasMorePosts) return;

    fetchTrendingPosts(lastEvaluatedKey);
  }, [loading, loadingMore, hasMorePosts, lastEvaluatedKey]);

  const handleRefresh = useCallback(async () => {

    if (!isConnected) {

      return;
    }
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    setSearchQuery('');
    setSearchTriggered(false);
    setSearchResults([]);
    setSearchCount(0);

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setExpandedTexts(false);
    setPosts([]);
    setHasMorePosts(true);
    setLastEvaluatedKey(null);

    try {

      await fetchTrendingPosts(null);
    } catch (error) {

    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        isRefreshingRef.current = false;
      }, 300);
    }
  }, [fetchTrendingPosts, dispatch]);


  const debounceTimeout = useRef(null);


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

  const handleSearch = useCallback(async (text) => {
    if (!isConnected) {
      showToast('No internet connection', 'error');
      return;
    }

    setSearchQuery(text);

    const trimmedText = text.trim();

    if (trimmedText === '') {
      setSearchResults([]);
      return;
    }

    try {
      const requestData = {
        command: 'searchTrendingForumPosts',
        searchQuery: trimmedText,
      };

      const res = await withTimeout(apiClient.post('/searchTrendingForumPosts', requestData), 10000);
      const forumPosts = res.data.response || [];
      const count = res.data.count || forumPosts.length;

      const postsWithMedia = await Promise.all(
        forumPosts.map(post => fetchMediaForPost(post))
      );

      setSearchResults(postsWithMedia);
      setSearchCount(count);

    } catch (error) {

    } finally {
      setSearchTriggered(true);

    }
  }, [isConnected]);

  const onRender = (id, phase, actualDuration) => {

  };

  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>
        <View style={AppStyles.headerContainer}>
          <View style={AppStyles.searchContainer}>
            <View style={AppStyles.inputContainer}>
              <TextInput
                style={[AppStyles.searchInput]}
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
                    setSearchCount(0);
                  }}
                  style={AppStyles.iconButton}
                >
                  <Icon name="close-circle" size={20} color="gray" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  // onPress={() => handleSearch(searchQuery)}
                  style={AppStyles.searchIconButton}
                >
                  <Icon name="magnify" size={20} color="#075cab" />
                </TouchableOpacity>
              )}

            </View>

          </View>

        </View>

        <View style={{ flex: 1, backgroundColor: 'whitesmoke', }}>


          {!loading ? (
            <FlatList
              data={!searchTriggered || searchQuery.trim() === '' ? posts : searchResults}
              renderItem={renderItem}
              ref={listRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => {
                Keyboard.dismiss();
                searchInputRef.current?.blur?.();

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

              ListHeaderComponent={
                <>
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

        </View>
        <ReactionSheet ref={reactionSheetRef} />

      </SafeAreaView>
    </Profiler>
  );
};

// Create Post Component
const CreatePost = () => {
  return (
    <View style={styles.createPostContainer}>
      <Text>Create Post Screen</Text>
    </View>
  );
};

// Post Item Component
const PostItem = ({ post }) => {
  return (
    <View style={styles.postContainer}>
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postContent}>{post.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: 'black',
    marginRight: 10,
  },
  tabBar: {
    backgroundColor: 'white',
  },
  indicator: {
    backgroundColor: '#075cab',
    height: 3,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  feedContainer: {
    flex: 1,
    backgroundColor: 'whitesmoke',
  },
  postContainer: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
  },
  createPostContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    paddingHorizontal: 15,
    paddingVertical: 5,
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
    backgroundColor: '#eee'
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

export default PageView;
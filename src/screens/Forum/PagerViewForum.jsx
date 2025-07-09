
import { TabView, TabBar } from 'react-native-tab-view';
import React, { useState, useEffect, useCallback, useRef, Profiler, useMemo } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, textInputRef, TextInput, Dimensions, Modal, StyleSheet, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, SafeAreaView, ActivityIndicator, Linking, Share, Button, RefreshControl, Animated, PanResponder, ScrollView, Platform, InputAccessoryView } from "react-native";
import Video from "react-native-video";
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import { useIsFocused } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from "react-native-fast-image";
import apiClient from "../ApiClient";
import { useDispatch, useSelector } from "react-redux";
import { clearPosts, setCommentsCount, updateOrAddPosts } from "../Redux/Forum_Actions";
import { useNetwork } from "../AppUtils/IdProvider";
import { showToast } from "../AppUtils/CustomToast";
import CommentsSection from "../AppUtils/Comments";
import { useBottomSheet } from "../AppUtils/SheetProvider";
import CommentInputBar from "../AppUtils/InputBar";
import { EventRegister } from "react-native-event-listeners";
import { useConnection } from "../AppUtils/ConnectionProvider";
import AppStyles from "../../assets/AppStyles";
import { getSignedUrl, getTimeDisplay, getTimeDisplayForum } from "../helperComponents.jsx/signedUrls";
import { openMediaViewer } from "../helperComponents.jsx/mediaViewer";
import { fetchForumReactionsBatch, fetchForumReactionsRaw } from "../helperComponents.jsx/ForumReactions";

import ReactionSheet from "../helperComponents.jsx/ReactionUserSheet";
import { ForumBody, generateHighlightedHTML, normalizeHtml } from "./forumBody";
import { fetchMediaForPost } from "../helperComponents.jsx/forumViewableItems";
import { fetchCommentCount, fetchCommentCounts } from "../AppUtils/CommentCount";

const JobListScreen = React.lazy(() => import('../Job/JobListScreen'));
const ProductsList = React.lazy(() => import('../Products/ProductsList'));
const CompanySettingScreen = React.lazy(() => import('../Profile/CompanySettingScreen'));
const CompanyHomeScreen = React.lazy(() => import('../CompanyHomeScreen'));


const initialLayout = { width: Dimensions.get('window').width  };

const PageView = () => {
  const navigation = useNavigation();

  const tabConfig = [
    { name: "Home", component: CompanyHomeScreen, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
    { name: "Jobs", component: JobListScreen, focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline', iconComponent: Icon },
    { name: "Feed", component: PageView, focusedIcon: 'rss', unfocusedIcon: 'rss-box', iconComponent: Icon },
    { name: "Products", component: ProductsList, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
    { name: "Settings", component: CompanySettingScreen, focusedIcon: 'cog', unfocusedIcon: 'cog-outline', iconComponent: Icon },
  ];

  const parentNavigation = navigation.getParent();
  const currentRouteName = parentNavigation?.getState()?.routes[parentNavigation.getState().index]?.name;

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'all', title: 'All' },
    { key: 'latest', title: 'Latest' },
    { key: 'trending', title: 'Trending' },
    // { key: 'post', title: 'Post' },
  ]);

  // Create refs to track video components in each tab
  const tabVideoRefs = useRef({
    all: {},
    latest: {},
    trending: {},
    post: {}
  });

  useEffect(() => {
    const listener = EventRegister.addEventListener('onForumPostCreated', ({ newPost, profile }) => {
      console.log("New forum post created:", newPost);
  
      // Switch to "All" tab
      setIndex(0);
  
      // Pause any videos in the current tab (before switching)
      pauseVideosInTab(routes[index].key);
  
      // Optionally: trigger refresh logic inside AllPosts via ref/event/state if needed
    });
  
    return () => {
      EventRegister.removeEventListener(listener);
    };
  }, [index, routes]);
  
  
  // Function to pause all videos in a specific tab
  const pauseVideosInTab = (tabKey) => {
    Object.values(tabVideoRefs.current[tabKey] || {}).forEach(videoRef => {
      if (videoRef && typeof videoRef.setNativeProps === 'function') {
        videoRef.setNativeProps({ paused: true });
      }
    });
  };

  const handleTabChange = (newIndex) => {
    // Pause videos in the previous tab before switching
    const prevTabKey = routes[index].key;
    pauseVideosInTab(prevTabKey);

    // Update the tab index
    setIndex(newIndex);
  };

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'all':
        return <AllPosts
          videoRefs={tabVideoRefs.current.all}
          isTabActive={index === 0}
        />;
      case 'latest':
        return <LatestPosts
          videoRefs={tabVideoRefs.current.latest}
          isTabActive={index === 1}
        />;
      case 'trending':
        return <TrendingPosts
          videoRefs={tabVideoRefs.current.trending}
          isTabActive={index === 2}
        />;
      // case 'post':
      //   return <ForumPostScreenCopy
      //     videoRefs={tabVideoRefs.current.post}
      //     isTabActive={index === 3}
      //   />;
      default: return null;
    }
  };


  useEffect(() => {
    const listener = EventRegister.addEventListener('navigateToAllTab', () => {
      // Set the tab index to 0 (All tab)
      setIndex(0);
      // Pause any videos in other tabs
      pauseVideosInTab(routes[index].key);
    });

    return () => {
      EventRegister.removeEventListener(listener);
    };
  }, [index, routes]);


  return (
    <SafeAreaView style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleTabChange}
        initialLayout={initialLayout}
        renderTabBar={props => (
          <View style={styles.tabBarContainer}>
            <View style={styles.swipeableTabs}>

              <TabBar
                {...props}
                indicatorStyle={styles.indicator}
                style={styles.tabBar}
                labelStyle={styles.label}
                activeColor="#075cab"
                inactiveColor="#666"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.navigationTab,
              ]}
              onPress={() => {
                pauseVideosInTab(routes[index].key);
                navigation.navigate('ForumPost');
              }}
            >
              <Text style={[
                styles.navigationTabText,

              ]}>
                Post
              </Text>
            </TouchableOpacity>

          </View>
        )}
        lazy
      />
      <View style={styles.bottomNavContainer}>
        {tabConfig.map((tab, index) => {
          const isFocused = currentRouteName === tab.name;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => navigation.navigate(tab.name)}
              style={styles.navItem}
              activeOpacity={0.8}
            >
              <tab.iconComponent
                name={isFocused ? tab.focusedIcon : tab.unfocusedIcon}
                size={22}
                color={isFocused ? '#075cab' : 'black'}
              />
              <Text style={[styles.navText, { color: isFocused ? '#075cab' : 'black' }]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

// All Posts Component
const AllPosts = ({ scrollRef, videoRefs, isTabActive }) => {

  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  // const commentsCount = useSelector((state) => state.forum.commentsCount);

  // const storePosts = useSelector((state) => state.forum.posts);

  const handleReactionUpdate = async (forumId, reactionType, item) => {
    try {

      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
      });

      // Emit event after successful reaction update
      EventRegister.emit('onForumReactionUpdated', {
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
        previous_reaction: item?.userReaction, // Now item is passed as parameter
      });

    } catch (err) {
      console.error('[Reaction Submit] Failed to update reaction:', err);
    }
  };


  useEffect(() => {
    const reactionListener = EventRegister.addEventListener(
      'onForumReactionUpdated',
      ({ forum_id, reaction_type }) => {
        console.log('[Reaction Event] Received:', { forum_id, reaction_type });

        setLocalPosts(prev => {
          return prev.map(post => {
            if (post.forum_id !== forum_id) return post;

            console.log('[Reaction Update] Updating post:', post.forum_id);

            let newTotal = Number(post.totalReactions || 0);
            let newReaction = reaction_type;

            const hadReaction = post.userReaction && post.userReaction !== 'None';
            const oldReaction = post.userReaction;

            if (reaction_type === 'None') {
              if (hadReaction) newTotal -= 1;
              newReaction = null;
            } else if (!hadReaction) {
              newTotal += 1;
            } else if (oldReaction !== reaction_type) {
              // Reaction changed (e.g., Like -> Love), count remains
              console.log('[Reaction Update] Changed from', oldReaction, 'to', reaction_type);
            }

            const updatedPost = {
              ...post,
              userReaction: newReaction,
              totalReactions: newTotal,
            };

            console.log('[Reaction Update] Updated post:', updatedPost);

            return updatedPost;
          });
        });
      }
    );

    return () => {
      EventRegister.removeEventListener(reactionListener);

    };
  }, []);

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [localPosts, setLocalPosts] = useState([]);
  // console.log('localPosts',localPosts[1])
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
        type: 'All',
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
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 1000);
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
    if (!hasFetchedPosts) {
      fetchLatestPosts();
      setHasFetchedPosts(true);
    }
  }, [hasFetchedPosts]);

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

    }
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 300,
    waitForInteraction: false
  };



  const onViewableItemsChanged = useRef(({ viewableItems }) => {

    if (!isFocused) {
      setActiveVideo(null);
      return;
    }
  
    const visibleItem = viewableItems.find(item => item.isViewable);
  
    if (visibleItem) {
      const forumId = visibleItem.item.forum_id;

      // Still only auto-play video if there's a video
      if (visibleItem.item.videoUrl) {
        setActiveVideo(forumId);
      } else {
        setActiveVideo(null);
      }
  
      if (forumId && !viewedForumIdsRef.current.has(forumId)) {
       
        viewedForumIdsRef.current.add(forumId);
        incrementViewCount(forumId);
      } else {

      }
    } else {
      setActiveVideo(null);
    }
  }).current;




  const activeVideoRef = useRef(null);
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    if (!isFocused) {
      setActiveVideo(null);
    }

    return () => {
      setActiveVideo(null);
    };
  }, [isFocused]);






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
    console.log('[Comment Sheet] Opening for forum_id:', forum_id, 'user_id:', myId);

    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          ref={commentSectionRef}
          closeBottomSheet={() => {
            console.log('[Comment Sheet] Closing sheet');
            bottomSheetRef.current?.scrollTo(0);
          }}
        />

        <InputAccessoryView backgroundColor="#f2f2f2">
          <CommentInputBar
            storedUserId={myId}
            forum_id={forum_id}
            onCommentAdded={(newCommentData) => {
              console.log('[Comment Added] New comment:', newCommentData);
              commentSectionRef.current?.handleCommentAdded(newCommentData);
            }}
            onEditComplete={(updatedComment) => {
              console.log('[Comment Edited] Updated comment:', updatedComment);
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
                <Text style={[styles.date1]}>{getTimeDisplayForum(item.posted_on)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: 10, }}>

          <ForumBody
            html={normalizeHtml(item?.forum_body, searchQuery)}
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
                  videoRefs[item.forum_id] = ref;
                } else {
                  delete videoRefs[item.forum_id];
                }
              }}
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
                marginVertical: 5
              }}
              controls
              paused={!isTabActive || activeVideo !== item.forum_id}
              resizeMode="contain"
              poster={item.thumbnailUrl}
              repeat
              posterResizeMode="cover"
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


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, height: 40, alignItems: 'center' }}>
          <View>
            <TouchableOpacity
              onLongPress={() => {

                setActiveReactionForumId(prev =>
                  prev === item.forum_id ? null : item.forum_id
                );
              }}
              activeOpacity={0.7}
              style={{

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

                await handleReactionUpdate(item.forum_id, selectedType, item);


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
                  {/* <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text> */}
                  <Icon name="thumb-up-outline" size={20} color="#999" />

                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  reactionSheetRef.current?.open(item.forum_id, 'All');
                }}
                style={{ padding: 5, paddingHorizontal: 10 }}
              >
                {item.totalReactions > 0 && (
                  <Text style={{ color: "#666" }}>
                    ({item.totalReactions})
                  </Text>
                )}
              </TouchableOpacity>
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

                            await handleReactionUpdate(item.forum_id, selectedType, item);

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
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId, isTabActive]);


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

      // ✅ Scroll to top of list
      listRef.current?.scrollToOffset({ offset: 0, animated: true });

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

  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchBarRef = useRef(null);

  // const toggleSearchBar = () => {
  //   setShowSearchBar(prev => {
  //     if (!prev) {
  //       setTimeout(() => {
  //         searchBarRef.current?.focus();
  //       }, 100);
  //     }
  //     return !prev;
  //   });
  // };

  const searchBarHeight = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const searchButtonOpacity = useRef(new Animated.Value(1)).current;

  const toggleSearchBar = () => {
    if (showSearchBar) {
      // Animation for hiding search bar
      Animated.parallel([
        Animated.timing(searchBarHeight, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(searchBarOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(searchButtonOpacity, {
          toValue: 1,
          duration: 200,
          delay: 100,
          useNativeDriver: false,
        }),
      ]).start(() => {
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchTriggered(false);
        setSearchResults([]);
        Keyboard.dismiss();
      });
    } else {
      setShowSearchBar(true);
      // Animation for showing search bar
      Animated.parallel([
        Animated.timing(searchBarHeight, {
          toValue: 60, // Adjust this based on your search bar height
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(searchBarOpacity, {
          toValue: 1,
          duration: 200,
          delay: 100,
          useNativeDriver: false,
        }),
        Animated.timing(searchButtonOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => {
        searchBarRef.current?.focus();
      });
    }
  };

  useEffect(() => {
    if (showSearchBar) {
      const timeout = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [showSearchBar]);
  
  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>

        <Animated.View
          style={{
            position: 'absolute',
            top: 15,
            right: 15,
            zIndex: 10,
            shadowOffset: { width: 0, height: 1 },
            opacity: searchButtonOpacity,
            transform: [
              {
                scale: searchButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity onPress={toggleSearchBar} style={{
            backgroundColor: 'red',
            padding: 10,
            borderRadius: 30,
            backgroundColor: '#075cab',
            borderRadius: 30,
            elevation: 3,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 3,
          }}>
            <Icon name="magnify" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>


        <Animated.View
          style={{
            height: searchBarHeight,
            opacity: searchBarOpacity,
            paddingHorizontal: 15,
            backgroundColor: 'white',
            // paddingVertical: 8,
            elevation: 3,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: 10,
              paddingHorizontal: 15,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Icon name="magnify" size={20} color="#075cab" style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={{ flex: 1, padding: 0, color: 'black' }}
              placeholder="Search posts..."
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={handleDebouncedTextChange}
              autoFocus={true}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchTriggered(false);
                  setSearchResults([]);
                }}
              >
                <Icon name="close-circle" size={20} color="gray" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={toggleSearchBar}
            style={{ padding: 10 }}
          >
            <Text style={{ color: '#075cab' }}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>


        {showNewJobAlert && (
          <TouchableOpacity onPress={handleRefresh} style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#075cab', padding: 10, borderRadius: 10, zIndex: 10 }}>
            <Text style={{ color: 'white', fontWeight: '500' }}>{newJobCount} new post{newJobCount > 1 ? 's' : ''} available — Tap to refresh</Text>
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

                if (showSearchBar && !searchTriggered) {
                  toggleSearchBar(); // This will trigger the hide animation
                }

              }}
              keyExtractor={(item, index) => `${item.forum_id}-${index}`}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
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
const LatestPosts = ({ scrollRef, videoRefs, isTabActive }) => {

  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  // const commentsCount = useSelector((state) => state.forum.commentsCount);
  useEffect(() => {
    const listener = EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
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

    const deleteListener = EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
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

    return () => {
      EventRegister.removeEventListener(listener);
      EventRegister.removeEventListener(deleteListener);
    };
  }, []);
  // const storePosts = useSelector((state) => state.forum.posts);
  const handleReactionUpdate = async (forumId, reactionType, item) => {
    try {

      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
      });

      // Emit event after successful reaction update
      EventRegister.emit('onForumReactionUpdated', {
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
        previous_reaction: item?.userReaction, // Now item is passed as parameter
      });

    } catch (err) {
      console.error('[Reaction Submit] Failed to update reaction:', err);
    }
  };

  useEffect(() => {
    const reactionListener = EventRegister.addEventListener(
      'onForumReactionUpdated',
      ({ forum_id, reaction_type }) => {
        console.log('[Reaction Event] Received:', { forum_id, reaction_type });

        setLocalPosts(prev => {
          return prev.map(post => {
            if (post.forum_id !== forum_id) return post;

            console.log('[Reaction Update] Updating post:', post.forum_id);

            let newTotal = Number(post.totalReactions || 0);
            let newReaction = reaction_type;

            const hadReaction = post.userReaction && post.userReaction !== 'None';
            const oldReaction = post.userReaction;

            if (reaction_type === 'None') {
              if (hadReaction) newTotal -= 1;
              newReaction = null;
            } else if (!hadReaction) {
              newTotal += 1;
            } else if (oldReaction !== reaction_type) {
              // Reaction changed (e.g., Like -> Love), count remains
              console.log('[Reaction Update] Changed from', oldReaction, 'to', reaction_type);
            }

            const updatedPost = {
              ...post,
              userReaction: newReaction,
              totalReactions: newTotal,
            };

            console.log('[Reaction Update] Updated post:', updatedPost);

            return updatedPost;
          });
        });
      }
    );

    return () => {
      EventRegister.removeEventListener(reactionListener);
  
    };
  }, []);

  const dispatch = useDispatch();
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

    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    if (!hasFetchedPosts) {
      fetchLatestPosts();
      setHasFetchedPosts(true);
    }
  }, [hasFetchedPosts]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMorePosts) return;
    fetchLatestPosts(lastEvaluatedKey);
  }, [loading, loadingMore, hasMorePosts, lastEvaluatedKey]);


  const viewedForumIdsRef = useRef(new Set());

  const incrementViewCount = async (forumId) => {

    try {
      const response = await apiClient.post('/forumViewCounts', {
        command: 'forumViewCounts',
        forum_id: forumId,
      });

    } catch (error) {

    }
  };
  

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 300,
    waitForInteraction: false
  };


  const onViewableItemsChanged = useRef(({ viewableItems }) => {

    if (!isFocused) {
      setActiveVideo(null);
      return;
    }
  
    const visibleItem = viewableItems.find(item => item.isViewable);
  
    if (visibleItem) {
      const forumId = visibleItem.item.forum_id;

      // Still only auto-play video if there's a video
      if (visibleItem.item.videoUrl) {
        setActiveVideo(forumId);
      } else {
        setActiveVideo(null);
      }
  
      if (forumId && !viewedForumIdsRef.current.has(forumId)) {
       
        viewedForumIdsRef.current.add(forumId);
        incrementViewCount(forumId);
      } else {

      }
    } else {
      setActiveVideo(null);
    }
  }).current;
  
  




  const activeVideoRef = useRef(null);
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    if (!isFocused) {
      setActiveVideo(null);
    }

    return () => {
      setActiveVideo(null);
    };
  }, [isFocused]);






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
    console.log('[Comment Sheet] Opening for forum_id:', forum_id, 'user_id:', myId);

    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={forum_id}
          currentUserId={myId}
          ref={commentSectionRef}
          closeBottomSheet={() => {
            console.log('[Comment Sheet] Closing sheet');
            bottomSheetRef.current?.scrollTo(0);
          }}
        />

        <InputAccessoryView backgroundColor="#f2f2f2">
          <CommentInputBar
            storedUserId={myId}
            forum_id={forum_id}
            onCommentAdded={(newCommentData) => {
              console.log('[Comment Added] New comment:', newCommentData);
              commentSectionRef.current?.handleCommentAdded(newCommentData);
            }}
            onEditComplete={(updatedComment) => {
              console.log('[Comment Edited] Updated comment:', updatedComment);
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
                <Text style={[styles.date1]}>{getTimeDisplayForum(item.posted_on)}</Text>
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
                  videoRefs[item.forum_id] = ref;
                } else {
                  delete videoRefs[item.forum_id];
                }
              }}
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
                marginVertical: 5
              }}
              controls
              paused={!isTabActive || activeVideo !== item.forum_id}
              resizeMode="contain"
              poster={item.thumbnailUrl}
              repeat
              posterResizeMode="cover"
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


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, height: 40, alignItems: 'center' }}>
          <View>
            <TouchableOpacity
              onLongPress={() => {

                setActiveReactionForumId(prev =>
                  prev === item.forum_id ? null : item.forum_id
                );
              }}
              activeOpacity={0.7}
              style={{

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

                await handleReactionUpdate(item.forum_id, selectedType, item);


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
                  {/* <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text> */}
                  <Icon name="thumb-up-outline" size={20} color="#999" />

                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  reactionSheetRef.current?.open(item.forum_id, 'All');
                }}
                style={{ padding: 5, paddingHorizontal: 10 }}
              >
                {item.totalReactions > 0 && (
                  <Text style={{ color: "#666" }}>
                    ({item.totalReactions})
                  </Text>
                )}
              </TouchableOpacity>
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

                            await handleReactionUpdate(item.forum_id, selectedType, item);

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
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId, isTabActive]);



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

    dispatch(clearPosts());
    await fetchLatestPosts(null);

    setIsRefreshing(false);

    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [fetchLatestPosts, dispatch]);


  const onRender = (id, phase, actualDuration) => {
    // console.log(`[Profiler] ${id} - ${phase}`);
    // console.log(`Actual render duration: ${actualDuration}ms`);
  };


  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>

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
              viewabilityConfig={viewabilityConfig}
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
const TrendingPosts = ({ scrollRef, videoRefs, isTabActive }) => {

  const posts = useSelector((state) => state.forum.posts);
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const [hasFetchedPosts, setHasFetchedPosts] = useState(false);
  const { openSheet, closeSheet } = useBottomSheet();
  // const commentsCount = useSelector((state) => state.forum.commentsCount);
  useEffect(() => {
    const listener = EventRegister.addEventListener('onCommentAdded', ({ forum_id }) => {
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

    const deleteListener = EventRegister.addEventListener('onCommentDeleted', ({ forum_id }) => {
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

    return () => {
      EventRegister.removeEventListener(listener);
      EventRegister.removeEventListener(deleteListener);
    };
  }, []);
  // const storePosts = useSelector((state) => state.forum.posts);
  const handleReactionUpdate = async (forumId, reactionType, item) => {
    try {

      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
      });

      // Emit event after successful reaction update
      EventRegister.emit('onForumReactionUpdated', {
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
        previous_reaction: item?.userReaction, // Now item is passed as parameter
      });

    } catch (err) {
      console.error('[Reaction Submit] Failed to update reaction:', err);
    }
  };


  useEffect(() => {
    const reactionListener = EventRegister.addEventListener(
      'onForumReactionUpdated',
      ({ forum_id, reaction_type }) => {
        console.log('[Reaction Event] Received:', { forum_id, reaction_type });

        setLocalPosts(prev => {
          return prev.map(post => {
            if (post.forum_id !== forum_id) return post;

            console.log('[Reaction Update] Updating post:', post.forum_id);

            let newTotal = Number(post.totalReactions || 0);
            let newReaction = reaction_type;

            const hadReaction = post.userReaction && post.userReaction !== 'None';
            const oldReaction = post.userReaction;

            if (reaction_type === 'None') {
              if (hadReaction) newTotal -= 1;
              newReaction = null;
            } else if (!hadReaction) {
              newTotal += 1;
            } else if (oldReaction !== reaction_type) {
              // Reaction changed (e.g., Like -> Love), count remains
              console.log('[Reaction Update] Changed from', oldReaction, 'to', reaction_type);
            }

            const updatedPost = {
              ...post,
              userReaction: newReaction,
              totalReactions: newTotal,
            };

            console.log('[Reaction Update] Updated post:', updatedPost);

            return updatedPost;
          });
        });
      }
    );

    return () => {
      EventRegister.removeEventListener(reactionListener);

    };
  }, []);

  const dispatch = useDispatch();
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
        command: 'getAllTrendingPosts',
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };

      const response = await withTimeout(
        apiClient.post('/getAllTrendingPosts', requestData),
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

    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    if (!hasFetchedPosts) {
      fetchLatestPosts();
      setHasFetchedPosts(true);
    }
  }, [hasFetchedPosts]);

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

    }
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 300,
    waitForInteraction: false
  };



  const onViewableItemsChanged = useRef(({ viewableItems }) => {

    if (!isFocused) {
      setActiveVideo(null);
      return;
    }
  
    const visibleItem = viewableItems.find(item => item.isViewable);
  
    if (visibleItem) {
      const forumId = visibleItem.item.forum_id;

      // Still only auto-play video if there's a video
      if (visibleItem.item.videoUrl) {
        setActiveVideo(forumId);
      } else {
        setActiveVideo(null);
      }
  
      if (forumId && !viewedForumIdsRef.current.has(forumId)) {
       
        viewedForumIdsRef.current.add(forumId);
        incrementViewCount(forumId);
      } else {

      }
    } else {
      setActiveVideo(null);
    }
  }).current;




  const activeVideoRef = useRef(null);
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    if (!isFocused) {
      setActiveVideo(null);
    }

    return () => {
      setActiveVideo(null);
    };
  }, [isFocused]);






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
                <Text style={[styles.date1]}>{getTimeDisplayForum(item.posted_on)}</Text>
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
                  videoRefs[item.forum_id] = ref;
                } else {
                  delete videoRefs[item.forum_id];
                }
              }}
              source={{ uri: item.videoUrl }}
              style={{
                width: '100%',
                aspectRatio: item.aspectRatio || 16 / 9,
                marginVertical: 5
              }}
              controls
              paused={!isTabActive || activeVideo !== item.forum_id}
              resizeMode="contain"
              poster={item.thumbnailUrl}
              repeat
              posterResizeMode="cover"
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


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, height: 40, alignItems: 'center' }}>
          <View>
            <TouchableOpacity
              onLongPress={() => {

                setActiveReactionForumId(prev =>
                  prev === item.forum_id ? null : item.forum_id
                );
              }}
              activeOpacity={0.7}
              style={{

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

                await handleReactionUpdate(item.forum_id, selectedType, item);


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
                  {/* <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text> */}
                  <Icon name="thumb-up-outline" size={20} color="#999" />

                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  reactionSheetRef.current?.open(item.forum_id, 'All');
                }}
                style={{ padding: 5, paddingHorizontal: 10 }}
              >
                {item.totalReactions > 0 && (
                  <Text style={{ color: "#666" }}>
                     ({item.totalReactions})
                  </Text>
                )}
              </TouchableOpacity>
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

                            await handleReactionUpdate(item.forum_id, selectedType, item);

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
  }, [localPosts, activeVideo, expandedTexts, activeReactionForumId, isTabActive]);


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

    dispatch(clearPosts());
    await fetchLatestPosts(null);

    setIsRefreshing(false);

    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [fetchLatestPosts, dispatch]);



  const onRender = (id, phase, actualDuration) => {
    // console.log(`[Profiler] ${id} - ${phase}`);
    // console.log(`Actual render duration: ${actualDuration}ms`);
  };


  return (
    <Profiler id="ForumListCompanylatest" onRender={onRender}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'whitesmoke', }}>

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
              viewabilityConfig={viewabilityConfig}
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
    height: 2,
    borderRadius: 10,
    flex: 1
  },
  label: {
    fontWeight: 'bold',
    fontSize: 12,
  },

  companyCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    paddingHorizontal: 15,
    paddingVertical: 5,
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
    color: '#666',
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
    padding: 5,

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


  bottomNavContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },


  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navText: {
    fontSize: 12,
    color: 'black',
    marginTop: 2,
  },

  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  modalText: { marginLeft: 10, fontSize: 18 },



  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  swipeableTabs: {
    flex: 1,
  },

  navigationTab: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    // backgroundColor:'#075cab',
    marginVertical: 5,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10

  },

  navigationTabText: {
    color: '#075cab',
    fontSize: 15,
    fontWeight: '600',
  },

});

export default PageView;
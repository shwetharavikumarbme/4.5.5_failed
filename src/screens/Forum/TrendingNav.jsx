import React, { useState, useEffect, useCallback, useRef, Profiler, useMemo } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, textInputRef, TextInput, Dimensions, Modal, StyleSheet, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, SafeAreaView, ActivityIndicator, Linking, Share, RefreshControl, Animated, PanResponder, ScrollView, InputAccessoryView } from "react-native";
import Video from "react-native-video";
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useIsFocused } from "@react-navigation/native";
import { scale } from 'react-native-size-matters';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg'
import FastImage from "react-native-fast-image";
import ParsedText from "react-native-parsed-text";
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ImageViewer from 'react-native-image-zoom-viewer';
import NetInfo from '@react-native-community/netinfo';
import apiClient from "../ApiClient";
import { setCommentsCount } from "../Redux/Forum_Actions";
import { useDispatch, useSelector } from "react-redux";
import { useNetwork } from "../AppUtils/IdProvider";
import { showToast } from "../AppUtils/CustomToast";
import Fuse from "fuse.js";
import CommentsSection from "../AppUtils/Comments";
import CommentInputBar from "../AppUtils/InputBar";
import { useBottomSheet } from "../AppUtils/SheetProvider";
import CommentCountFetcher, { fetchCommentCount } from "../AppUtils/CommentCount";
import VideoPlayer from 'react-native-video-controls';
import { EventRegister } from "react-native-event-listeners";
import { useConnection } from "../AppUtils/ConnectionProvider";
import AppStyles from "../../assets/AppStyles";
import { getSignedUrl, getTimeDisplay } from "../helperComponents.jsx/signedUrls";
import { openMediaViewer } from "../helperComponents.jsx/mediaViewer";
import ReactionSheet from "../helperComponents.jsx/ReactionUserSheet";
import { fetchForumReactionsRaw } from "../helperComponents.jsx/ForumReactions";
import { ForumBody, generateHighlightedHTML } from "./forumBody";

const videoExtensions = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm',
  '.m4v', '.3gp', '.3g2', '.f4v', '.f4p', '.f4a', '.f4b', '.qt', '.quicktime'
];


const TrendingNav = ({ scrollRef }) => {
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

  const fetchMediaForPost = async (post) => {
    const mediaData = { forum_id: post.forum_id };

    const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
    const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
    const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;

    if (post.fileKey) {
      try {
        const res = await getSignedUrl('file', post.fileKey);
        const url = res?.file;

        if (url) {
          mediaData.imageUrl = url;

          if (videoExtensions.some(ext => post.fileKey.toLowerCase().endsWith(ext))) {
            mediaData.videoUrl = url;

            if (post.thumbnail_fileKey) {
              try {
                const thumbRes = await getSignedUrl('thumb', post.thumbnail_fileKey);
                mediaData.thumbnailUrl = thumbRes?.thumb;

                await new Promise(resolve => {
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
          } else {
            await new Promise(resolve => {
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

    let authorImageUrl = null;

    if (post.author_fileKey) {
      try {
        const res = await getSignedUrl('author', post.author_fileKey);
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

    return { ...post, ...mediaData };
  };

  useEffect(() => {
    if (!hasFetchedPosts) {
      fetchTrendingPosts();
      setHasFetchedPosts(true);
    }
  }, [hasFetchedPosts]);

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
    if (!isFocused) {
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
    if (!isFocused) {
      setActiveVideo(null);
    }
  }, [isFocused]);

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
    if (!isFocused) {
      setActiveVideo(null);
    }

    return () => {
      setActiveVideo(null);
    };
  }, [isFocused]);

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

          <TouchableWithoutFeedback
            onPress={() => {
              Keyboard.dismiss();
              searchInputRef.current?.blur?.();

            }}
          >
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
    fontSize: 15,
    color: 'black',
    marginTop: 5,
    marginBottom: 10,
    fontWeight: '400',
    alignItems: 'center',
    lineHeight: 23,
    paddingHorizontal: 10

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
    paddingTop: 5,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10
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
    alignSelf: 'center',
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

export default TrendingNav;


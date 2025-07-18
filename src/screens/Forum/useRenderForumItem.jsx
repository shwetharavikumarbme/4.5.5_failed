import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Share, Dimensions } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ForumBody, normalizeHtml } from './forumBody';
import useForumReactions, { reactionConfig } from './useForumReactions';
import { getTimeDisplayForum } from '../helperComponents.jsx/signedUrls';
import { useNavigation } from '@react-navigation/native';
import { useNetwork } from '../AppUtils/IdProvider';
import Video from 'react-native-video';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

export default function useRenderForumItem({
  localPosts,
  setLocalPosts,
  isTabActive,
  activeVideo,
  isFocused,
  videoRefs,
  activeReactionForumId,
  setActiveReactionForumId,
  openCommentSheet,
  searchQuery,
  getMediaForItem,
  getAuthorImage,
  openMediaViewer,
  reactionSheetRef,
  styles,

}) {

  const navigation = useNavigation();
  const [expandedTexts, setExpandedTexts] = useState({});
  const { myId, myData } = useNetwork();
  const { handleReactionUpdate } = useForumReactions(myId);


  const handleNavigate = (item) => {
    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 100);
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

  const renderItem = useCallback(({ item }) => {
    const mediaData = getMediaForItem(item);
    const authorImageUrl = getAuthorImage(item);
    const combinedItem = { ...item, ...mediaData, authorImageUrl };
    const maxAllowedHeight = Math.round(deviceHeight * 0.6);

    // 2. Calculate height based on aspect ratio (or fallback)
    let height;
    if (item.extraData?.aspectRatio) {
      const aspectRatioHeight = Math.round(deviceWidth / item.extraData?.aspectRatio);
      // Apply scaling only if it exceeds 70% of device height
      height = aspectRatioHeight > maxAllowedHeight ? maxAllowedHeight : aspectRatioHeight;
    } else {
      // Default fallback (if no aspect ratio)
      height = 250;
    }

    return (
      <View style={styles.comments}>
        {/* Author section */}
        <View style={styles.dpContainer}>
          <TouchableOpacity
            style={styles.dpContainer1}
            onPress={() => handleNavigate(item)}
            activeOpacity={0.8}
          >
            {'uri' in authorImageUrl ? (
              <FastImage
                source={{ uri: authorImageUrl.uri }}
                style={styles.image1}
              />
            ) : (
              <View style={[styles.dpContainer1, { backgroundColor: authorImageUrl.backgroundColor }]}>
                <Text style={{ color: authorImageUrl.textColor, fontWeight: 'bold' }}>
                  {authorImageUrl.initials || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.textContainer}>
            <View style={styles.title3}>
              <TouchableOpacity onPress={() => handleNavigate(item)}>
                <Text style={{ flex: 1, alignSelf: 'flex-start', color: 'black', fontSize: 15, fontWeight: '600' }}>
                  {(item.author || '').trim()}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Text style={styles.title}>{item.author_category || ''}</Text>
              <Text style={styles.date1}>{getTimeDisplayForum(item.posted_on)}</Text>
            </View>
          </View>
        </View>

        {/* Post content */}
        <View style={{ paddingHorizontal: 10 }}>
          <ForumBody
            html={normalizeHtml(item?.forum_body, searchQuery)}
            forumId={item.forum_id}
            isExpanded={expandedTexts[item.forum_id]}
            toggleFullText={toggleFullText}
          />
        </View>

        {/* Media content */}
        {item.fileKey && (
          <TouchableOpacity style={{
            width: '100%', height: height,
            borderRadius: 8,
            overflow: 'hidden'
          }}
            activeOpacity={1} >
            {mediaData?.videoUrl ? (
              <Video
                ref={(ref) => {
                  if (ref) {
                    videoRefs[item.forum_id] = ref;
                  } else {
                    delete videoRefs[item.forum_id];
                  }
                }}
                source={{ uri: mediaData.videoUrl }}
                style={{
                  width: '100%',
                  height: '100%'

                }}
                controls
                paused={!isTabActive || activeVideo !== item.forum_id || !isFocused}
                resizeMode="cover"
                poster={item.thumbnailUrl}
                repeat
                posterResizeMode="cover"
                
              />

              //    <Video
              //    source={{ uri: mediaData.videoUrl }}
              //    style={{ width: '100%', height: '100%' }}
              //    paused={!isTabActive || activeVideo !== item.forum_id || !isFocused}
              //    repeat

              //  />
            ) : mediaData?.imageUrl ? (
              <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: mediaData.imageUrl }])} activeOpacity={1}>
                <FastImage
                  source={{ uri: mediaData.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        )}


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, height: 40, alignItems: 'center', }}>
          <View>
            <TouchableOpacity
              onLongPress={() => setActiveReactionForumId(prev => prev === item.forum_id ? null : item.forum_id)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={async () => {
                const currentReaction = item.userReaction || 'None';
                const selectedType = currentReaction !== 'None' ? 'None' : 'Like';

                setLocalPosts(prev => prev.map(p => {
                  if (p.forum_id !== item.forum_id) return p;
                  let newTotal = Number(p.totalReactions || 0);
                  const hadReaction = currentReaction && currentReaction !== 'None';
                  if (selectedType === 'None' && hadReaction) newTotal -= 1;
                  else if (!hadReaction) newTotal += 1;
                  return {
                    ...p,
                    userReaction: selectedType === 'None' ? null : selectedType,
                    totalReactions: newTotal,
                  };
                }));

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
                <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                  <Icon name="thumb-up-outline" size={20} color="#999" />
                </View>
              )}

              <TouchableOpacity
                onPress={() => reactionSheetRef.current?.open(item.forum_id, 'All')}
                style={{ padding: 5, paddingHorizontal: 10 }}
              >
                {item.totalReactions > 0 && (
                  <Text style={{ color: "#666" }}>({item.totalReactions})</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>

            {activeReactionForumId === item.forum_id && (
              <>
                <TouchableWithoutFeedback onPress={() => setActiveReactionForumId(null)}>
                  <View style={styles.reactionOverlay} />
                </TouchableWithoutFeedback>
                <View style={styles.reactionContainer}>
                  {reactionConfig.map(({ type, emoji }) => {
                    const isSelected = item.userReaction === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={async () => {
                          const selectedType = isSelected ? 'None' : type;
                          await handleReactionUpdate(item.forum_id, selectedType, item);
                          setActiveReactionForumId(null);
                        }}
                        style={[
                          styles.reactionButton,
                          isSelected && styles.selectedReaction
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.iconContainer}>
          <View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openCommentSheet(item.forum_id, item.user_id, myId, item)}
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
  }, [
    localPosts, activeVideo, isFocused, expandedTexts, activeReactionForumId, isTabActive,
    getMediaForItem, getAuthorImage, handleNavigate, openMediaViewer, reactionSheetRef, deviceWidth
  ]);

  return renderItem;
}

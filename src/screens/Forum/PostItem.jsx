import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  InputAccessoryView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import ReactionSheet from '../helperComponents.jsx/ReactionUserSheet';
import { getTimeDisplay } from '../helperComponents.jsx/signedUrls';
import { ForumBody, generateHighlightedHTML } from './forumBody';
import CommentsSection from '../AppUtils/Comments';
import CommentInputBar from '../AppUtils/InputBar';
import apiClient from '../ApiClient';
import { useBottomSheet } from '../AppUtils/SheetProvider';
import { useNetwork } from '../AppUtils/IdProvider';
import { useConnection } from '../AppUtils/ConnectionProvider';

const { height: screenHeight } = Dimensions.get('window');

const PostItem = ({
  item,
  videoRefs,
  isTabActive,
  activeVideo,
  setActiveVideo,
  searchQuery,
  expandedTexts,
  toggleFullText,
  navigation,
  openMediaViewer,
  updatePostReaction, 
  
}) => {
  const [activeReactionForumId, setActiveReactionForumId] = useState(null);
  const reactionSheetRef = React.useRef(null);
  const commentSectionRef = React.useRef(null);
  const bottomSheetRef = React.useRef(null);

  const reactionConfig = [
    { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
    { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
    { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
    { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
    { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
  ];

  const handleNavigate = () => {
    setTimeout(() => {
      if (item.user_type === "company") {
        navigation.navigate('CompanyDetailsPage', { userId: item.user_id });
      } else if (item.user_type === "users") {
        navigation.navigate('UserDetailsPage', { userId: item.user_id });
      }
    }, 100);
  };
  const { openSheet, closeSheet } = useBottomSheet();
const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();

  const openCommentSheet = () => {
    openSheet(
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <CommentsSection
          forum_id={item.forum_id}
          currentUserId={myId}
          ref={commentSectionRef}
          closeBottomSheet={() => bottomSheetRef.current?.scrollTo(0)}
        />

        <InputAccessoryView backgroundColor="#f2f2f2">
          <CommentInputBar
            storedUserId={myId}
            forum_id={item.forum_id}
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

  const sharePost = async () => {
    try {
      const baseUrl = 'https://bmebharat.com/latest/comment/';
      const jobUrl = `${baseUrl}${item.forum_id}`;

      const result = await Share.share({
        message: jobUrl,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with specific activity type
        } else {
          // Shared
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleReaction = async (selectedType) => {
    const currentReaction = item.userReaction || 'None';
    
    // Calculate the new reaction state
    let newReaction = selectedType;
    let newTotalReactions = item.totalReactions || 0;
  
    if (selectedType === 'None') {
      // Removing reaction
      newReaction = null;
      if (currentReaction !== 'None') {
        newTotalReactions = Math.max(newTotalReactions - 1, 0);
      }
    } else {
      // Adding/changing reaction
      if (currentReaction === 'None' || currentReaction === null) {
        newTotalReactions += 1;
      } else if (currentReaction !== selectedType) {
        // Changing reaction type doesn't change total count
        newTotalReactions = newTotalReactions;
      }
    }
  
    // Optimistic update
    updatePostReaction({
      forumId: item.forum_id,
      userReaction: newReaction,
      totalReactions: newTotalReactions
    });
  
    try {
      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: item.forum_id,
        user_id: myId,
        reaction_type: selectedType,
      });
    } catch (err) {
      console.error('Error updating reaction:', err);
      
      // Revert optimistic update
      updatePostReaction({
        forumId: item.forum_id,
        userReaction: currentReaction,
        totalReactions: item.totalReactions
      });
    }
  };



  const reactionDisplay = reactionConfig.find(r => r.type === item.userReaction) || 
    { emoji: '👍', label: 'Like', outlineIcon: 'thumb-up-outline' };

  return (
    <View style={styles.comments}>
      {/* Author Info */}
      <View style={styles.dpContainer}>
        <TouchableOpacity style={styles.dpContainer1} onPress={handleNavigate} activeOpacity={0.8}>
          <FastImage
            source={item.authorImageUrl ? { uri: item.authorImageUrl } : null}
            style={styles.image1}
            onError={() => console.log('Error loading profile image')}
          />
        </TouchableOpacity>

        <View style={styles.textContainer}>
          <View style={styles.title3}>
            <TouchableOpacity onPress={handleNavigate}>
              <Text style={styles.authorName}>
                {(item.author || '').trimStart().trimEnd()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.authorMeta}>
            <View>
              <Text style={styles.title}>{item.author_category || ''}</Text>
            </View>
            <View>
              <Text style={styles.date1}>{getTimeDisplay(item.posted_on)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Post Content */}
      <View style={styles.postContent}>
        <ForumBody
          html={generateHighlightedHTML(item.forum_body, searchQuery)}
          forumId={item.forum_id}
          isExpanded={expandedTexts[item.forum_id]}
          toggleFullText={() => toggleFullText(item.forum_id)}
        />
      </View>

      {/* Media */}
      {item.videoUrl ? (
        <TouchableOpacity activeOpacity={1}>
          <Video
            ref={(ref) => {
              if (ref) {
                videoRefs[item.forum_id] = ref;
              } else {
                delete videoRefs[item.forum_id];
              }
            }}
            source={{ uri: item.videoUrl }}
            style={styles.video}
            controls
            paused={!isTabActive || activeVideo !== item.forum_id}
            resizeMode="contain"
            poster={item.thumbnailUrl}
            repeat
            posterResizeMode="cover"
          />
        </TouchableOpacity>
      ) : item.imageUrl ? (
        <TouchableOpacity onPress={() => openMediaViewer([{ type: 'image', url: item.imageUrl }])} activeOpacity={1}>
          <FastImage
            source={{ uri: item.imageUrl }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
      ) : null}

      {/* Reactions */}
      <View style={styles.reactionContainer}>
        <View>
          <TouchableOpacity
            onLongPress={() => setActiveReactionForumId(prev => prev === item.forum_id ? null : item.forum_id)}
            activeOpacity={0.7}
            style={styles.reactionButton}
            onPress={() => handleReaction(item.userReaction ? 'None' : 'Like')}
          >
            {item.userReaction && item.userReaction !== 'None' ? (
              <>
                <Text style={styles.reactionEmoji}>{reactionDisplay.emoji}</Text>
                <Text style={styles.reactionLabel}>{reactionDisplay.label}</Text>
              </>
            ) : (
              <View style={styles.reactionPlaceholder}>
                <Icon name="thumb-up-outline" size={20} color="#999" />
              </View>
            )}

            <TouchableOpacity
              onPress={() => reactionSheetRef.current?.open(item.forum_id, 'All')}
              style={styles.reactionCount}
            >
              {item.totalReactions > 0 && (
                <Text style={styles.reactionCountText}>{item.totalReactions}</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>

          {activeReactionForumId === item.forum_id && (
            <ReactionOverlay 
              item={item}
              onReactionPress={handleReaction}
              onClose={() => setActiveReactionForumId(null)}
              reactionConfig={reactionConfig}
            />
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.iconContainer}>
        <View>
          <TouchableOpacity style={styles.iconButton} onPress={openCommentSheet}>
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
          <TouchableOpacity style={styles.iconButton} onPress={sharePost}>
            <Icon name="share-outline" size={21} color="#075cab" />
            <Text style={styles.iconTextUnderlined}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ReactionSheet ref={reactionSheetRef} />
    </View>
  );
};

const ReactionOverlay = ({ item, onReactionPress, onClose, reactionConfig }) => {
  return (
    <>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.reactionOverlay} />
      </TouchableWithoutFeedback>

      <View style={styles.reactionPicker}>
        {reactionConfig.map(({ type, emoji }) => {
          const isSelected = item.userReaction === type;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => {
                onReactionPress(isSelected ? 'None' : type);
                onClose();
              }}
              style={[
                styles.reactionOption,
                isSelected && styles.selectedReaction
              ]}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  comments: {
    backgroundColor: 'white',
    marginBottom: 10,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
  },
  dpContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  dpContainer1: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 10,
  },
  image1: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
  },
  title3: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    flex: 1,
    alignSelf: 'flex-start',
    color: 'black',
    fontSize: 15,
    fontWeight: '600',
  },
  authorMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 12,
    color: '#666',
  },
  date1: {
    fontSize: 12,
    color: '#666',
  },
  postContent: {
    paddingHorizontal: 10,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginVertical: 5,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    marginVertical: 5,
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  reactionButton: {
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 15,
  },
  reactionLabel: {
    fontSize: 12,
    color: '#777',
    marginLeft: 4,
  },
  reactionPlaceholder: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reactionCount: {
    padding: 5,
    paddingHorizontal: 10,
  },
  reactionCountText: {
    color: '#666',
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
  reactionPicker: {
    position: 'absolute',
    top: -65,
    left: 0,
    zIndex: 1,
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
    backgroundColor: '#e0f2f1',
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTextUnderlined: {
    marginLeft: 5,
    color: '#075cab',
    fontSize: 14,
  },
});

export default PostItem;
import { useState, useCallback } from 'react';
import apiClient from '../ApiClient';
import { Dimensions } from 'react-native';
import { fetchForumReactionsRaw } from '../helperComponents.jsx/ForumReactions';
import { fetchCommentCount } from '../AppUtils/CommentCount';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');
const MAX_HEIGHT = Math.floor(deviceHeight * 0.7);
const MAX_WIDTH = deviceWidth;
const MIN_ASPECT_RATIO = 0.8;

const withTimeout = (promise, timeout = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
  ]);
};

export default function useForumFetcher({ command, type, fetchLimit = 10, isConnected = true, preloadUrls, myId }) {
  const [localPosts, setLocalPosts] = useState([]);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (lastKey = null) => {
    if (!isConnected || loading || loadingMore) return;

    lastKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command,
        type,
        limit: fetchLimit,
        ...(lastKey && { lastEvaluatedKey: lastKey }),
      };

      const response = await withTimeout(apiClient.post(`/${command}`, requestData), 10000);
      const newPosts = response?.data?.response || [];

      if (!newPosts.length) {
        setHasMorePosts(false);
        return;
      }

      const enrichedPosts = await Promise.all(
        newPosts.map(async post => {
          const forumId = post.forum_id;

          const [reactionData, commentCount] = await Promise.all([
            fetchForumReactionsRaw(forumId, myId),
            fetchCommentCount(forumId),
          ]);

          return {
            ...post,
            aspectRatio: post.extraData?.aspectRatio || 1,
            originalAspectRatio: post.extraData?.originalAspectRatio || 1,

            commentCount: commentCount || 0,
            reactionsCount: reactionData.reactionsCount || {},
            totalReactions: reactionData.totalReactions || 0,
            userReaction: reactionData.userReaction || null,
          };
        })
      );

      setLocalPosts(prev => {
        const combined = [...prev, ...enrichedPosts];
        return combined.filter(
          (post, index, self) => index === self.findIndex(p => p.forum_id === post.forum_id)
        );
      });

      // Preload media only for the first page
      if (!lastKey && typeof preloadUrls === 'function') {
        preloadUrls(0, enrichedPosts.length - 1);
      }

      setHasMorePosts(!!response.data.lastEvaluatedKey);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);

    } catch (error) {
      console.error('[useForumFetcher] Failed to fetch posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [command, type, fetchLimit, isConnected, loading, loadingMore, preloadUrls, myId]);

  return {
    localPosts,
    setLocalPosts,
    fetchPosts,
    hasMorePosts,
    loading,
    loadingMore,
    lastEvaluatedKey,
    setLastEvaluatedKey,
  };
}

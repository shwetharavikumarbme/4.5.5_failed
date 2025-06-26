import { useEffect, useState, useCallback } from 'react';
import apiClient from '../ApiClient';

const withTimeout = (promise, timeout = 5000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeout)
    ),
  ]);
};

export const useFetchForumReactionsCount = (forumId, userId) => {
  const [fetching, setFetching] = useState(false);
  const [reactionsCount, setReactionsCount] = useState({});
  const [userReaction, setUserReaction] = useState(null);
  const [totalReactions, setTotalReactions] = useState(0);

  const fetchReactions = useCallback(async () => {
    setFetching(true);
    const result = await fetchForumReactionsRaw(forumId, userId);
    setReactionsCount(result.reactionsCount);
    setUserReaction(result.userReaction);
    setTotalReactions(result.totalReactions);
    setFetching(false);
  }, [forumId, userId]);

  return { reactionsCount, totalReactions, userReaction, fetching, fetchReactions };
};

export const fetchForumReactionsBatch = async (forumIds = [], userId) => {
  if (!forumIds.length) return {};

  try {
    const results = await Promise.all(
      forumIds.map(async (forumId) => {
        const response = await apiClient.post('/getForumReactionsCount', {
          command: 'getForumReactionsCount',
          forum_id: forumId,
          user_id: userId,
        });

        const data = response.data || {};
        return [
          forumId,
          {
            reactionsCount: data.reactions || {},
            userReaction: data?.user_reaction?.reaction_type || null,
            totalReactions: data?.total_reactions || 0,
          },
        ];
      })
    );

    return Object.fromEntries(results);
  } catch (error) {
    console.error('[fetchForumReactionsBatch fallback] Error:', error);
    return {};
  }
};

export const fetchForumReactionsRaw = async (forumId, userId) => {
  const all = await fetchForumReactionsBatch([forumId], userId);
  const data = all[forumId] || {};

  return {
    reactionsCount: data.reactions || {},
    userReaction: data.userReaction || null,
    totalReactions: data.totalReactions || 0,
  };
};


export const useUpdateForumReaction = (forumId, userId, onSuccess) => {
  const [updating, setUpdating] = useState(false);

  const updateReaction = async (reactionType) => {

    setUpdating(true);
    try {
      await apiClient.post('/addOrUpdateForumReaction', {
        command: 'addOrUpdateForumReaction',
        forum_id: forumId,
        user_id: userId,
        reaction_type: reactionType,
      });

      if (onSuccess) {

        await onSuccess();
      }
    } catch (err) {

    } finally {
      setUpdating(false);

    }
  };

  return { updateReaction, updating };
};

export const ForumReactions = ({ forumId, userId }) => {
  const valid = !!forumId && !!userId;

  const {
    reactionsCount,
    userReaction,
    totalReactions,
    fetching,
    fetchReactions,
  } = useFetchForumReactionsCount(valid ? forumId : null, valid ? userId : null);

  const {
    updateReaction,
    updating,
  } = useUpdateForumReaction(valid ? forumId : null, valid ? userId : null, valid ? fetchReactions : undefined);

  useEffect(() => {
    if (valid) {

      fetchReactions();
    }
  }, [fetchReactions, valid]);

  return {
    reactionsCount,
    userReaction,
    totalReactions,
    fetching,
    updating,
    updateReaction: valid ? updateReaction : () => { },
    refetchReactions: valid ? fetchReactions : () => { },
  };
};

export const updateForumReaction = async (forumId, userId, reactionType) => {
  try {
    await apiClient.post('/addOrUpdateForumReaction', {
      command: 'addOrUpdateForumReaction',
      forum_id: forumId,
      user_id: userId,
      reaction_type: reactionType,
    });
    return { success: true };
  } catch (error) {
    console.error('[updateForumReaction] error:', error);
    return { success: false };
  }
};

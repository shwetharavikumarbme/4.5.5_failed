import { useState, useCallback } from 'react';
import apiClient from '../ApiClient';
import { getSignedUrl } from './signedUrls';
import { Image } from 'react-native';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import companyImage from '../../images/homepage/buliding.jpg';

const defaultImageUriCompany = Image.resolveAssetSource(companyImage).uri;
const defaultImageUriFemale = Image.resolveAssetSource(femaleImage).uri;
const defaultImageUriMale = Image.resolveAssetSource(maleImage).uri;

export const useForumReactionUsers = (forumId) => {
  const [getting, setGetting] = useState(false);
  const [usersByReaction, setUsersByReaction] = useState([]);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [currentReactionType, setCurrentReactionType] = useState('All');

  const enrichWithProfileUrls = async (users) => {
    const signedUrlPromises = users.map((user) =>
      user.fileKey ? getSignedUrl(user.user_id, user.fileKey) : Promise.resolve(null)
    );

    const signedUrlsList = await Promise.all(signedUrlPromises);

    return users.map((user, index) => {
      const signedUrl = signedUrlsList[index];
      let profileUrl = signedUrl?.[user.user_id] || '';

      if (!profileUrl) {
        if (user.user_type === 'company') {
          profileUrl = defaultImageUriCompany;
        } else if (user.user_gender === 'Female') {
          profileUrl = defaultImageUriFemale;
        } else {
          profileUrl = defaultImageUriMale;
        }
      }

      return {
        ...user,
        profileUrl,
      };
    });
  };

  const fetchUsers = useCallback(async (reactionType = 'All', highlightReactId = null) => {
    if (!forumId) return;
    setGetting(true);
    try {
      setCurrentReactionType(reactionType);
  
      const response = await apiClient.post('/listAllForumReactions', {
        command: 'listAllForumReactions',
        forum_id: forumId,
        reaction_type: reactionType,
        reaction_id: highlightReactId,
      });
  
      let rawUsers = response.data.user_reactions || [];
      const highlightedUser = response.data.reaction_id_response || null;
console.log('rawUsers',rawUsers)
      if (highlightedUser) {
        const highlightId = highlightedUser.reaction_id;
        rawUsers = rawUsers.filter((u) => u.reaction_id !== highlightId);
      }
  
      const allToEnrich = highlightedUser ? [highlightedUser, ...rawUsers] : rawUsers;
      const enrichedAll = await enrichWithProfileUrls(allToEnrich);
  
      setUsersByReaction(enrichedAll);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);
  
    } catch (err) {
      console.error('[ReactionUsers] Fetch error:', err);
    } finally {
      setGetting(false);
    }
  }, [forumId]);
  

  const loadMoreUsers = useCallback(async () => {
    if (!forumId || !lastEvaluatedKey || getting) return;
    setGetting(true);
    try {
      const response = await apiClient.post('/listAllForumReactions', {
        command: 'listAllForumReactions',
        forum_id: forumId,
        reaction_type: currentReactionType,
        lastEvaluatedKey,
      });

      const rawUsers = response.data.user_reactions || [];
      const enrichedUsers = await enrichWithProfileUrls(rawUsers);

      setUsersByReaction((prev) => [...prev, ...enrichedUsers]);
      setLastEvaluatedKey(response.data.lastEvaluatedKey || null);

    } catch (err) {
      console.error('[ReactionUsers] Pagination error:', err);
    } finally {
      setGetting(false);
    }
  }, [forumId, currentReactionType, lastEvaluatedKey, getting]);

  // ✅ Add this reset function
  const resetUsers = () => {
    setUsersByReaction([]);
    setLastEvaluatedKey(null);
    setCurrentReactionType('All');
  };

  return {
    usersByReaction,
    fetchUsers: (type, highlightId = null) => fetchUsers(type, highlightId),
    loadMoreUsers,
    getting,
    lastEvaluatedKey,
    resetUsers, // 👈 expose it
  };
};


import { EventRegister } from 'react-native-event-listeners';
import apiClient from '../ApiClient';

export default function useForumReactions(myId) {
  const handleReactionUpdate = async (forumId, reactionType, item = {}) => {
    const payload = {
      command: 'addOrUpdateForumReaction',
      forum_id: forumId,
      user_id: myId,
      reaction_type: reactionType,
    };

    try {
      const res = await apiClient.post('/addOrUpdateForumReaction', payload);

      EventRegister.emit('onForumReactionUpdated', {
        forum_id: forumId,
        user_id: myId,
        reaction_type: reactionType,
        previous_reaction: item?.userReaction ?? null,
      });

    } catch (err) {
    
    }
  };

  return {
    handleReactionUpdate,
  };
}



export const reactionConfig = [
  { type: 'Like', emoji: '👍', color: 'text-blue-600', label: 'Like', outlineIcon: 'thumb-up-outline' },
  { type: 'Insightful', emoji: '💡', color: 'text-yellow-500', label: 'Insightful', outlineIcon: 'lightbulb-on-outline' },
  { type: 'Support', emoji: '🤝', color: 'text-green-500', label: 'Support', outlineIcon: 'handshake-outline' },
  { type: 'Funny', emoji: '😂', color: 'text-yellow-400', label: 'Funny', outlineIcon: 'emoticon-excited-outline' },
  { type: 'Thanks', emoji: '🙏', color: 'text-rose-500', label: 'Thanks', outlineIcon: 'hand-heart-outline' },
];
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ReactionBar = ({ onSelect, config, userReaction, updating }) => {
    return (
        <View
            style={{
                flexDirection: 'row',
                padding: 8,
                backgroundColor: '#fff',
                borderRadius: 40,
                elevation: 6,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                marginTop: 8,
                position: 'absolute',
                left: 0,
                top: -70
            }}
        >
            {config.map(({ type, emoji,label }) => {
                const isSelected = userReaction === type;
                return (
                    <TouchableOpacity
                        key={type}
                        disabled={updating}
                        onPress={() => onSelect(type)}
                        style={{
                            borderRadius: 30,
                            paddingHorizontal: 10,
                            paddingVertical:4,
                            backgroundColor: isSelected ? '#e0f2f1' : 'transparent',
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        <Text style={{ fontSize: 8 }}>{label}</Text>

                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

export const ForumReactionSelector = ({ userReaction,
    totalReactions,
    forumId,
    onUpdateReaction,
    updating,
    updateReaction, }) => {
    const [showReactions, setShowReactions] = useState(false);

    const reactionConfig = [
        { type: 'Like', emoji: '👍', label: 'Like' },
        { type: 'Insightful', emoji: '💡', label: 'Insightful' },
        { type: 'Support', emoji: '🤝', label: 'Support' },
        { type: 'Funny', emoji: '😂', label: 'Funny' },
        { type: 'Thanks', emoji: '🙏', label: 'Thanks' },
    ];

    const handleSelectReaction = async (type) => {
        const newReaction = userReaction === type ? 'None' : type;
        if (onUpdateReaction) {
            await onUpdateReaction(newReaction); // From list item
        } else if (updateReaction) {
            await updateReaction(newReaction);   // From hook
        }
        setShowReactions(false); // hide after selection
    };

    const selectedReaction = reactionConfig.find(r => r.type === userReaction && userReaction !== 'None');

    return (
        <View style={{ paddingVertical: 8 }}>
            {/* Tappable reaction summary */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowReactions(!showReactions)}
                style={{
                    padding: 4,
                    // borderRadius: 8,
                    // backgroundColor: '#f2f2f2',
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                {selectedReaction ? (
                    <>
                        <Text style={{ fontSize: 18 }}>{selectedReaction.emoji} </Text>
                        <Text style={{ fontSize: 12, color: '#777' }}>{selectedReaction.label}</Text>
                    </>
                ) : (
                    <>
                        <Text style={{ fontSize: 12, color: '#777', marginRight: 6 }}>React: </Text>
                        <Icon name="thumb-up-outline" size={20} color="#999" />
                    </>
                )}
            </TouchableOpacity>

            {/* Reaction bar shown only on tap */}
            {showReactions && (
                <ReactionBar
                    config={reactionConfig}
                    userReaction={userReaction}
                    updating={updating}
                    onSelect={handleSelectReaction}
                />
            )}
        </View>
    );
};

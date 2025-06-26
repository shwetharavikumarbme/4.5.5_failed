import React from 'react';
import { Dimensions, FlatList } from 'react-native';

const SkeletonLoader = ({ type }) => {
    const screenWidth = Dimensions.get('window').width;

    const renderSkeletonItem = (_, index) => {
        if (type === 'jobs') {
            return (
                <SkeletonPlaceholder key={`job-${index}`} borderRadius={14}
                    backgroundColor="#DDDDDD"
                    highlightColor="#F2F2F2"
                >
                    <SkeletonPlaceholder.Item
                        backgroundColor="#fff"
                        borderRadius={14}
                        padding={10}
                        width={210}
                        marginLeft={index === 0 ? 10 : 0}
                        marginRight={10}
                        borderWidth={0.5}
                        borderColor="#ddd"
                    >
                        <SkeletonPlaceholder.Item
                            width={200}
                            height={250}
                            borderRadius={14}
                            padding={5}
                            alignSelf="center"
                        >
                            <SkeletonPlaceholder.Item
                                width="100%"
                                height={150}
                                borderRadius={14}
                                marginBottom={15}
                            />
                            <SkeletonPlaceholder.Item gap={6}>
                                <SkeletonPlaceholder.Item width={140} height={20} borderRadius={14} />
                                <SkeletonPlaceholder.Item width={100} height={15} borderRadius={14} />
                                <SkeletonPlaceholder.Item width={120} height={15} borderRadius={14} />
                            </SkeletonPlaceholder.Item>
                        </SkeletonPlaceholder.Item>
                    </SkeletonPlaceholder.Item>
                </SkeletonPlaceholder>
            );
        }

        if (type === 'companies') {
            return (
                <SkeletonPlaceholder key={`company-${index}`} borderRadius={14}
                    backgroundColor="#DDDDDD"
                    highlightColor="#F2F2F2"
                >
                    <SkeletonPlaceholder.Item
                        width={300}
                        height={100}
                        borderRadius={14}
                        marginRight={10}
                        padding={10}
                        backgroundColor="#fff"
                        borderWidth={0.5}
                        borderColor="#ddd"
                        flexDirection="row"
                        alignItems="center"
                    >
                        <SkeletonPlaceholder.Item
                            width={70}
                            height={70}
                            borderRadius={14}
                            marginRight={12}
                        />
                        <SkeletonPlaceholder.Item gap={8}>
                            <SkeletonPlaceholder.Item width={130} height={20} borderRadius={14} />
                            <SkeletonPlaceholder.Item width={110} height={15} borderRadius={14} />
                            <SkeletonPlaceholder.Item width={120} height={15} borderRadius={14} />
                        </SkeletonPlaceholder.Item>
                    </SkeletonPlaceholder.Item>
                </SkeletonPlaceholder>
            );
        }

        if (type === 'trendingPosts' || type === 'latestPosts') {
            const cardWidth = screenWidth / 2 - 15;
            return (
                <SkeletonPlaceholder key={`${type}-${index}`}
                    backgroundColor="#DDDDDD"
                    highlightColor="#F2F2F2"
                >
                    <SkeletonPlaceholder.Item
                        width={cardWidth}
                        height={250}
                        marginVertical={5}
                        marginHorizontal={5}
                        borderRadius={14}
                        padding={10}
                        alignSelf="center"
                        borderWidth={0.5}
                        borderColor="#ddd"
                    >
                        <SkeletonPlaceholder.Item
                            width="100%"
                            height={100}
                            borderRadius={14}
                            marginBottom={14}
                        />
                        <SkeletonPlaceholder.Item width="75%" height={20} borderRadius={14} marginBottom={6} />
                        <SkeletonPlaceholder.Item width="85%" height={15} borderRadius={14} marginBottom={6} />
                        <SkeletonPlaceholder.Item width="45%" height={15} borderRadius={14} />
                    </SkeletonPlaceholder.Item>
                </SkeletonPlaceholder>
            );
        }

        if (type === 'banner') {
            return (
                <SkeletonPlaceholder key={`banner-${index}`} backgroundColor="#E1E9EE" highlightColor="#F2F8FC">
                    <SkeletonPlaceholder.Item
                        width={screenWidth - 8}
                        height={216}
                        borderRadius={14}
                        marginHorizontal={4}
                    />
                </SkeletonPlaceholder>
            );
        }

        if (type === 'comments') {
            const skeletonItems = Array.from({ length: 10 });

            return (
                <FlatList
                    data={skeletonItems}
                    keyExtractor={(_, index) => `comment-skeleton-${index}`}
                    scrollEnabled={false}
                    renderItem={({ index }) => (
                        <SkeletonPlaceholder
                            key={`comment-${index}`}
                            backgroundColor="#DDDDDD"
                            highlightColor="#F2F2F2"
                            borderRadius={10}
                        >
                            <SkeletonPlaceholder.Item
                                flexDirection="column"
                                padding={10}
                                backgroundColor="#fff"
                                marginBottom={5}
                                borderRadius={10}
                            >
                                <SkeletonPlaceholder.Item flexDirection="row" alignItems="flex-start" gap={10}>
                                    <SkeletonPlaceholder.Item
                                        width={40}
                                        height={40}
                                        borderRadius={20}
                                        marginRight={10}
                                    />
                                    <SkeletonPlaceholder.Item flex={1}>
                                        <SkeletonPlaceholder.Item flexDirection="row" justifyContent="space-between" marginBottom={6}>
                                            <SkeletonPlaceholder.Item width={100} height={15} borderRadius={8} />
                                        </SkeletonPlaceholder.Item>
                                        <SkeletonPlaceholder.Item width={200} height={12} borderRadius={6} marginBottom={5} />
                                    </SkeletonPlaceholder.Item>
                                </SkeletonPlaceholder.Item>
                            </SkeletonPlaceholder.Item>
                        </SkeletonPlaceholder>
                    )}
                />
            );
        }

        return null;
    };

    return (
        <FlatList
            data={Array.from({ length: 4 })} 
            keyExtractor={(_, index) => `${type}-skeleton-${index}`}
            renderItem={renderSkeletonItem}
            horizontal={type !== 'comments'} 
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={{ flexGrow: 1 }}
        />
    );
};

export default SkeletonLoader;

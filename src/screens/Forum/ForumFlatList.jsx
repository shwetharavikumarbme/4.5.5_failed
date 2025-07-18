import React from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
} from 'react-native';

const ForumFlatList = ({
  localPosts,
  searchResults,
  searchTriggered,
  searchQuery,
  isRefreshing,
  handleRefresh,
  renderItem,
  listRef,
  scrollY,
  setScrollY,
  showSearchBar,
  toggleSearchBar,
  activeReactionForumId,
  setActiveReactionForumId,
  searchInputRef,
  viewabilityConfig,
  onViewableItemsChanged,
  handleEndReached,
  loadingMore,
  styles,
}) => {
  const data = !searchTriggered || searchQuery.trim() === '' ? localPosts : searchResults;

  return (
    <FlatList
      data={data}
      ref={listRef}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={3}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={100}
      windowSize={7}
      removeClippedSubviews={true}
      scrollEventThrottle={16}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: '10%' }}

      onScrollBeginDrag={() => {
        Keyboard.dismiss();
        searchInputRef?.current?.blur?.();
        if (showSearchBar && !searchTriggered) {
          toggleSearchBar?.();
        }
      }}

      onScroll={(e) => {
        const currentScrollY = e.nativeEvent.contentOffset.y;
        if (Math.abs(currentScrollY - scrollY) > 5 && activeReactionForumId) {
          setActiveReactionForumId(null);
        }
        setScrollY(currentScrollY);
      }}

      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }

      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}

      keyExtractor={(item, index) => `${item.forum_id}-${index}`}

      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}

      ListHeaderComponent={
        searchTriggered && searchResults.length > 0 ? (
          <Text style={styles.companyCount}>
            {searchResults.length} results found
          </Text>
        ) : null
      }

      ListEmptyComponent={
        searchTriggered && searchResults.length === 0 ? (
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
  );
};

export default ForumFlatList;

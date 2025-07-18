import { useCallback } from 'react';

export default function useForumRefresh({
  isConnected,
  isRefreshingRef,
  setIsRefreshing,
  setSearchQuery,
  setSearchTriggered,
  setSearchResults,
  setSearchCount,
  setExpandedTexts,
  setLocalPosts,
  setNewJobCount,
  setShowNewJobAlert,
  updateLastCheckedTime,
  searchInputRef,
  fetchPosts
}) {
  const handleRefresh = useCallback(async () => {
    if (!isConnected || isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    setSearchQuery('');
    setSearchTriggered(false);
    setSearchResults([]);
    setSearchCount(0);

    if (searchInputRef?.current) {
      searchInputRef?.current.blur();
    }

    setExpandedTexts(false);
    setLocalPosts([]);
    setNewJobCount(0);
    setShowNewJobAlert(false);
    updateLastCheckedTime(Math.floor(Date.now() / 1000));

    await fetchPosts(null);

    setIsRefreshing(false);

    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 300);
  }, [
    isConnected,
    isRefreshingRef,
    setIsRefreshing,
    setSearchQuery,
    setSearchTriggered,
    setSearchResults,
    setSearchCount,
    setExpandedTexts,
    setLocalPosts,
    setNewJobCount,
    setShowNewJobAlert,
    updateLastCheckedTime,
    searchInputRef,
    fetchPosts,
  ]);

  return handleRefresh;
}

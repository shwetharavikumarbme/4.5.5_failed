import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Linking, Image, SafeAreaView, Keyboard, ScrollView, RefreshControl, useWindowDimensions, Dimensions } from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { TextInput } from 'react-native-gesture-handler';
import { COLORS } from '../../assets/Constants';
import dayjs from 'dayjs';
import Fuse from 'fuse.js';
import apiClient from '../ApiClient';
import AppStyles from '../../assets/AppStyles';


const AllEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobImageUrls, setJobImageUrls] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const searchInputRef = useRef(null);
  const [lastKey, setLastKey] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLimit, setSuggestionsLimit] = useState(5);
  const [allJobsData, setAllJobsData] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const getFuzzySuggestions = (inputText) => {
    const fuse = new Fuse(allJobsData, {
      keys: ['title'],
      threshold: 0.5,
      distance: 100,
    });

    const results = fuse.search(inputText);
    const uniqueMap = new Map();

    results.forEach(res => {
      const { title } = res.item;
      const key = `${title}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, res.item);
      }
    });

    return Array.from(uniqueMap.values());
  };



  const handleInputChange = (text) => {
    setSearchQuery(text);
    setSuggestionsLimit(5);

    if (text.trim() === '') {
      setSuggestions([]);
      return;
    }
    const matchedSuggestions = getFuzzySuggestions(text);
    setSuggestions(matchedSuggestions);

  };

  const fetchAllResources = async () => {
    try {
      const requestData = { command: 'getAllEvents' };
      const res = await apiClient.post('/getAllEvents', requestData);
      const jobPosts = res?.data?.response || [];

      setAllJobsData(jobPosts);

    } catch (error) {

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchAllResources();
  }, []);

  const handleRefresh = async () => {
    setHasMore(true);
    setLastKey(null);
    setSuggestions([]);
    setSearchResults([]);
    setSearchTriggered(false);
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    setEvents([]);

    await fetchEvents();
  };


  const fetchJobImageUrls = async (jobs) => {
    const urlsObject = {};

    await Promise.all(
      jobs.map(async (job) => {
        const postId = job.event_id;
        const fileKey = job.fileKey;

        if (fileKey) {
          try {
            const res = await apiClient.post('/getObjectSignedUrl', {
              command: 'getObjectSignedUrl',
              key: fileKey,
            });

            urlsObject[postId] = res.data;
          } catch (error) {

          }
        } else {

        }
      })
    );

    setJobImageUrls((prevUrls) => ({ ...prevUrls, ...urlsObject }));
  };



  const handleSearch = async (text) => {
    const trimmedText = text.trim();
    setSearchQuery(text); 

    if (!trimmedText) {

      return;
    }
    setLoading(true);
    setSearchTriggered(true);
    setSuggestions([]);
    try {
      const requestData = {
        command: 'searchEvents',
        searchQuery: trimmedText,
      };

      const res = await apiClient.post('/searchEvents', requestData);

      if (res.data.status === 'success' && Array.isArray(res.data.response)) {
        const Results = res.data.response;

        setSearchResults(Results)
        setLastKey(null);
        setHasMore(false);

        await fetchJobImageUrls(Results);
      } else {

      }
    } catch (error) {

    } finally {
      setLoading(false);

    }
  };


  const fetchEvents = async (key = null, isRefresh = false) => {
    if (loadingMore || (!isRefresh && !hasMore)) return;

    try {
      if (isRefresh) setRefreshing(true);
      else if (key) setLoadingMore(true);
      else setLoading(true);

      const body = {
        command: 'getAllEvents',
        limit: 5,
        ...(key && { lastEvaluatedKey: key }),
      };

      const response = await apiClient.post('/getAllEvents', body);

      if (response.data.status === 'success') {
        const newEvents = response.data.response || [];
        const newKey = response.data.lastEvaluatedKey || null;

        setEvents((prev) => {
          const merged = isRefresh ? newEvents : [...prev, ...newEvents];
          const uniqueEvents = Array.from(new Map(merged.map(e => [e.event_id, e])).values());
          return uniqueEvents;
        });

        setLastKey(newKey);
        setHasMore(newKey !== null);

        await fetchJobImageUrls(newEvents)
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    fetchEvents();
  }, []);




  const renderItem = ({ item }) => {
    const isExpired = dayjs().isAfter(dayjs(item.end_date));
  
    return (
      <TouchableOpacity
        style={[
          styles.eventContainer,
          isExpired && styles.expiredEventContainer,
        ]}
        activeOpacity={1}
      >
        <View style={styles.iconAndTitle}>
          {jobImageUrls[item.event_id] && (
            <FastImage
              source={{ uri: jobImageUrls[item.event_id] }}
              style={[
                styles.eventIcon,
                isExpired && styles.expiredImage,
              ]}
              resizeMode="contain"
            />
          )}
        </View>
        <Text
          style={[
            styles.details1,
            isExpired && styles.expiredText,
          ]}
        >
          {item.title}
        </Text>
  
        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <View style={styles.lableIconContainer}>
              <Icon name="calendar" size={18} color="black" style={styles.icon} />
              <Text style={[styles.label, isExpired && styles.expiredText]}>Date</Text>
            </View>
            <Text style={[styles.colon, isExpired && styles.expiredText]}>:</Text>
            <Text style={[styles.details, isExpired && styles.expiredText]}>
              {dayjs(item.start_date).format("DD")} to {dayjs(item.end_date).format("DD MMM YYYY")}
            </Text>
          </View>
  
          <View style={styles.detailItem}>
            <View style={styles.lableIconContainer}>
              <Icon name="map-marker" size={18} color="black" style={styles.icon} />
              <Text style={[styles.label, isExpired && styles.expiredText]}>Location</Text>
            </View>
            <Text style={[styles.colon, isExpired && styles.expiredText]}>:</Text>
            <Text style={[styles.details, isExpired && styles.expiredText]}>{item.location}</Text>
          </View>
  
          <View style={styles.detailItem}>
            <View style={styles.lableIconContainer}>
              <Icon name="clock" size={18} color="black" style={styles.icon} />
              <Text style={[styles.label, isExpired && styles.expiredText]}>Time</Text>
            </View>
            <Text style={[styles.colon, isExpired && styles.expiredText]}>:</Text>
            <Text style={[styles.details, isExpired && styles.expiredText]}>{item.time}</Text>
          </View>
        </View>
  
        {!isExpired && (
          <TouchableOpacity
            onPress={() => Linking.openURL(item.registration_link)}
            style={[AppStyles.Postbtn, { alignSelf: 'flex-start', marginHorizontal: 10, marginTop: 0 }]}
          >
            <Text style={AppStyles.PostbtnText}>Explore</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };
  


  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#075cab" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={AppStyles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#075cab" />
        </TouchableOpacity>
        <View style={AppStyles.searchContainer}>
          <View style={AppStyles.inputContainer}>
            <TextInput
              style={AppStyles.searchInput}
              placeholder="Search"
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={handleInputChange}
              onSubmitEditing={() => {
                if (searchQuery.trim() !== '') {
                  handleSearch(searchQuery);
                  setSearchTriggered(true);
                  setSuggestions([]);
                  searchInputRef.current?.blur();
                }
              }}
              returnKeyType="search"
            />
            {searchQuery.trim() !== '' ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchTriggered(false);
                  setSearchResults([]);
                  setSuggestions([]);

                }}
                style={AppStyles.iconButton}
              >
                <Icon name="close-circle" size={20} color="gray" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                // onPress={() => {
                //   if (searchQuery.trim() !== '') {
                //     handleSearch(searchQuery);
                //     setSearchTriggered(true);
                //     setSuggestions([]);
                //     searchInputRef.current?.blur();

                //   }
                // }}
                style={AppStyles.searchIconButton}
              >
                <Icon name="magnify" size={20} color="#075cab" />
              </TouchableOpacity>

            )}
          </View>
        </View>
      </View>

      {suggestions.length > 0 && (
        <ScrollView
          style={styles.suggestionContainer}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ backgroundColor: '#fff' }}
        >
          {suggestions.slice(0, suggestionsLimit).map((item, index) => {
            const words = item?.title.split(/\s+/); // split by spaces
            const wordToSearch = words[0]; // or use any logic to pick a word

            return (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSearchQuery(wordToSearch);
                  handleSearch(wordToSearch);
                  setSuggestions([]);
                  setSuggestionsLimit(5);
                  searchInputRef.current?.blur();
                }}
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionTitle}>{item?.title}</Text>
              </TouchableOpacity>
            );
          })}

          {suggestions.length > suggestionsLimit && (
            <TouchableOpacity
              onPress={() => setSuggestionsLimit(suggestionsLimit + 5)}
              style={styles.loadMoreButton}
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}


      <FlatList
        data={!searchTriggered || searchQuery.trim() === '' ? events : searchResults}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.event_id}-${index}`}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        contentContainerStyle={{ padding: 10,paddingBottom:'20%' }}
        onEndReached={() => {
          if (hasMore && !loadingMore) fetchEvents(lastKey);
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color="#075cab" style={{ marginVertical: 10 }} />
          ) : null
        }
        ListHeaderComponent={
          <>
            <Text style={styles.events}>Upcoming Events</Text>
            {searchTriggered && searchResults.length > 0 && (
              <Text style={styles.companyCount}>
                {searchResults.length} results found
              </Text>
            )}
          </>
        }
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  suggestionContainer: {
    position: 'absolute',
    top: 50, // adjust depending on your header/search bar height
    width: '95%',
    alignSelf: 'center',
    maxHeight: '45%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  suggestionItem: {
    padding: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  loadMoreButton: {
    padding: 12,
    alignItems: 'center',

  },

  loadMoreText: {
    color: '#075cab',
    fontWeight: 'bold',
  },

  suggestionTitle: {
    fontSize: 14,
    color: 'black'
  },
  suggestionJob: {
    fontSize: 12,
    color: '#888'
  },

  expiredEventContainer: {
    backgroundColor: '#e0e0e0',
  },

  expiredText: {
    color: '#888',
  },

  expiredImage: {
    opacity: 0.6,
  },

  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',

  },
  mainContainer: {
    flex: 1,
    backgroundColor: 'whitesmoke',
  },
  eventContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
    padding:8,
    paddingBottom:15,
  },
  events: {
    fontSize: 16,
    textAlign: 'left',
    color: '#075cab',
    fontWeight: '700',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  companyCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    padding: 5
  },
  noEventsText: {
    fontSize: 18,
    textAlign: 'center',
    color: 'black',
    margin: 20,

  },
  iconAndTitle: {
    width: '100%',
    height: 16/9 * Dimensions.get('window').width * 0.3,
    alignItems: 'center',
    paddingVertical: 5
  },
  eventIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    marginBottom: 10,
    
  },
  detailsContainer: {
    marginBottom: 15,
    paddingHorizontal: 10
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  colon: {
    width: 20, // Fixed width for the colon
    textAlign: 'center', // Center the colon
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    alignSelf: 'flex-start',

  },
  label: {
    flex: 1, // Take up available space
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',
  },
  icon: {
    opacity: 0.8,
    marginRight: 5,
  },
  lableIconContainer: {
    flexDirection: 'row',
    flex: 1, // Take up available space
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',
  },
  details: {
    flex: 2, // Take the remaining space
    flexShrink: 1,
    color: 'black',
    fontWeight: '400',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',
  },
  details1: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
    marginLeft: 10,
    paddingVertical: 10,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },

  backButton: {
    alignSelf: 'center',
    padding: 10

  },
  
  
});

export default AllEvents;

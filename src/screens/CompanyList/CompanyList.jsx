

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Modal, Linking, Platform, Share, RefreshControl, Alert, SafeAreaView, Animated, FlatList, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { COLORS } from '../../assets/Constants';
import FastImage from 'react-native-fast-image';
import default_image from '../../images/homepage/buliding.jpg'
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../ApiClient';
import Fuse from 'fuse.js';
import { useNetwork } from '../AppUtils/IdProvider';
import { useConnection } from '../AppUtils/ConnectionProvider';
import { getSignedUrl } from '../helperComponents.jsx/signedUrls';

const defaultImage = Image.resolveAssetSource(default_image).uri;
const CompanyListScreen = () => {
  const navigation = useNavigation();
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();

  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyImageUrls, setCompanyImageUrls] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollViewRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [visibleSuggestionCount, setVisibleSuggestionCount] = useState(5);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [allCompanies, setallCompanies] = useState([]);
  useScrollToTop(scrollViewRef);

  const [loadingMore, setLoadingMore] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMoreCompanies, setHasMoreCompanies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [companyCount, setCompanyCount] = useState(0);

  const fetchAllCompanies = async () => {
    const requestData = { command: 'listAllCompanies' };
    try {
      const response = await apiClient.post('/listAllCompanies', requestData);

      setallCompanies(response.data.response);

    } catch (error) {

    }
  };


  useEffect(() => {
    fetchAllCompanies();
  }, [])

  const handleInputChange = (text) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setSearchTriggered(false);
      setSuggestions([]);
      return;
    }
    const matchedSuggestions = getFuzzySuggestions(text);
    setSuggestions(matchedSuggestions);

  };

  const getFuzzySuggestions = (inputText) => {
    const fuse = new Fuse(allCompanies, {
      keys: ['company_name'],
      threshold: 0.5,
      distance: 100,
    });
    const results = fuse.search(inputText);
    const uniqueMap = new Map();
    results.forEach(res => {
      const { company_name } = res.item;
      if (!uniqueMap.has(company_name)) {
        uniqueMap.set(company_name, res.item);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const withTimeout = (promise, timeout = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };

  const fetchCompanies = async (lastEvaluatedKey = null) => {
    if (!isConnected) {

      return;
    }
    lastEvaluatedKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command: "listAllCompanies",
        limit: 10,
        ...(lastEvaluatedKey && { lastEvaluatedKey }),
      };

      const res = await withTimeout(apiClient.post('/listAllCompanies', requestData), 10000);

      const companies = res.data.response || [];
      setCompanyCount(res.data.count);

      const sortedCompanies = companies.sort((a, b) => b.company_created_on - a.company_created_on);
      setCompanies((prev) => [...prev, ...sortedCompanies]);
      setFilteredCompanies((prevFiltered) => [...prevFiltered, ...sortedCompanies]);

      if (res.data.lastEvaluatedKey) {
        setLastEvaluatedKey(res.data.lastEvaluatedKey);
        setHasMoreCompanies(true);
      } else {
        setHasMoreCompanies(false);
      }
      const urlPromises = companies.map(company =>
        getSignedUrl(company.company_id, company.fileKey)
      );
      const signedUrlsArray = await Promise.all(urlPromises);
      const rawSignedUrlMap = Object.assign({}, ...signedUrlsArray);

      const signedUrlMap = Object.entries(rawSignedUrlMap).reduce((acc, [id, url]) => {
        acc[id] = url || defaultImage;
        return acc;
      }, {});
  
      setCompanyImageUrls((prevUrls) => ({ ...prevUrls, ...signedUrlMap }));
  
  
    } catch (error) {

    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  };






  useEffect(() => {
    fetchCompanies();
  }, []);


  const searchInputRef = useRef(null);

  const handleRefresh = useCallback(async () => {
    if (!isConnected) {

      return;
    }
    setIsRefreshing(true);
    setSearchQuery('');

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setCompanies([]);
    setFilteredCompanies([]);
    setCompanyImageUrls({});
    setHasMoreCompanies(true);
    setLastEvaluatedKey(null);

    await fetchCompanies();
    setIsRefreshing(false);
  }, []);


  const [searchCount, setSearchCount] = useState(0);

  const handleSearch = async (text) => {
    setSearchQuery(text);

    if (text.trim() === '') {
      setSearchResults([]);
      setSearchCount(0);
      return;
    }

    setLoading(true);

    try {
      const requestData = {
        command: "searchCompanies",
        searchQuery: text,
      };
      const res = await withTimeout(apiClient.post('/searchCompanies', requestData), 10000);
      const companies = res.data.response || [];

      const count = res.data.count || companies.length;


      const urlPromises = companies.map(company =>
        getSignedUrl(company.company_id, company.fileKey)
      );
      const signedUrlsArray = await Promise.all(urlPromises);
      const signedUrlMap = Object.assign({}, ...signedUrlsArray);


      setCompanyImageUrls((prevUrls) => {
        const mergedUrls = { ...prevUrls, ...signedUrlMap };
        // Now update results
        setSearchResults(companies);
        setSearchCount(count);
        return mergedUrls;
      });
    } catch (error) {
      console.error('Error searching companies:', error);
    } finally {
      setLoading(false);
    }
  };






  const shareJob = async (company) => {
    if (!company?.company_id) {

      return;
    }

    try {
      const baseUrl = 'https://bmebharat.com/company/';
      const companyUrl = `${baseUrl}${company.company_id}`;

      const result = await Share.share({
        message: companyUrl,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {

        } else {

        }
      } else if (result.action === Share.dismissedAction) {

      }
    } catch (error) {

    }
  };


  const getSlicedTitle = (title) => {
    const maxLength = 28;
    if (title.length > maxLength) {
      return title.slice(0, maxLength).trim() + '...';
    }
    return title;
  };

  const navigateToDetails = (company) => {
    navigation.navigate('CompanyDetails', { userId: company.company_id });
  };


  const renderCompanyItem = ({ item, index }) => {
    const imageUrl = companyImageUrls[item.company_id];
    const resizeMode = imageUrl?.includes('buliding.jpg') ? 'cover' : 'contain';

    return (
      <TouchableOpacity activeOpacity={1} style={{ paddingHorizontal: 10 }}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => navigateToDetails(item)} >

          <TouchableOpacity style={styles.cardImage1} onPress={() => navigateToDetails(item)} activeOpacity={0.8} >
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.cardImage}
              resizeMode={resizeMode}
              onError={() => { }}
            />
          </TouchableOpacity>
          <View style={styles.textContainer}>
            {myId === item.company_id && (
              <TouchableOpacity style={styles.createPostButton}>
                <Icon
                  onPress={() => navigation.navigate('CompanyProfile')}
                  name="pencil"
                  size={25}
                  color="#075cab"
                />
              </TouchableOpacity>
            )}

            <View style={styles.row}>
              <View style={styles.labelAndIconContainer}>
                <Icon name='office-building-marker-outline' size={20} marginRight={5} color={'black'} />
                <Text style={styles.label}>Company </Text>
              </View>
              <Text style={styles.colon}>:</Text>

              <Text style={styles.value}>
                {(typeof item.company_name === 'object' ? item.company_name.value : item.company_name || "")}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={styles.labelAndIconContainer}>
                <Icon name="domain" size={20} color="black" style={styles.icon} />
                <Text style={styles.label}>Category </Text>
              </View>
              <Text style={styles.colon}>:</Text>

              <Text style={styles.value}>
                {getSlicedTitle(typeof item.category === 'object' ? item.category.value : item.category || "")}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={styles.labelAndIconContainer}>
                <Icon name="map-marker" size={20} color="black" style={styles.icon} />
                <Text style={styles.label}>City          </Text>
              </View>
              <Text style={styles.colon}>:</Text>

              <Text style={styles.value}>
                {item.company_located_city || ""}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={styles.labelAndIconContainer}>
                <Icon name="map-marker" size={20} color="black" style={styles.icon} />
                <Text style={styles.label}>State       </Text>
              </View>
              <Text style={styles.colon}>:</Text>

              <Text style={styles.value}>
                {item.company_located_state || ""}
              </Text>
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.viewMoreButton} onPress={() => navigateToDetails(item)}>
                <Text style={styles.viewMore}>See more...</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareJob(item)} style={styles.shareButton}>
                <Icon name="share" size={24} color="#075cab" />
              </TouchableOpacity>
            </View>

          </View>

        </TouchableOpacity>
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container1}>
      <View style={styles.container} >
        {/* Search and Refresh */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#075cab" />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder='Search'
                ref={searchInputRef}
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
              />
              {searchTriggered ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchTriggered(false);
                    setSearchResults([]);
                    setSearchCount(0);
                    setSuggestions([]);

                  }}
                  style={styles.iconButton}
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
                  style={styles.searchIconButton}
                >
                  <Icon name="magnify" size={20} color="#075cab" />
                </TouchableOpacity>

              )}
            </View>
          </View>
        </View>
        {(searchQuery.trim() !== '') && suggestions.length > 0 && (
          <ScrollView
            style={styles.suggestionContainer}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ backgroundColor: '#fff' }}
          >
            {suggestions.slice(0, visibleSuggestionCount).map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSearchQuery(item.company_name);
                  handleSearch(item.company_name);
                  setSuggestions([]);
                  setSearchTriggered(true);
                  searchInputRef.current?.blur();

                }}
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionText}>
                  {item.company_name}
                </Text>
              </TouchableOpacity>
            ))}
            {visibleSuggestionCount < suggestions.length && (
              <TouchableOpacity
                onPress={() => setVisibleSuggestionCount(prev => Math.min(prev + 5, suggestions.length))} // Ensure it doesn't exceed total suggestions
                style={styles.loadMoreButton}
              >
                <Text style={styles.loadMoreText}>Load more...</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            searchInputRef.current?.blur?.();
            setSuggestions([]);
          }}
        >
          {!loading ? (
            <FlatList
              data={!searchTriggered || searchQuery.trim() === '' ? filteredCompanies : searchResults}
              renderItem={renderCompanyItem}
              ref={scrollViewRef}
              keyExtractor={(item, index) => `${item.company_id}-${index}`}
              onEndReached={() => {
                if (!searchQuery && hasMoreCompanies && !loadingMore) {
                  fetchCompanies(lastEvaluatedKey);
                }
              }}
              contentContainerStyle={{paddingBottom:'20%'}}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}

              onScrollBeginDrag={() => {
                Keyboard.dismiss();
                searchInputRef.current?.blur?.();
                setSuggestions([]);
              }}
              ListFooterComponent={() =>
                loadingMore && (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color="#075cab" />
                  </View>
                )
              }
              ListHeaderComponent={
                <View >
                  {!loading && (
                    <Text style={styles.companyCount}>
                      {searchTriggered ? `${searchCount} Companies found` : `${companyCount} Companies found`}
                    </Text>
                  )}
                </View>
              }


              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
              }
              ListEmptyComponent={
                (!searchTriggered && companies.length === 0) ||
                  (searchTriggered && searchResults.length === 0) ? (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Text style={{ fontSize: 16, color: '#666' }}>No companies found</Text>
                  </View>
                ) : null
              }
            />


          ) : (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#075cab" />
            </View>
          )}

        </TouchableWithoutFeedback>
      </View>
    </SafeAreaView>
  )

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',

  },
  searchIconButton: {
    padding: 8,
    overflow: 'hidden',
    backgroundColor: '#e6f0ff',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  iconButton: {
    padding: 8,
    overflow: 'hidden',
    backgroundColor: '#e6f0ff',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,

  },
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
    zIndex: 999, // ensures it's above FlatList
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },

  suggestionText: {
    fontSize: 15,
    color: '#333',
  },

  loadMoreButton: {
    padding: 12,
    alignItems: 'center',

  },

  loadMoreText: {
    color: '#075cab',
    fontWeight: 'bold',
  },

  container1: {
    flex: 1,
    backgroundColor: 'whitesmoke',

  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom:20
  },

  icon1: {
    opacity: 0.8,

  },

  icon: {
    opacity: 0.8,
    marginRight: 5,
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'whitesmoke',

  },
  backButton: {
    padding: 10,
    alignSelf: 'center',

  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'center',
    padding: 10,
    borderRadius: 10,

  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 10,
    backgroundColor: 'whitesmoke',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    backgroundColor: "whitesmoke",
    paddingHorizontal: 15,
    borderRadius: 10,
    height: 30,
  },

  shareButton: {
    // marginTop: 15,
    // alignSelf: 'flex-end',
    padding: 10,
    marginLeft: 10,
  },

  labelAndIconContainer: {
    flexDirection: 'row',
    flex: 1, // Take up available space
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,

  },

  value: {
    flex: 2, // Take the remaining space
    flexShrink: 1,
    color: 'black',
    fontWeight: '400',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
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
  colon: {
    width: 20, // Fixed width for the colon
    textAlign: 'center', // Center the colon
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    alignSelf: 'flex-start',

  },

  title: {
    fontSize: 15,
    color: 'black',
    marginLeft: 8,
    lineHeight: 20,
    flexShrink: 1,
  },

  jobCount: {
    fontSize: 13,
    fontWeight: '300',
    marginVertical: 10,
    marginHorizontal: 10,
    color: 'black',
  },

  refreshIconContainer: {
    marginLeft: 10,
  },
  companyCount: {
    fontSize: 13,
    fontWeight: '400',
    color: 'black',
    padding: 5,
    paddingHorizontal: 10
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    top: -12
  },

  createPostButton: {
    position: 'absolute',
    top: -140,
    right: -5,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: "white",
    borderRadius: 10,
  },
  cardImage: {
    width: 140,
    height: 140,
    borderRadius: 100,
    margin: 'auto',
    top: 10,
    resizeMode: 'contain',
  },
  cardImage1: {
    width: 140,
    height: 140,
    borderRadius: 100,
    margin: 'auto',

  },

  textContainer: {
    padding: 16,
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',        // Align buttons in a row
    justifyContent: 'space-between',  // Spread buttons across the row
    // marginTop: 10,               // Add top margin for some space
    alignItems: 'center',        // Vertically center buttons
  },
  viewMoreButton: {
    // marginTop: 10,
    backgroundColor: COLORS.primary,
    // borderRadius: 4,
    flex: 1,
    // marginRight: 10,
  },
  viewMore: {
    // padding: 20,
    color: "#075cab",
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
  },
  noCompaniesText: {
    color: 'black', margin: 'auto', textAlign: "center", marginTop: 300, fontSize: 18, fontWeight: '400'
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: 10,
  },
});

export default CompanyListScreen;
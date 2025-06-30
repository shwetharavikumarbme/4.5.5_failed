

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, Modal, Linking, Platform, SafeAreaView, TextInput, Keyboard, FlatList, RefreshControl, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import maleImage from '../../images/homepage/dummy.png';
import femaleImage from '../../images/homepage/female.jpg';
import apiClient from '../ApiClient';
import Fuse from 'fuse.js';
import { useNetwork } from '../AppUtils/IdProvider';
import { useConnection } from '../AppUtils/ConnectionProvider';
import AppStyles from '../../assets/AppStyles';


const resolvedMaleImage = Image.resolveAssetSource(maleImage).uri;
const resolvedFemaleImage = Image.resolveAssetSource(femaleImage).uri;

const CompanyListJobCandidates = () => {
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();

  const [posts, setPosts] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const scrollViewRef = useRef(null)
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchResults, setSearchResults] = useState([]);



  const withTimeout = (promise, timeout = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };

   const debounceTimeout = useRef(null);
  
    const handleDebouncedTextChange = useCallback((text) => {
      setSearchQuery(text);
    
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    
      const trimmedText = text.trim();
    
      if (trimmedText === '') {
        setSearchTriggered(false);
        setSearchResults([]);
        return;
      }
    
      if (trimmedText.length < 3) {
        setSearchTriggered(false);
        setSearchResults([]);
        return;
      }
    
      debounceTimeout.current = setTimeout(() => {
        handleSearch(trimmedText);  // Call actual search function
      }, 300);
    }, [handleSearch]);
    
  
  const handleSearch = async (text) => {
    if (!isConnected) {
      showToast('No internet connection', 'error')
      return;
    }
    setSearchQuery(text);
    if (text?.trim() === '') {
      setSearchTriggered(false);
      setSearchResults([]);
      return;
    }

    try {
      const requestData = {
        command: "searchJobProfiles",
        searchQuery: text,

      };
      const res = await withTimeout(apiClient.post('/searchJobProfiles', requestData), 10000);

      const jobs = res.data.response || [];

      const count = res.data.count || jobs.length;

      setSearchResults(jobs);
      await fetchJobImageUrls(jobs);

    } catch (error) {

    } finally {
      setSearchTriggered(true);

    }
  };

  const handlerefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSearchQuery('');
    setSearchResults([]);
    setSearchTriggered(false);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setPosts([]);
    setHasMoreJobs(true);
    setLastEvaluatedKey(null);

    await fetchJobs();

    setIsRefreshing(false);
  }, []);


  const fetchJobImageUrls = async (jobs) => {
    const urlsObject = {};

    await Promise.all(
      jobs.map(async (job) => {
        const userId = job.user_id;

        if (!userId) {
          console.warn('Missing user_id for job:', job);
          return;
        }

        // Select default image based on gender
        const defaultImage =
          job.gender && job.gender.toLowerCase() === 'female'
            ? resolvedFemaleImage
            : resolvedMaleImage;

        if (job.fileKey) {
          try {
            const res = await apiClient.post('/getObjectSignedUrl', {
              command: 'getObjectSignedUrl',
              key: job.fileKey,
            });

            urlsObject[userId] = res.data || defaultImage;
          } catch (error) {
            urlsObject[userId] = defaultImage;
          }
        } else {
          urlsObject[userId] = defaultImage;
        }
      })
    );


    setImageUrls((prev) => ({
      ...prev,
      ...urlsObject,
    }));
  };





  const fetchJobs = async (lastEvaluatedKey = null) => {
    if (loading || loadingMore) return;

    lastEvaluatedKey ? setLoadingMore(true) : setLoading(true);

    try {
      const requestData = {
        command: "getAllJobProfiles",
        limit: 10,
      };

      if (lastEvaluatedKey) {
        requestData.lastEvaluatedKey = lastEvaluatedKey;
      }

      const res = await withTimeout(apiClient.post('/getAllJobProfiles', requestData), 10000);

      if (res.data.response === "No job profiles found!") {
        setHasMoreJobs(false);
        return;
      }

      const jobs = Array.isArray(res.data.response) ? res.data.response : [];

      if (jobs.length > 0) {
        setPosts((prevPosts) => [...prevPosts, ...jobs]);

        // Reuse image fetching here
        fetchJobImageUrls(jobs);

        if (res.data.lastEvaluatedKey) {
          setLastEvaluatedKey(res.data.lastEvaluatedKey);
        } else {
          setHasMoreJobs(false);
        }
      }
    } catch (error) {
      // Handle fetch error silently
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  };







  useEffect(() => {
    fetchJobs()
  }, [])

  const searchInputRef = useRef(null);


  useScrollToTop(scrollViewRef);
  // Separate renderJob function
  const renderJob = ({ item }) => {
    const imageUrl = imageUrls[item.user_id];

    return (
      <TouchableOpacity activeOpacity={1}>
        <TouchableOpacity
          key={item.user_id}
          style={styles.postContainer}
          activeOpacity={1}
          onPress={() => navigation.navigate('CompanyGetJobCandidates', { posts: item, imageUrl })}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrls[item.user_id] }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>


          <View style={styles.labelValueContainer}>
            <Text numberOfLines={1} style={styles.name}>
              {(`${item.first_name || ""} ${item.last_name || ""}`)}
            </Text>
            <View style={styles.detailContainer}>
              <Text numberOfLines={1} style={styles.label}>Expert In</Text>
              <Text numberOfLines={1} style={styles.value}>: {(item.expert_in || "")}</Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.label}>Experience</Text>
              <Text style={styles.value}>: {item.work_experience || ""}</Text>
            </View>
            <View style={styles.detailContainer}>
              <Text style={styles.label}>Preferred cities</Text>
              <Text numberOfLines={1} style={styles.value}>: {(item.city || "")}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={AppStyles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#075cab" />
        </TouchableOpacity>
        <View style={AppStyles.searchContainer}>
          <View style={AppStyles.inputContainer}>

            <TextInput
              ref={searchInputRef}
              style={AppStyles.searchInput}
              placeholder="Search"
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={handleDebouncedTextChange}

            />
            {searchQuery.trim() !== '' ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchTriggered(false);
                  setSearchResults([]);
            

                }}
                style={AppStyles.iconButton}
              >
                <Icon name="close-circle" size={20} color="gray" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
        
                style={AppStyles.searchIconButton}
              >
                <Icon name="magnify" size={20} color="#075cab" />
              </TouchableOpacity>

            )}
          </View>
        </View>
      </View>


        {!loading ? (
          <FlatList
            data={!searchTriggered || searchQuery.trim() === '' ? posts : searchResults}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handlerefresh} />
            }
            showsVerticalScrollIndicator={false}
            renderItem={renderJob} // Use renderJob here
            keyExtractor={(item, index) => `${item.user_id}-${index}`} // Ensure unique keys by combining user_id and index
            onEndReached={() => hasMoreJobs && fetchJobs(lastEvaluatedKey)}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() =>
              loadingMore && (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="small" color="#075cab" />
                </View>
              )
            }
            ListHeaderComponent={
              <View>
                {searchTriggered && searchResults.length > 0 && (
                  <Text style={styles.companyCount}>
                    {searchResults.length} results found
                  </Text>
                )}
              </View>
            }
            ListEmptyComponent={
              (searchTriggered && searchResults.length === 0) ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ fontSize: 16, color: '#666' }}>No job seekers found</Text>
                </View>
              ) : null
            }
          />

        ) : (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#075cab" />
          </View>
        )}

    </SafeAreaView>
  );

}
const styles = StyleSheet.create({

  container: {
    flex: 1,
    padding: 10,
    backgroundColor: 'whitesmoke',
  },
  nofound: {
    flex: 1,
    alignContent: "center",
    justifyContent: "center",
    margin: "auto",
  },
  label: {
    width: '35%', // Occupies 35% of the row
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    // textAlign: 'justify',
    alignSelf: "flex-start"
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 10,

  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: "black",
    marginLeft: 10
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    flex: 1,
  },
  value: {
    flex: 1,
    flexShrink: 1,
    color: 'black',
    fontWeight: '400',
    fontSize: 15,
    textAlign: 'justify',
  },
  backButton: {
    alignSelf: 'center',
    padding: 10,

  },

  postContainer: {
    marginBottom: 5,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.6,
    borderColor: '#ccc',

  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  detailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#0d6efd', // iOS shadow color
    shadowOffset: { width: 0, height: 2 }, // iOS shadow offset
    // shadowOpacity: 0.2, // iOS shadow opacity
    // shadowRadius: 3, // iOS shadow radius
    borderRadius: 10,
    paddingHorizontal: 10,

  },
  labelValueContainer: {
    flex: 1,
    width: '100%',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    padding: 10,
    textAlign: 'center',
    marginBottom: 20,
  },
  phoneNumber: {
    color: '#075cab',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#075cab',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stickyContactButton: {
    position: 'absolute',
    top: 70,
    right: 10,
    backgroundColor: '#075cab',
    borderRadius: 50,
    padding: 15,
  },
});



export default CompanyListJobCandidates;
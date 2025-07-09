import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView,
  Image,
  Animated
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

import Icon1 from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import NotificationSettings from '../AppUtils/NotificationSetting';
import { useNetwork } from '../AppUtils/IdProvider';
import apiClient from '../ApiClient';
import { useConnection } from '../AppUtils/ConnectionProvider';

const ProductsList = React.lazy(() => import('../Products/ProductsList'));
const JobListScreen = React.lazy(() => import('../Job/JobListScreen'));
const UserHomeScreen = React.lazy(() => import('../UserHomeScreen'));
const PageView = React.lazy(() => import('../Forum/PagerViewForum'));


const tabNameMap = {
  CompanyJobList: "Jobs",
  Home3: 'Home',
};
const tabConfig = [
  { name: "Home", component: UserHomeScreen, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
  { name: "Jobs", component: JobListScreen, focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline', iconComponent: Icon },
  { name: "Feed", component: PageView, focusedIcon: 'rss', unfocusedIcon: 'rss-box', iconComponent: Icon },
  { name: "Products", component: ProductsList, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
  { name: "Settings", component: UserSettingScreen, focusedIcon: 'cog', unfocusedIcon: 'cog-outline', iconComponent: Icon },
];

const NavigationItem = ({ icon, label, onPress, showSubItems, children, onToggle }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={1} >
    <View style={styles.drawerItem}>
      <Icon name={icon} size={20} color="#075cab" />
      <Text style={styles.drawerLabel}>{label}</Text>
      {children && children.length > 0 && onToggle && (
        <Icon
          name={showSubItems ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="black"
          style={styles.dropdownIcon}
        />
      )}
    </View>
    {showSubItems && <View style={styles.subItemsContainer}>{children}</View>}

  </TouchableOpacity>

);

const UserSettingScreen = () => {
  const navigation = useNavigation();
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();

  const profile = useSelector(state => state.CompanyProfile.profile);
  const parentNavigation = navigation.getParent();
  const currentRouteName = parentNavigation?.getState()?.routes[parentNavigation.getState().index]?.name;
  const [expandedItem, setExpandedItem] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const [deviceInfo, setDeviceInfo] = useState({
    appVersion: '',
  });

  const hasSubscription = myData?.subscription_expires_on
    ? Math.floor(Date.now() / 1000) < myData.subscription_expires_on
    : false;

  useEffect(() => {
    // Fetch device information
    const fetchDeviceInfo = async () => {

      const appVersion = await DeviceInfo.getVersion();


      setDeviceInfo({

        appVersion: appVersion,

      });
    };

    fetchDeviceInfo();
  }, []);


  useEffect(() => {
    const fetchTransactions = async () => {
      if (myId) {

        try {
          const response = await apiClient.post(
            '/getUsersTransactions',
            {
              command: "getUsersTransactions",
              user_id: myId,
            }
          );

          // Filter only completed transactions
          const completedTransactions = response.data.response.filter(
            transaction => transaction.transaction_status === "captured"
          );
          setTransactions(completedTransactions);
        } catch (err) {

        } finally {

        }
      }
    };

    fetchTransactions();
  }, [myId]);



  const handleToggle = (item) => {
    setExpandedItem(expandedItem === item ? null : item);
  };

  const navigateToAppliedJob = () => navigation.navigate('UserJobApplied');
  const navigateToProfileCreation = () => navigation.navigate('UserJobProfile');
  const navigateToYourForumList = () => navigation.navigate('YourForumList');
  const navigateToBlockedUsers = () => navigation.navigate('BlockedUsers');
  const navigateToAboutUs = () => navigation.navigate('AboutUs');
  const navigateToPrivacyPolicy = () => navigation.navigate('InPrivacyPolicy');
  const navigateCancellationPolicy = () => navigation.navigate('CancellationPolicy')
  const navigateToLegalPolicy = () => navigation.navigate('LegalPolicy')
  const navigateToTermsandconditions = () => navigation.navigate('TermsAndConditions')
  const navigateToSubscription = () => navigation.navigate('UserSubscription');
  const navigateToMYResources = () => navigation.navigate('Resourcesposted');
  const navigateToMyQueriesList = () => navigation.navigate('MyEnqueries');
  const navigateToSubscriptionList = () => navigation.navigate('YourSubscriptionList');

  const DrawerList = [

    { icon: 'id-card', label: 'Job profile', onPress: navigateToProfileCreation },
    { icon: 'id-card', label: 'Applied jobs', onPress: navigateToAppliedJob },
    { icon: 'chat-question', label: 'My enquiries', onPress: navigateToMyQueriesList },

    {
      icon: 'rss', label: 'My posts', onPress: () => handleToggle('My posts'), subItems: [
        { label: 'Forum', onPress: navigateToYourForumList },
        { label: 'Resources', onPress: navigateToMYResources },
      ]
    },

    { icon: 'account-cancel', label: 'Blocked users', onPress: navigateToBlockedUsers },
    { icon: 'card-account-details', label: 'Subscription', onPress: navigateToSubscription },
    hasSubscription && transactions.length > 0 && {
      icon: 'card-account-details',
      label: 'My subscriptions',
      onPress: navigateToSubscriptionList,
    },

    { icon: 'information', label: 'About us', onPress: navigateToAboutUs },

    {
      icon: 'shield-lock', label: 'Policies', onPress: () => handleToggle('Policies'), subItems: [
        { label: 'Privacy policy', onPress: navigateToPrivacyPolicy },
        { label: 'Cancellation policy', onPress: navigateCancellationPolicy },
        { label: 'Legal compliance', onPress: navigateToLegalPolicy },
        { label: 'Terms and conditions', onPress: navigateToTermsandconditions },
      ]
    },
  ];


  const handleUpdate = () => {
    navigation.navigate('UserProfileUpdate', {
      profile,
      imageUrl: profile?.imageUrl,
    });
  };
  const scrollOffsetY = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollOffsetY } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        console.log('offsetY:', offsetY); // ✅ This logs the current scroll offset
      },
    }
  );
  useEffect(() => {
    const loadGamificationData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('gamificationData');
        if (savedData) {
          const { score: savedScore, badgeUnlocked: savedBadge } = JSON.parse(savedData);
          setScore(savedScore);
          setBadgeUnlocked(savedBadge);
        }
      } catch (error) {
        console.error('Failed to load gamification data', error);
      }
    };
    loadGamificationData();
  }, []);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [badgeUnlocked, setBadgeUnlocked] = useState(false);
  const [score, setScore] = useState(0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [280, 80],
    extrapolate: 'clamp',
  });

  const imageSize = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [140, 40],
    extrapolate: 'clamp',
  });

  const imageMarginTop = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [20, 10],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const collapsedHeaderOpacity = scrollY.interpolate({
    inputRange: [100, 180],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const textOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const translateY = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });





  return (

    <SafeAreaView style={styles.container1} >

      {/* <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} >
          <Icon name="arrow-left" size={24} color="#075cab" />
        </TouchableOpacity>
      </View > */}
          <Animated.View 
          
          style={[
        styles.collapsedHeader,
        { 
          opacity: collapsedHeaderOpacity,
          transform: [{ translateY }]
        }
        
      ]}>
        <View style={styles.collapsedContent}>
          <FastImage
            source={{ uri: profile?.imageUrl }}
            style={styles.collapsedImage}
          />
          <View>
            <Text style={styles.collapsedName}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            {badgeUnlocked && (
              <View style={styles.badgeContainer}>
                <Icon name="shield-check" size={16} color="#FFD700" />
                <Text style={styles.badgeText}>Career Expert</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>




      <Animated.ScrollView contentContainerStyle={[styles.container, { paddingBottom: '44%', }]}
        showsVerticalScrollIndicator={false}  
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
>

        {isConnected ? (
           <Animated.View style={[
            styles.header,
            { 
              height: headerHeight,
              opacity: headerOpacity 
            }
          ]}>
            <Animated.View style={[
              styles.imageContainer,
              { 
                width: imageSize,
                height: imageSize,
                marginTop: imageMarginTop
              }
            ]}>
              <FastImage
                source={{ uri: profile?.imageUrl }}
                style={styles.profileImage}
              />
              {badgeUnlocked && (
                <View style={styles.floatingBadge}>
                  <Icon name="crown" size={24} color="#FFD700" />
                </View>
              )}
            </Animated.View>
  
            <Animated.View style={{ opacity: textOpacity }}>
              <Text style={styles.name}>
                {profile?.first_name} {profile?.last_name}
              </Text>
              <Text style={styles.points}>Career Points: {score}</Text>
            </Animated.View>
            <TouchableOpacity onPress={() => { navigation.navigate("UserProfile") }}> 
            <Text>profile</Text>
            </TouchableOpacity>
          </Animated.View>
  

        ) : null}
        {DrawerList.filter(Boolean).map((item, index) => (
          <NavigationItem
            key={index}
            icon={item.icon}
            label={item.label}
            onPress={() => {
              if (isConnected) {
                item.onPress?.();
              } else {

              }
            }}
            showSubItems={expandedItem === item.label}
            onToggle={() => handleToggle(item.label)}
          >
            {item.subItems &&
              item.subItems.map((subItem, subIndex) => (
                <TouchableOpacity
                  key={subIndex}
                  onPress={() => {
                    if (isConnected) {
                      subItem.onPress?.();
                    } else {

                    }
                  }}
                >
                  <Text style={styles.subItem}>{subItem.label}</Text>
                </TouchableOpacity>
              ))}
          </NavigationItem>
        ))}


        <NotificationSettings />

        <View style={styles.appversion}>
          <Text style={styles.appText}>App Version: {deviceInfo.appVersion}</Text>
        </View>

      </Animated.ScrollView>

      <View style={styles.bottomNavContainer}>
        {tabConfig.map((tab, index) => {
          const isFocused = currentRouteName === tab.name;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => navigation.navigate(tab.name)}
              style={styles.navItem}
              activeOpacity={0.8}

            >
              <tab.iconComponent
                name={isFocused ? tab.focusedIcon : tab.unfocusedIcon}
                size={22}
                color={isFocused ? '#075cab' : 'black'}
              />
              <Text style={[styles.navText, { color: isFocused ? '#075cab' : 'black' }]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </SafeAreaView>

  );

};

const styles = StyleSheet.create({

  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 80,
    marginBottom: 10,
  },
  detailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    overflow: 'hidden',

  },
  label: {
    flex: 1,
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },

  title1: {
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'row',  // Align label and detail in a row
    alignItems: 'center',  // Center the items vertically
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  colon: {
    width: 40, // Fixed width for the colon
    textAlign: 'center', // Center the colon
    color: '#808080',
    fontWeight: '500',
    fontSize: 15,
    alignSelf: 'flex-start',
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

  profileContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    // borderRadius: 16,
    padding: 10,
    // marginHorizontal: 10,
    // marginTop: 10,
    elevation: 4,
    shadowColor: '#aaa',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backgroundColor: '#fff',

  },

  editProfileButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 8,
  },
  editProfileText: {
    color: '#075cab',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  profileDetails: {
    flex: 1,
    alignItems: 'flex-start',
    // marginLeft: 30,
    marginTop: 10

  },

  bottomNavContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },


  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navText: {
    fontSize: 12,
    color: 'black',
    marginTop: 2,
  },

  drawerItem: {
    marginTop: 5,
    flexDirection: 'row',
    fontSize: 15,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  container: {
    flexGrow: 1,
    backgroundColor: "whitesmoke",
  },

  versionContainer: {
    marginVertical: 20, // Adjusts the margin to give space between version and the Logout Button
    alignItems: 'center', // Centers the version text
    justifyContent: 'center',
  },
  version: {
    fontSize: 16,
    color: '#075cab', // You can change this to any color you prefer
    fontWeight: '500',
  },
  drawerLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: "#075cab",
    fontWeight: "500",
    marginVertical: 8,
  },

  subItemsContainer: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginHorizontal: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    // borderBottomRightRadius: 5,
    // borderBottomLeftRadius: 5,
  },

  appversion: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50

  },
  appText: {
    fontSize: 13,
    color: 'gray',
    // marginBottom: 5,
    fontWeight: '400',
    textAlign: 'justify',
    alignItems: 'center',

  },


  subItem: {
    padding: 5,
    marginHorizontal: 30,
    marginVertical: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "black",
    // backgroundColor:'red'

  },

  container1: {
    flex: 1,
    backgroundColor: "whitesmoke",

  },


  dropdownIcon: {
    marginLeft: 'auto',
    color: '#075cab',
  },



  collapsedProfile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: '#ffffff',
    zIndex: 10,
    elevation: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dcdcdc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    justifyContent: 'center',
  },

  miniProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  miniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  miniImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1.2,
    borderColor: '#7baee9',
    backgroundColor: '#e6f0ff',
  },

  miniName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e2a38',
    // letterSpacing: 0.4,

  },

  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#075cab',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  collapsedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#fff',
    zIndex: 100,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsedImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#075cab',
  },
  collapsedName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  imageContainer: {
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  points: {
    fontSize: 16,
    color: '#fff',
    marginTop: 5,
    textAlign: 'center',
  },
  floatingBadge: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    elevation: 3,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  badgeText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 5,
    fontWeight: '600',
  },
  content: {
    padding: 15,
    paddingBottom: 100,
  },


});

export default UserSettingScreen;
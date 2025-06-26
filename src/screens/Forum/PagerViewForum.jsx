import React, { useEffect, useRef, useState } from 'react';
import { View, Button, SafeAreaView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import Latest from './Latest';
import Trending from './Trending';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const JobListScreen = React.lazy(() => import('../Job/JobListScreen'));
const ProductsList = React.lazy(() => import('../Products/ProductsList'));
const CompanySettingScreen = React.lazy(() => import('../Profile/CompanySettingScreen'));
const CompanyHomeScreen = React.lazy(() => import('../CompanyHomeScreen'));



const PageView = () => {
  const navigation = useNavigation();

  const tabConfig = [
    { name: "Home", component: CompanyHomeScreen, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
    { name: "Jobs", component: JobListScreen, focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline', iconComponent: Icon },
    { name: "Feed", component: PageView, focusedIcon: 'rss', unfocusedIcon: 'rss-box', iconComponent: Icon },
    { name: "Products", component: ProductsList, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
    { name: "Settings", component: CompanySettingScreen, focusedIcon: 'cog', unfocusedIcon: 'cog-outline', iconComponent: Icon },
  ];

  const parentNavigation = navigation.getParent();
  const currentRouteName = parentNavigation?.getState()?.routes[parentNavigation.getState().index]?.name;

  const [activeTab, setActiveTab] = useState(0);
  const [mountedTabs, setMountedTabs] = useState({
    latest: true,
    trending: false,
  });

  const pagerRef = useRef(null);
  const latestScrollRef = useRef(null);
  const trendingScrollRef = useRef(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (activeTab === 0 && latestScrollRef.current) {
        latestScrollRef.current.scrollToTop?.();
        latestScrollRef.current.handleRefresh?.();
      } else if (activeTab === 1 && trendingScrollRef.current) {
        trendingScrollRef.current.scrollToTop?.();
        trendingScrollRef.current.handleRefresh?.();
      }
    });

    return unsubscribe;
  }, [navigation, activeTab]);


  const handlePageChange = (e) => {
    const position = e.nativeEvent.position;
    setActiveTab(position);

    if (position === 1 && !mountedTabs.trending) {
      setMountedTabs((prev) => ({ ...prev, trending: true }));
    }
  };

  const goToTrending = () => {
    pagerRef.current.setPage(1);
    setActiveTab(1);
  };

  const goToLatest = () => {
    pagerRef.current.setPage(0);
    setActiveTab(0);
  };

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.tabIndicatorContainer}>
        <TouchableOpacity onPress={goToLatest} style={styles.tabItem}>
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>Latest</Text>
          {activeTab === 0 && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={goToTrending} style={styles.tabItem}>
          <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>Trending</Text>
          {activeTab === 1 && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageChange}
        overdrag
        pageMargin={10}
      >
        <View key="1">
          {mountedTabs.latest && (
            <Latest
              isPageFocused={activeTab === 0}
              scrollRef={latestScrollRef}
            />
          )}
        </View>
        <View key="2">
          {mountedTabs.trending && (
            <Trending
              isPageFocused={activeTab === 1}
              scrollRef={trendingScrollRef}
            />
          )}
        </View>
      </PagerView>
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

  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  modalText: { marginLeft: 10, fontSize: 18 },


  container: {
    flex: 1,
    backgroundColor: 'whitesmoke',
    paddingTop: 10,
  },
  tabIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    // borderBottomWidth: 1,
    // borderColor: '#e0e0e0',
    // backgroundColor: 'red',
  },
  tabItem: {
    flex: 1, // equal space for each tab
    alignItems: 'center',
    // paddingBottom: 6,
    // backgroundColor:'red',
    padding: 5,

  },
  tabText: {
    fontSize: 16,
    color: 'gray',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#075cab',
    fontWeight: 'bold',
  },
  tabUnderline: {
    marginTop: 6,
    height: 1,
    width: 100, // fixed equal underline width
    backgroundColor: '#075cab',
    //   borderRadius: 2,
  },
  pagerView: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
});




export default PageView;

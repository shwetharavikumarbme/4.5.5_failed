

import React, { useRef, useState, useEffect, } from 'react';
import { SafeAreaView, View, FlatList, Image, TouchableOpacity, Text, RefreshControl, Keyboard, } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import Video from 'react-native-video';
import Banner01 from './Banner1';
import Banner03 from './Banner3';
import Banner02 from './Banner2';

import { updateCompanyProfile } from './Redux/MyProfile/CompanyProfile_Actions';
import { useDispatch, useSelector } from 'react-redux';
import apiClient from './ApiClient';

import useFetchData from './helperComponents.jsx/HomeScreenData';
import { useNetwork } from './AppUtils/IdProvider';
import { useConnection } from './AppUtils/ConnectionProvider';
import { getSignedUrl, getTimeDisplayForum, getTimeDisplayHome } from './helperComponents.jsx/signedUrls';
import AppStyles, { styles } from '../assets/AppStyles';
import { ForumPostBody } from './Forum/forumBody';
import FastImage from 'react-native-fast-image';

const CompanySettingScreen = React.lazy(() => import('./Profile/CompanySettingScreen'));
const ProductsList = React.lazy(() => import('./Products/ProductsList'));
const PageView = React.lazy(() => import('./Forum/PagerViewForum'));
const JobListScreen = React.lazy(() => import('./Job/JobListScreen'));


const tabNameMap = {
  CompanyJobList: "Jobs",
  Home3: 'Home',
};
const tabConfig = [
  { name: "Home", component: CompanyHomeScreen, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
  { name: "Jobs", component: JobListScreen, focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline', iconComponent: Icon },
  { name: "Feed", component: PageView, focusedIcon: 'rss', unfocusedIcon: 'rss-box', iconComponent: Icon },
  { name: "Products", component: ProductsList, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
  { name: "Settings", component: CompanySettingScreen, focusedIcon: 'cog', unfocusedIcon: 'cog-outline', iconComponent: Icon },
];



const CompanyHomeScreen = React.memo(() => {
  const { myId, myData } = useNetwork();
  const { isConnected } = useConnection();
  const currentRouteName = useNavigationState((state) => {
    const route = state.routes[state.index];

    return route.name;
  });
  const profile = useSelector(state => state.CompanyProfile.profile);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef(null);
  const [isProfileFetched, setIsProfileFetched] = useState(false);
  const scrollOffsetY = useRef(0);


  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetY.current = offsetY;
  };



  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await apiClient.post('getUnreadNotificationCount', {
          command: 'getUnreadNotificationCount',
          user_id: myId,
        });

        if (response.status === 200) {

          setUnreadCount(response.data.count);

        }
      } catch (error) {

      }
    };

    fetchUnreadCount();

    const intervalId = setInterval(() => {
      fetchUnreadCount();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [myId]);


  const handleRefresh = async () => {
    if (isConnected) {
      setIsRefreshing(true);
      await refreshData();
      setIsRefreshing(false);
    }
  };

  const renderJobCard = ({ item }) => {
    if (!item || item.isEmpty) return null;

    const { post_id, job_title, experience_required, Package, job_post_created_on, companyAvatar } = item;
    const imageUrl = jobImageUrls?.[item.post_id];

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("JobDetail", { post_id, imageUrl })}
        activeOpacity={0.85}
        style={styles.eduCard}
      >
        <View style={styles.eduCardLeft}>
          {imageUrl ? (
            <FastImage
              source={{ uri: imageUrl, priority: FastImage.priority.normal }}
              cache="immutable"
              style={styles.eduImage}
              resizeMode='contain'
              onError={() => { }}
            />
          ) : (
            <View style={[AppStyles.avatarContainer, { backgroundColor: companyAvatar?.backgroundColor }]}>
              <Text style={[AppStyles.avatarText, { color: companyAvatar?.textColor }]}>
                {companyAvatar?.initials}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.eduCardRight}>
          <Text numberOfLines={1} style={styles.eduTitle}>
            {job_title || "Job Title"}
          </Text>
          <Text style={styles.eduSubText}>
            <Text style={styles.label}>Experience: </Text>
            {experience_required?.slice(0, 15) || "N/A"}
          </Text>

          <Text style={styles.eduSubText}>
            <Text style={styles.label}>Package: </Text>
            {Package || 'Not disclosed'}
          </Text>

          <Text style={styles.eduSubText}>
            <Text style={styles.label}>Posted: </Text>
            {getTimeDisplayHome(job_post_created_on) || 'Not disclosed'}
          </Text>

        </View>
      </TouchableOpacity>
    );
  };

  const renderForumCard = ({ item }) => {
    if (!item || !item.forum_id) return null;
    const AuthorImageUrl = authorImageUrls?.[item.forum_id]

    const rawHtml = (item.forum_body || '').trim();
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(rawHtml);
    const forumBodyHtml = hasHtmlTags ? rawHtml : `<p>${rawHtml}</p>`;

    const imageUrl = trendingImageUrls?.[item.forum_id] || latestImageUrls?.[item.forum_id];
    const isVideo = item.fileKey?.endsWith('.mp4');

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.articleCard}
        onPress={() => navigation.navigate("Comment", { forum_id: item.forum_id })}
      >
        <View style={styles.articleCardHeader}>
          {/* Vertical stack for badge, image, name */}
          <View >

            <View style={[styles.authorRow]}>
              <Image
                source={{ uri: AuthorImageUrl }}
                style={styles.authorImage}
                resizeMode="cover"
              />

              <View style={styles.authorInfo}>
                <Text
                  style={styles.authorName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.author || 'No Name'}
                </Text>

                <Text style={styles.badgeText}>{item.author_category || ''}</Text>

              </View>
            </View>
            <View >
              <Text style={styles.PostedLabel}>Posted on: <Text style={styles.articleTime}>{getTimeDisplayForum(item.posted_on)}</Text></Text>

            </View>

          </View>



          {/* Post image or video if available */}
          {imageUrl && (
            isVideo ? (
              <Video
                source={{ uri: imageUrl }}
                style={styles.articleMedia}
                resizeMode="cover"
                muted
                paused
              />
            ) : (
              <Image
                source={{ uri: imageUrl }}
                style={styles.articleMedia}
                resizeMode="cover"
              />
            )
          )}

        </View>


        <ForumPostBody
          html={item.forum_body}
          forumId={item?.forum_id}
          numberOfLines={4}
          textStyle={styles.articleExcerpt}
        />
      </TouchableOpacity>

    );
  };

  const renderProductCard = ({ item }) => {
    if (!item || !item.product_id) return null;

    const imageUrl = productImageUrls?.[item.product_id]
    return (
      <TouchableOpacity
        style={styles.card5}
        activeOpacity={1}
        onPress={() => handleAddProduct(item)}
      >

        <View style={styles.companyImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.companyImage}
            resizeMode='contain'

          />
        </View>

        <View style={styles.cardContent4}>
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={1} style={styles.eduTitle}>{item.title || ' '}</Text>
          </View>

          <Text numberOfLines={1} style={styles.modelText}>
            {/* <Text style={styles.label}>Model name: </Text> */}
            <Icon name="tag-outline" size={16} color='#666' /> {item.specifications.model_name || ' '}
          </Text>

          <Text style={styles.descriptionText} numberOfLines={1}>
            {/* <Text style={styles.label}>Description: </Text> */}
            <Icon name="text-box-outline" size={16} color='#666' /> {item.description || ' '}
          </Text>

          <Text numberOfLines={1} style={styles.companyNameText}>
            {/* <Text style={styles.label}>Company name: </Text> */}
            <Icon name="office-building-outline" size={16} color='#666' /> {item.company_name || ' '}</Text>

          {(item.price ?? '').toString().trim() !== '' ? (
            <View style={styles.priceRow}>
              <Text numberOfLines={1} style={styles.price}><Icon name="currency-inr" size={16} color='#666' />
                {item.price}</Text>
            </View>
          ) : (
            <Text style={styles.eduSubText}>₹ Not specified</Text>
          )}
        </View>

      </TouchableOpacity>
    );
  };

  const renderServiceCard = ({ item }) => {
    if (!item || !item.service_id) return null;

    const imageUrl = servicesImageUrls?.[item.service_id]

    return (
      <TouchableOpacity
        style={styles.card5}
        activeOpacity={1}
        onPress={() => handleAddservice(item)}
      >

        <View style={styles.companyImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.companyImage}
            resizeMode='contain'

          />
        </View>

        <View style={styles.cardContent4}>
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={1} style={styles.eduTitle}>{item.title || ' '}</Text>
          </View>

          <Text style={styles.descriptionText} numberOfLines={1}>
            {/* <Text style={styles.label}>Description: </Text> */}
            <Icon name="text-box-outline" size={16} color='#666' /> {item.description || ' '}
          </Text>

          <Text numberOfLines={1} style={styles.companyNameText}>
            {/* <Text style={styles.label}>Company name: </Text> */}
            <Icon name="office-building-outline" size={16} color='#666' /> {item.company_name || ' '}
          </Text>

          {(item.price ?? '').toString().trim() !== '' ? (
            <View style={styles.priceRow}>
              <Text numberOfLines={1} style={styles.price}><Icon name="currency-inr" size={16} color='#666' />
                {item.price} </Text>
            </View>
          ) : (
            <Text style={styles.eduSubText}>₹ Not specified</Text>
          )}
        </View>

      </TouchableOpacity>
    );
  };


  const {
    jobs,
    latestPosts,
    trendingPosts,
    products,
    services,
    isFetchingProducts,
    isFetchingServices,
    isFetchingJobs,
    isFetchingLatestPosts,
    isFetchingTrendingPosts,
    jobImageUrls,
    latestImageUrls,
    trendingImageUrls,
    productImageUrls,
    servicesImageUrls,
    authorImageUrls,
    refreshData,

  } = useFetchData({ shouldFetch: isProfileFetched });



  useEffect(() => {
    fetchProfile();
  }, [myId]);


  const allJobs = () => {
    navigation.navigate('Jobs');
  };

  const allProducts = () => {
    navigation.navigate('Products');
  };

  const allServices = () => {
    navigation.navigate('Services');
  };

  const handleAddservice = (service) => {
    setTimeout(() => {
      navigation.navigate('ServiceDetails', { service_id: service.service_id, company_id: service.company_id });

    }, 100);
  };

  const handleAddProduct = (product) => {
    setTimeout(() => {
      navigation.navigate('ProductDetails', { product_id: product.product_id, company_id: product.company_id });

    }, 100);
  };


  const fetchProfile = async () => {
    try {

      const response = await apiClient.post('/getCompanyDetails', {
        command: 'getCompanyDetails',
        company_id: myId,
      });

      if (response.data.status === 'success') {
        const profileData = response.data.status_message;

        if (profileData.fileKey?.trim()) {
          try {
            const res = await getSignedUrl('profileImage', profileData.fileKey);

            const signedUrl = res?.profileImage;
            profileData.imageUrl = signedUrl || null;

          } catch (imageErr) {
            profileData.imageUrl = null;
          }
        } else {
          profileData.imageUrl = null;
        }

        if (profileData.brochureKey?.trim()) {
          try {
            const brochureRes = await getSignedUrl('brochureFile', profileData.brochureKey);
            const signedBrochureUrl = brochureRes?.[profileData.brochureKey];
            profileData.brochureUrl = signedBrochureUrl || null;
          } catch (brochureErr) {
            profileData.brochureUrl = null;
          }
        } else {
          profileData.brochureUrl = null;
        }

        dispatch(updateCompanyProfile(profileData));
      } else {
      }
    } catch (error) {
      dispatch(updateCompanyProfile(null));
    } finally {
      setIsProfileFetched(true);
    }
  };




  const handleProfile = () => {
    if (!isConnected) {

      return;
    }
    navigation.navigate("Settings");
  };



  const handleMenuPress = () => {
    if (!isConnected) {
      return;
    }
    const parentNavigation = navigation.getParent();
    if (parentNavigation?.openDrawer) {
      parentNavigation.openDrawer();
    }
  };

  const [visibleItem, setVisibleItem] = useState(null);
  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const firstVisible = viewableItems?.[0];
    if (firstVisible?.item?.type) {
      setVisibleItem(firstVisible.item.type);
    }
  }).current;




  return (
    <SafeAreaView style={{ backgroundColor: 'whitesmoke', flex: 1 }}>

      <View style={styles.headerContainer}>

        <TouchableOpacity onPress={handleMenuPress} >
          <Icon name="menu" size={30} color="black" />
        </TouchableOpacity>

        <View style={styles.rightContainer}>
          <TouchableOpacity
            style={styles.notificationContainer}
            onPress={() => navigation.navigate('AllNotification', { userId: myId })}
          >
            <Icon name="bell-outline" size={26} color="black" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleProfile} style={styles.profileContainer} activeOpacity={0.8}>
            <View style={styles.detailImageWrapper}>
              {profile?.imageUrl ? (
                <FastImage
                  source={{ uri: profile?.imageUrl, priority: FastImage.priority.normal }}
                  cache="immutable"
                  style={styles.detailImage}
                  resizeMode='contain'
                  onError={() => { }}
                />
              ) : (
                <View style={[styles.avatarContainer, { backgroundColor: profile?.companyAvatar?.backgroundColor }]}>
                  <Text style={[styles.avatarText, { color: profile?.companyAvatar?.textColor }]}>
                    {profile?.companyAvatar?.initials}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

        </View>

      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        ref={flatListRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        contentContainerStyle={{ paddingBottom: '20%', backgroundColor: 'whitesmoke' }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        data={[
          { type: 'banner1' },
          { type: 'jobs', data: jobs },
          { type: 'banner2' },
          { type: 'trendingPosts', data: trendingPosts },
          { type: 'banner3' },
          { type: 'latestPosts', data: latestPosts },
          { type: 'products', data: products },
          { type: 'services', data: services },
        ]}

        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}

        renderItem={({ item }) => {
          switch (item.type) {

            case 'banner1':
              return <Banner01 isVisible={visibleItem === 'banner1'} />;


            case 'jobs':
              return (
                <TouchableOpacity activeOpacity={1} style={styles.cards}>

                  <>
                    <View style={styles.headingContainer}>
                      <Text style={styles.heading}>
                        Jobs  <Icon name="briefcase" size={19} color="#075cab" />
                      </Text>
                      <TouchableOpacity onPress={allJobs}>
                        <Text style={styles.seeAllText}>See more</Text>
                      </TouchableOpacity>
                    </View>

                    <FlatList
                      data={jobs}
                      renderItem={({ item }) => renderJobCard({ item })}
                      keyExtractor={(item) => `job-${item.post_id}`}
                    />
                  </>

                </TouchableOpacity>
              );

            case 'banner2':
              return <Banner02 />;

            case 'trendingPosts':
              return (

                <TouchableOpacity activeOpacity={1} style={styles.cards}>

                  <>
                    <Text style={styles.heading}>
                      Trending posts  <Icon name="flash" size={19} color="#075cab" />
                    </Text>

                    <FlatList
                      key={'trending-columns'}
                      data={trendingPosts}
                      renderItem={({ item }) => renderForumCard({ item })}
                      keyExtractor={(item, index) => item.forum_id?.toString() || item.post_id?.toString() || `fallback-${index}`}
                      showsVerticalScrollIndicator={false}

                    />
                  </>


                </TouchableOpacity>
              );

            case 'banner3':
              return <Banner03 />;

            case 'latestPosts':
              return (

                <TouchableOpacity activeOpacity={1} style={styles.cards}>

                  <>
                    <Text style={styles.heading}>
                      Latest posts  <Icon name="message" size={19} color="#075cab" />
                    </Text>

                    <FlatList
                      key={'latest-columns'}
                      data={latestPosts}
                      renderItem={({ item }) => renderForumCard({ item })}
                      keyExtractor={(item, index) => item.forum_id?.toString() || item.post_id?.toString() || `latest-${index}`}
                      showsVerticalScrollIndicator={false}
                    />
                  </>

                </TouchableOpacity>
              );
            case 'products':
              return (
                <TouchableOpacity activeOpacity={1} style={styles.cards}>

                  <>
                    <View style={styles.headingContainer}>
                      <Text style={styles.heading}>
                        Products  <Icon name="shopping" size={19} color="#075cab" />
                      </Text>
                      <TouchableOpacity onPress={allProducts}>
                        <Text style={styles.seeAllText}>See more</Text>
                      </TouchableOpacity>
                    </View>

                    <FlatList
                      data={products}
                      renderItem={({ item }) => renderProductCard({ item })}
                      keyExtractor={(item) => `product-${item.product_id}`}
                      numColumns={2}
                      contentContainerStyle={styles.flatListContainer}
                      columnWrapperStyle={styles.columnWrapper}
                    />
                  </>

                </TouchableOpacity>
              );

            case 'services':
              return (
                <TouchableOpacity activeOpacity={1} style={styles.cards}>

                  <>
                    <View style={styles.headingContainer}>
                      <Text style={styles.heading}>
                        Services  <Icon name="tools" size={19} color="#075cab" />
                      </Text>
                      <TouchableOpacity onPress={allServices}>
                        <Text style={styles.seeAllText}>See more</Text>
                      </TouchableOpacity>
                    </View>

                    <FlatList
                      data={services}
                      renderItem={({ item }) => renderServiceCard({ item })}
                      keyExtractor={(item) => `service-${item.service_id}`}
                      numColumns={2}
                      contentContainerStyle={styles.flatListContainer}
                      columnWrapperStyle={styles.columnWrapper}
                    />
                  </>

                </TouchableOpacity>
              );

            default:
              return null;
          }
        }}

        keyExtractor={(item, index) => `${item.type || 'unknown'}-${index}`}
      />

      <View style={styles.bottomNavContainer}>
        {tabConfig.map((tab, index) => {

          const isFocused = tabNameMap[currentRouteName] === tab.name;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => {
                const targetTab = tab.name;

                if (isFocused) {
                  if (scrollOffsetY.current > 0) {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

                    setTimeout(() => {
                      handleRefresh();
                    }, 300);
                  } else {
                    handleRefresh();
                  }
                } else {
                  navigation.navigate(targetTab);
                }
              }}
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

});


export default CompanyHomeScreen;
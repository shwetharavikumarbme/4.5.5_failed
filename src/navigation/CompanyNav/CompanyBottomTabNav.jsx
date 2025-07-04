import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { Platform, StatusBar, Text, View } from 'react-native';
import { CompanyJobNav, CompanyStackNav, CompanyForumNav, CompanyProfileNav, CompanyListNav, CompanyResourcesDrawer, CompanyProducts, EventsDrawer, CompanyServices, TrendingDrawer } from './CompanyStackNav';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions, SafeAreaView, StyleSheet } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HelpCenter from '../../screens/Bme_content/HelpCenter';
import CustomDrawerContent from '../DrawerContent';
import { NetworkProvider } from '../../screens/AppUtils/IdProvider';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const { width: screenWidth } = Dimensions.get('window');

const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight : getStatusBarHeight();

const tabConfig = [
  { name: "Home", component: CompanyStackNav, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
  { name: "Jobs", component: CompanyJobNav, focusedIcon: 'bag-suitcase', unfocusedIcon: 'bag-suitcase-outline', iconComponent: Icon },
  { name: "Feed", component: CompanyForumNav, focusedIcon: 'forum', unfocusedIcon: 'forum-outline', iconComponent: Icon },
  { name: "Products", component: CompanyProducts, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
  { name: "Settings", component: CompanyProfileNav, focusedIcon: 'account-circle', unfocusedIcon: 'account-circle-outline', iconComponent: Icon },
];

const screenOptionStyle = ({ route }) => {
  const routeConfig = tabConfig.find(config => config.name === route.name);
  const insets = useSafeAreaInsets();
  const { height, width } = Dimensions.get('window');
  if (!routeConfig) return {};
  const tabBarHeight = height > 700 ? 85 : 55; // Example thresholds for taller/shorter devices
  const { focusedIcon, unfocusedIcon, iconComponent: IconComponent } = routeConfig;

  return {
    tabBarIcon: ({ focused, color, size }) => (
      <IconComponent name={focused ? focusedIcon : unfocusedIcon} size={size} color={focused ? '#075CAB' : 'black'} />
    ),
    headerShown: false,
    tabBarActiveTintColor: '#075cab',
    tabBarInactiveTintColor: 'black',
    tabBarLabelStyle: {
      fontSize: 10,
      paddingBottom: 10,
      overflow: 'hidden',
      fontWeight: '600',
    },
    tabBarStyle: {
      height: tabBarHeight,
      paddingTop: 0,
      backgroundColor: 'white', // Ensuring the background is white
      borderTopWidth: 0,
      display: 'none'
    },

  };
};


const CompanyBottomTab = () => (
  <SafeAreaProvider style={styles.topSafeArea}>
    <SafeAreaView style={{ backgroundColor: '#075cab' }} />
    <NetworkProvider>

      <Tab.Navigator screenOptions={screenOptionStyle}>
        {tabConfig.map(routeConfig => (
          <Tab.Screen
            key={routeConfig.name}
            name={routeConfig.name}
            component={routeConfig.component}
            options={({ route }) => ({
              ...screenOptionStyle({ route }),


            })}
          />
        ))}

      </Tab.Navigator>
    </NetworkProvider>


  </SafeAreaProvider >
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  topSafeArea: {
    // flex: 0,
    height: statusBarHeight, // Dynamically set height
    backgroundColor: 'white',
  },
  navigatorContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
});




const UserDrawerNav = () => {
  const currentRoute = useNavigationState(state => state?.routes[state?.index]?.name);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ backgroundColor: '#075cab' }} />
      <NetworkProvider>
        <Drawer.Navigator
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={({ route }) => ({
            headerShown: false,
            gestureEnabled: route.name !== "Home",
            drawerActiveTintColor: '#075cab',
            drawerInactiveTintColor: 'black',
            drawerLabelStyle: {
              fontSize: 14,
              fontWeight: '400',
            },
            drawerType: 'front',
            drawerStyle: {
              width: screenWidth * 0.60,
            },
            swipeEnabled: false
          })}
        >
          <Drawer.Screen
            name="Home "
            component={CompanyBottomTab}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="home" size={size} color={color} style={{ fontWeight: 'normal' }} />,
            }}
          />
          {/* <Drawer.Screen
            name="Trending"
            component={TrendingDrawer}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="flash" size={size} color={color} style={{ fontWeight: 'normal' }} />,
              unmountOnBlur: true,

            }}
          /> */}
          <Drawer.Screen
            name="Companies"
            component={CompanyListNav}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="office-building" size={size} color={color} style={{ fontWeight: 'normal' }} />,
              unmountOnBlur: true,
            }}
          />

          <Drawer.Screen
            name="Events"
            component={EventsDrawer}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="calendar" size={size} color={color} style={{ fontWeight: 'normal' }} />,
              unmountOnBlur: true,
            }}
          />

          <Drawer.Screen
            name="Resources"
            component={CompanyResourcesDrawer}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="book" size={size} color={color} style={{ fontWeight: 'normal' }} />,
              unmountOnBlur: true,
            }}
          />

          <Drawer.Screen
            name="Services"
            component={CompanyServices}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="tools" size={size} color={color} style={{ fontWeight: 'normal' }} />,
              unmountOnBlur: true,
            }}
          />
          <Drawer.Screen
            name="Help"
            component={HelpCenter}
            options={{
              drawerIcon: ({ color, size }) => <Icon name="help-circle" size={size} color={color} style={{ fontWeight: 'normal' }} />,

            }}
          />

        </Drawer.Navigator>
      </NetworkProvider>

    </SafeAreaProvider>
  );
};

export default UserDrawerNav;

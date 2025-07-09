import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeScreen from '../../screens/UserHomeScreen';
import UserJobListScreen from '../../screens/Job/JobListScreen';
import PageView from '../../screens/Forum/PagerViewForum';
import ProductsList from '../../screens/Products/ProductsList';
import UserSettingScreen from '../../screens/Profile/UserSettingScreen';

const Tab = createBottomTabNavigator();

const UserBottomTabNav = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'bag-suitcase' : 'bag-suitcase-outline';
          } else if (route.name === 'Feed') {
            iconName = focused ? 'forum' : 'forum-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'shopping' : 'shopping-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'account-circle' : 'account-circle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#075CAB',
        tabBarInactiveTintColor: 'black',
        tabBarLabelStyle: {
          fontSize: 10,
          paddingBottom: 10,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: 60,
          paddingTop: 0,
          backgroundColor: 'white',
          borderTopWidth: 0,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={UserJobListScreen} />
      <Tab.Screen name="Feed" component={PageView} />
      <Tab.Screen name="Products" component={ProductsList} />
      <Tab.Screen name="Settings" component={UserSettingScreen} />
    </Tab.Navigator>
  );
};

export default UserBottomTabNav;
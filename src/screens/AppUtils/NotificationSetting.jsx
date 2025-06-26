import React, { useState, useEffect } from 'react';
import { View, Text, Switch, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../ApiClient';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { showToast } from './CustomToast';
import { useNetwork } from './IdProvider';
import { useConnection } from './ConnectionProvider';

const NotificationSettings = () => {
    const { myId, myData } = useNetwork();
    const { isConnected } = useConnection();
  
  const [status, setStatus] = useState(true);
  const [fcmToken, setFcmToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);


  useEffect(() => {
    const getFcmToken = async () => {
      try {
        const app = getApp();
        const messaging = getMessaging(app);
        const token = await getToken(messaging);
        setFcmToken(token);
      } catch (error) {
        console.error('Error getting FCM token:', error);
      }
    };

    getFcmToken();
  }, []);

  const handleToggle = async (value) => {
    if (!myId) {
      showToast('Something went wrong\nTry again later', 'error');

      Alert.alert('Error', 'User ID not available.');
      return;
    }

    const previousStatus = status;
    setStatus(value);
    setIsProcessing(true);

    try {
      const tokenToSend = value ? fcmToken : '';

      const res = await apiClient.post('/updateUserSettings', {
        command: 'updateUserSettings',
        user_id: myId,
        notification_status: value,
        fcm_token: tokenToSend,
      });

      if (res.status === 200 && res.data.status === 'success') {
        showToast(`Notifications ${value ? 'enabled' : 'disabled'} successfully.`, 'success');
      } else {
        setStatus(previousStatus);
        const errorMsg = res.data?.message || 'Failed to update settings. Please try again.';
        showToast(errorMsg, 'error');
      }
    } catch (error) {
      setStatus(previousStatus);

      let message = 'Something went wrong';

      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }

      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };



  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 18 }}>Notifications</Text>
        <View style={{ transform: [{ scale: 0.8 }] }}>

          <Switch
            value={status}
            onValueChange={handleToggle}
            disabled={isProcessing}
            trackColor={{ false: '#ccc', true: '#ccc' }}
            thumbColor={status ? '#075cab' : '#f4f3f4'}

          />
        </View>

      </View>
    </View>
  );

};

export default NotificationSettings;

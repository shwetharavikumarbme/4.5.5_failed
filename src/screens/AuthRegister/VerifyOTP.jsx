import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Keyboard, BackHandler } from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { showToast } from '../AppUtils/CustomToast';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const VerifyOTPScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedCategory, selectedProfile, userType, fullPhoneNumber } = route.params;

  const [otp, setOTP] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef([]);
  const [resendVisible, setResendVisible] = useState(false);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [isResendEnabled, setIsResendEnabled] = useState(false);


  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(countdown);
    } else {
      setResendVisible(true);
      setIsResendEnabled(true);
    }
  }, [timer]);

  useEffect(() => {

    if (otpInputs.current[0]) {
      otpInputs.current[0].focus();
    }
  }, []);

  const handleOTPChange = (index, value) => {
    setOTP((prevOTP) => {
      const otpCopy = [...prevOTP];

      if (value === '') {
        console.log(`Clearing digit at index: ${index}`);
        otpCopy[index] = ''; // Clear digit

        if (index > 0) {
          console.log(`Moving focus to index: ${index - 1}`);
          requestAnimationFrame(() => otpInputs.current[index - 1]?.focus());
        }
      } else if (/^\d$/.test(value)) {
        otpCopy[index] = value;
        if (index < otpCopy.length - 1 && otpCopy[index + 1] === '') {
          requestAnimationFrame(() => otpInputs.current[index + 1]?.focus());
        } else if (index === otpCopy.length - 1) {

          Keyboard.dismiss();
        }
      }

      return otpCopy;
    });
  };


  const handleKeyPress = ({ nativeEvent }, index) => {

    if (nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
      setOTP((prevOTP) => {
        const otpCopy = [...prevOTP];
        otpCopy[index - 1] = '';
        requestAnimationFrame(() => otpInputs.current[index - 1]?.focus());
        return otpCopy;
      });
    }
  };




  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: false, // disables swipe back on iOS
      headerLeft: () => null, // hides back button
    });
  }, [navigation]);



  const handleVerifyOTP = () => {
    const enteredOTP = otp.join('');

    if (enteredOTP.length !== 6 || !/^\d+$/.test(enteredOTP)) {

      showToast("Please enter a valid 6 digit OTP", 'error');

      return;
    }

    axios.post('https://h7l1568kga.execute-api.ap-south-1.amazonaws.com/dev/verifyOtpMsg91', {
      command: 'verifyOtpMsg91',
      otp: enteredOTP,
      user_phone_number: fullPhoneNumber,
    }, {
      headers: {
        'x-api-key': 'k1xuty5IpZ2oHOEOjgMz57wHfdFT8UQ16DxCFkzk',
      },
    })
      .then((res) => {
        if (res.data.type === "success") {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: userType === 'company' ? "CompanyUserSignup" : "UserSignup",
                  params: { fullPhoneNumber, selectedProfile, selectedCategory, userType },
                },
              ],
            })
          );

        } else {

          showToast("OTP doesn't match", 'error');

        }
      })
      .catch((error) => {

        showToast("Try again later", 'error');
      });
  };

  const resendHandle = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        'https://h7l1568kga.execute-api.ap-south-1.amazonaws.com/dev/resendOtpMsg91',
        { command: 'resendOtpMsg91', user_phone_number: fullPhoneNumber },
        { headers: { 'x-api-key': 'k1xuty5IpZ2oHOEOjgMz57wHfdFT8UQ16DxCFkzk' } }
      );
      setLoading(false);

      if (response.data.type === 'success') {

        showToast("OTP sent", 'success');

        setTimer(30);
        setIsResendEnabled(false);
      } else {

        showToast("Failed to resend OTP. Check your connection and try again", 'error');
      }
    } catch (error) {
      setLoading(false);

      showToast("Failed to resend OTP. Check your connection and try again", 'error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.navigate("ProfileType")} style={styles.backButton}>
      <MaterialCommunityIcons name="arrow-left" size={24} color="#075cab" />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollViewContainer} showsVerticalScrollIndicator={false}>

        <Text style={styles.infoText}>
          Enter the OTP sent to: {fullPhoneNumber}
        </Text>
        <View style={styles.inputContainer}>
          {otp.map((_, index) => (
            <TextInput
              key={index}
              style={styles.input}
              // placeholder="•"
              placeholderTextColor="gray"
              keyboardType="numeric"
              onChangeText={(text) => handleOTPChange(index, text)}
              value={otp[index]}
              maxLength={1}
              ref={(ref) => {
                if (ref) otpInputs.current[index] = ref;
              }}
              onKeyPress={(event) => handleKeyPress(event, index)}
              blurOnSubmit={false}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', }}>
            {isResendEnabled ? (
              <TouchableOpacity onPress={resendHandle} style={{
                padding: 10,
                // backgroundColor: "#075cab",
                // width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                // borderRadius: 20,
                alignSelf: 'center'

              }}>
                <Text style={styles.resendButtonText}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>Resend in {timer}</Text>
            )}
          </View>
          <View>
            <TouchableOpacity onPress={handleVerifyOTP} style={{
              // backgroundColor: "#075cab",
              // width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 20,
              alignSelf: 'flex-end'
            }}>

              <MaterialCommunityIcons name="arrow-right-circle-outline" size={40} color="#075cab" style={{ alignSelf: 'flex-end' }} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
  },
  scrollViewContainer: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    flex: 1
  },

  infoText: {
    color: '#333', // Darker text for better readability
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  btn: {
    fontSize: 15,
    fontWeight: '600', // Slightly bolder for emphasis
    color: "black", // White text for contrast
    margin: 10,
    alignSelf: 'center',
    // paddingVertical: 10, 
    textAlign: 'center', // Center the text
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 30
  },
  input: {
    width: 50,
    height: 50,
    borderColor: '#075cab',
    borderWidth: 1,
    borderRadius: 10, // More rounded edges
    fontSize: 24,
    color: '#075cab', // Darker text for better readability
    textAlign: 'center',
    backgroundColor: '#ffffff', // White background for inputs
    elevation: 3, // Slightly more elevation for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timerText: {
    color: '#075cab',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center'

  },
  resendButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: "#075cab",
    textAlign: 'center',

  },
});

export default VerifyOTPScreen;

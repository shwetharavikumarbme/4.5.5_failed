import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet, Image } from 'react-native';

const CustomAlertMessage = ({ visible, onClose, onConfirm, message, imageType }) => {
  const getImage = () => {
    switch (imageType) {
      case 'success':
        return require('../assets/fonts/image/smileemoji.png');
      case 'warning':
        return require('../assets/fonts/image/sademoji.png');
      case 'info':
        return require('../assets/fonts/image/warningemoji.png');
      default:
        return null;
    }
  };

  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Image source={getImage()} style={styles.image} />
          <Text style={styles.modalText}>{message}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonConfirm]}
              onPress={onConfirm}
            >
              <Text style={styles.textConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const App = () => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleConfirm = () => {
    console.log('OK Pressed');
    setModalVisible(false);
  };

  const showCustomAlert = () => {
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.showButton}
        onPress={showCustomAlert}
      >
        <Text style={styles.showButtonText}>Show Custom Alert</Text>
      </TouchableOpacity>
      <CustomAlertMessage
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleConfirm}
        message="This is your custom message."
        imageType="info" // Change this to 'warning' or 'success' as needed
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: '#075cab',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  image: {
    width: 50,
    height: 50,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 15,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    marginHorizontal: 5,
    backgroundColor: 'white',
  },
  buttonCancel: {},
  buttonConfirm: {},
  textCancel: {
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  textConfirm: {
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    color: 'white',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showButton: {
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 10,
  },
  showButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CustomAlertMessage;
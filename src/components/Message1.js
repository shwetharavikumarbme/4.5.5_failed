import React from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Message1 = ({ visible, onClose, onOk, title, message, iconType }) => {

  const getIcon = () => {
    switch (iconType) {
      case 'success':
        return <Icon name="check-circle" size={60} color="green" />;
      case 'warning':
        return <Icon name="alert-circle" size={50} color="#3498db" />;
      case 'info':
        return <Icon name="information" size={60} color="#3498db" />;
      case 'congratulations':
        return <Icon name="trophy-award" size={60} color="#FFD700" />;
      case 'logout':
        return <Icon name="logout" size={60} color="#FFD700" />;
      default:
        return <Icon name="help-circle" size={60} color="gray" />;
    }
  };
  

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {/* Icon based on iconType */}
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* OK Button */}
          <TouchableOpacity onPress={onOk} style={styles.okButton}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertBox: {
    width: 320,
    paddingVertical: 30,
    paddingHorizontal: 25,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7,
  },
  iconContainer: {
    marginBottom: 20,
    
  
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
    textAlign: 'justify', // Centered message
  },
  message: {
    fontSize: 16,
    color: 'black',
    marginBottom: 20,
    textAlign: 'justify', // Centered message
    fontWeight: '400',
    lineHeight: 23,
  },
  okButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
});

export default Message1;

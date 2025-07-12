import React from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const Message1 = ({ visible, onClose, onOk, title, message, iconType }) => {
  const getIcon = () => {
    const iconProps = {
      size: 50,
      style: styles.icon
    };

    switch (iconType) {
      case 'success':
        return <Icon name="check-circle" {...iconProps} color="#4CAF50" />;
      case 'warning':
        return <Icon name="alert-circle" {...iconProps} color="#FF9800" />;
      case 'info':
        return <Icon name="information" {...iconProps} color="#2196F3" />;
      case 'congratulations':
        return <Icon name="trophy-award" {...iconProps} color="#FFC107" />;
      case 'logout':
        return <Icon name="logout" {...iconProps} color="#F44336" />;
      default:
        return <Icon name="help-circle" {...iconProps} color="#9E9E9E" />;
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
          {/* Icon */}
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>

          {/* Title */}
          {title && <Text style={styles.title}>{title}</Text>}

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Button Container */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={onOk} 
              style={[styles.button, styles.okButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20
  },
  alertBox: {
    width: width - 40,
    maxWidth: 400,
    padding: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  iconContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    marginBottom: -3
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 24
  },
  message: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%'
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center'
  },
  okButton: {
    backgroundColor: '#075cab',
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.5
  }
});

export default Message1;
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CustomDropdown = ({ label, data = [], onSelect }) => { // Set a default value for data
    const [visible, setVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState('');

    // Handle when the data prop changes
    useEffect(() => {
        if (data.length > 0 && !data.includes(selectedItem)) {
            setSelectedItem(''); // Reset selection if the current selected item is not in the new data
        }
    }, [data, selectedItem]); // Add selectedItem to the dependency array

    const toggleDropdown = () => {
        setVisible(!visible);
    };

    const handleSelect = (item) => {
        setSelectedItem(item);
        onSelect(item);
        setVisible(false);
    };

    return (
        <View style={styles.dropdownContainer}>
            <TouchableOpacity style={styles.dropdown} onPress={toggleDropdown}>
                <Text style={styles.selectedText}>{selectedItem || `Select ${label}`}</Text>
                <Icon name="chevron-down" size={24} color="black" />
            </TouchableOpacity>
            <Modal
                visible={visible}
                transparent={true}
                animationType="slide"
                onRequestClose={toggleDropdown}
            >
                <TouchableOpacity style={styles.overlay} onPress={toggleDropdown}>
                    <View style={styles.modalContent}>
                        <FlatList
                            data={data}
                            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()} // Use unique ID or index
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                                    <Text style={styles.itemText}>{item.label || item}</Text> {/* Adjust as necessary */}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    dropdownContainer: {
        marginBottom: 16,
        marginTop: 10,
        borderRadius: 20
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#075cab',
        padding: 12,
        borderRadius: 15,
    },
    selectedText: {
        fontSize: 16,
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        margin: 20,
        padding: 20,
        borderRadius: 10,
    },
    item: {
        paddingVertical: 10,
    },
    itemText: {
        fontSize: 16,
    },
});

export default CustomDropdown;

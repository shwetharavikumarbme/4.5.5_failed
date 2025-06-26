import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CustomDropdown = ({ label, data = [], onSelect }) => { // Default to empty array
    const [visible, setVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState('');

    // Handle when the data prop changes
    useEffect(() => {
        if (data.length > 0 && !data.includes(selectedItem)) {
            setSelectedItem(''); // Reset selection if the current selected item is not in the new data
        }
    }, [data]);

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
            <TouchableOpacity 
                style={styles.dropdown} 
                onPress={toggleDropdown}
                accessible={true}
                accessibilityLabel={`Select ${label}`}
                accessibilityRole="button"
            >
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
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                                    <Text style={styles.itemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

// Adding prop types for validation
CustomDropdown.propTypes = {
    label: PropTypes.string.isRequired,
    data: PropTypes.array, // Optional array prop
    onSelect: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
    dropdownContainer: {
        marginBottom: 16,
        marginTop: 10,
        borderRadius: 20,
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

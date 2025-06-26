import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SelectDropDown = ({ label, data, onSelect }) => {
    const [visible, setVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState('');

    const toggleDropdown = () => {
        setVisible(!visible);
    };

    const handleSelect = (item) => {
        console.log(`Selected Item: ${item}`); // Log the selected item
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

const styles = StyleSheet.create({
    dropdownContainer: {
        marginBottom: 16,
        marginTop:10,
        borderRadius:20
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

export default SelectDropDown;

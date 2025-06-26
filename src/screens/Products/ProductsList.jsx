import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,
    TextInput, RefreshControl, StyleSheet,
    Keyboard,
    Switch,
    SafeAreaView,
    PanResponder,
    Animated,
    TouchableWithoutFeedback,
    ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useNavigationState, useScrollToTop } from '@react-navigation/native';
import apiClient from '../ApiClient';
import { useNetwork } from '../AppUtils/IdProvider';
import { showToast } from '../AppUtils/CustomToast';
import Fuse from 'fuse.js';
import { EventRegister } from 'react-native-event-listeners';
import { useConnection } from '../AppUtils/ConnectionProvider';
import AppStyles from '../../assets/AppStyles';
import { getSignedUrl } from '../helperComponents.jsx/signedUrls';


const JobListScreen = React.lazy(() => import('../Job/JobListScreen'));
const PageView = React.lazy(() => import('../Forum/PagerViewForum'));
const CompanySettingScreen = React.lazy(() => import('../Profile/CompanySettingScreen'));
const CompanyHomeScreen = React.lazy(() => import('../CompanyHomeScreen'));

const tabNameMap = {
    CompanyJobList: "Jobs",
    Home: 'Home3',
    CompanySetting: 'settings',
    ProductsList: 'Products'
};

const tabConfig = [
    { name: "Home", component: CompanyHomeScreen, focusedIcon: 'home', unfocusedIcon: 'home-outline', iconComponent: Icon },
    { name: "Jobs", component: JobListScreen, focusedIcon: 'briefcase', unfocusedIcon: 'briefcase-outline', iconComponent: Icon },
    { name: "Feed", component: PageView, focusedIcon: 'rss', unfocusedIcon: 'rss-box', iconComponent: Icon },
    { name: "Products", component: ProductsList, focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline', iconComponent: Icon },
    { name: "Settings", component: CompanySettingScreen, focusedIcon: 'cog', unfocusedIcon: 'cog-outline', iconComponent: Icon },
];

const ProductsList = () => {
    const searchInputRef = useRef(null);
    const navigation = useNavigation();
    const { isConnected } = useConnection();


    const currentRouteName = useNavigationState((state) => {
        const route = state.routes[state.index];

        return route.name;
    });

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
    const [imageUrls, setImageUrls] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [searchResults, setSearchResults] = useState(false);
    const [searchTriggered, setSearchTriggered] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsLimit, setSuggestionsLimit] = useState(5);

    const [filteredCategories, setFilteredCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState({});
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [fetchLimit, setFetchLimit] = useState(3);
    const filterSlideAnim = useRef(new Animated.Value(500)).current;
    const [allProducts, setAllProducts] = useState();
    const flatListRef = useRef(null);
    const scrollOffsetY = useRef(0);

    useEffect(() => {
        const handleProductCreated = async ({ newProduct }) => {

            let signedUrls = {};
            if (newProduct.images?.[0]) {
                signedUrls = await getSignedUrl(newProduct.product_id, newProduct.images[0]);
                setImageUrls((prev) => ({ ...prev, ...signedUrls }));
            }

            setProducts((prev) => [newProduct, ...(Array.isArray(prev) ? prev : [])]);

        };

        const handleProductUpdated = async ({ updatedProduct }) => {

            let signedUrls = {};
            if (updatedProduct.images?.[0]) {
                signedUrls = await getSignedUrl(updatedProduct.product_id, updatedProduct.images[0]);
                setImageUrls((prev) => ({ ...prev, ...signedUrls }));
            }

            setProducts((prevProducts) =>
                prevProducts.map((product) =>
                    product.product_id === updatedProduct.product_id
                        ? updatedProduct
                        : product
                )
            );

        };

        const handleProductDeleted = ({ deletedProductId }) => {
            setProducts((prevProducts) =>
                prevProducts.filter((product) => product.product_id !== deletedProductId)
            );
        };

        const createListener = EventRegister.addEventListener('onProductCreated', handleProductCreated);
        const updateListener = EventRegister.addEventListener('onProductUpdated', handleProductUpdated);
        const deleteListener = EventRegister.addEventListener('onProductDeleted', handleProductDeleted);

        return () => {
            EventRegister.removeEventListener(createListener);
            EventRegister.removeEventListener(updateListener);
            EventRegister.removeEventListener(deleteListener);
        };
    }, []);






    const fetchAllProducts = async () => {
        try {
            const requestData = { command: 'getAllProducts' };
            const res = await apiClient.post('/getAllProducts', requestData);
            const Allproducts = res?.data?.response || [];

            setAllProducts(Allproducts);

        } catch (error) {

        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchAllProducts();
    }, []);

    const getFuzzySuggestions = (inputText) => {
        const fuse = new Fuse(allProducts, {
            keys: ['title', 'category', 'company_name'],
            threshold: 0.5,
            distance: 100,
        });

        const results = fuse.search(inputText);
        const uniqueMap = new Map();

        results.forEach(res => {
            const { title, category, company_name } = res.item;
            const key = `${title}|${category}|${company_name}`;

            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, res.item);
            }
        });

        return Array.from(uniqueMap.values());
    };

    const handleInputChange = (text) => {
        setSearchQuery(text);
        setSuggestionsLimit(5);

        if (text.trim() === '') {
            setSuggestions([]);
            return;
        }

        const matchedSuggestions = getFuzzySuggestions(text);
        setSuggestions(matchedSuggestions);
    };


    const handleScroll = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        scrollOffsetY.current = offsetY;
    };

    useEffect(() => {
        Animated.timing(filterSlideAnim, {
            toValue: isFilterOpen ? 0 : 500,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isFilterOpen]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) =>
                Math.abs(gestureState.dx) > 20,

            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx > 0) {
                    filterSlideAnim.setValue(gestureState.dx);
                }
            },

            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 100) {
                    Animated.timing(filterSlideAnim, {
                        toValue: 500,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        setIsFilterOpen(false);
                        filterSlideAnim.setValue(0);
                    });
                } else {
                    Animated.spring(filterSlideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const clearFilters = () => {
        if (Object.keys(selectedCategories).length > 0) {
            setSelectedCategories({});
            handleRefresh();
        }
        setIsFilterOpen(false);
        searchInputRef.current?.blur();

    };

    const applyFilters = () => {
        const selectedCategoryKeys = selectedCategories
            ? Object.keys(selectedCategories).filter((key) => selectedCategories[key])
            : [];

        console.log('Applying filters with selected categories:', selectedCategoryKeys);

        setIsFilterOpen(false);

        if (selectedCategoryKeys.length === 0) {
            handleSearch("", {});
            return;
        }

        handleSearch(searchQuery || "", selectedCategories);
        searchInputRef.current?.blur();

    };


    const handleFilterClick = () => {
        setSuggestions([]);
        setFilteredCategories(categories);
        setIsFilterOpen(prevState => !prevState);
        searchInputRef.current?.blur();
    };

    const toggleCheckbox = (category) => {
        setSelectedCategories((prev) => {
            const updatedCategories = { ...prev, [category]: !prev[category] };

            return updatedCategories;
        });
    };
    const categories = [
        "3D Printing in Healthcare", "Biomedical Research Equipment", "Biomedical Sensors & Components",
        "Biomedical Testing Equipment", "Biotechnology & Life Sciences", "Healthcare & Hospital Services",
        "Healthcare IT & AI Solutions", "Hospital & Clinical Equipment", "Laboratory & Testing Equipment",
        "Medical Consumables & Disposables", "Medical Devices", "Medical Implants & Prosthetics",
        "Oxygen & Respiratory Care", "Rehabilitation & Assistive Devices"
    ];

    const withTimeout = (promise, timeout = 10000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
        ]);
    };

    const fetchProducts = async (lastKey = null,) => {
        if (!isConnected) {

            return;
        }
        if (loading || loadingMore) return;
        lastKey ? setLoadingMore(true) : setLoading(true);

        const startTime = Date.now();

        try {
            const requestData = {
                command: "getAllProducts",
                limit: lastKey ? fetchLimit : 4,
                ...(lastKey && { lastEvaluatedKey: lastKey }),
            };

            const res = await withTimeout(apiClient.post('/getAllProducts', requestData), 10000);

            const newProducts = res?.data?.response || [];

            if (!newProducts.length) {
                setLastEvaluatedKey(null);
                return;
            }

            const responseTime = Date.now() - startTime;

            if (responseTime < 400) {
                setFetchLimit(prev => Math.min(prev + 5, 10));
            } else if (responseTime > 1000) {
                setFetchLimit(prev => Math.max(prev - 2, 1));
            }

            setProducts(prev => lastKey ? [...prev, ...newProducts] : newProducts);
            setLastEvaluatedKey(res.data.lastEvaluatedKey || null);
            fetchProductImageUrls(newProducts);
        } catch (error) {
            showToast('Slow network', 'info');
            setLoading(false);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const fetchProductImageUrls = async (products) => {
        const productsArray = Array.isArray(products) ? products : [products];
        const urlsObject = {};
        const startTime = Date.now();

        await Promise.all(
            productsArray.map(async (product) => {
                if (product.images?.length > 0) {
                    try {
                        const res = await getSignedUrl(product.product_id, product.images[0]);
                        const signedUrl = res?.[product.product_id];
                        if (signedUrl) {
                            urlsObject[product.product_id] = signedUrl;
                        }

                    } catch (error) {
                    }
                }
            })
        );

        const responseTime = Date.now() - startTime;

        if (responseTime < 500) {
            setFetchLimit((prev) => Math.min(prev + 5, 50));
        } else if (responseTime > 1200) {
            setFetchLimit((prev) => Math.max(prev - 2, 1));
        }

        setImageUrls((prev) => ({ ...prev, ...urlsObject }));
    };


    useEffect(() => {
        fetchProducts();
    }, [])






    const handleSearch = async (text, selectedCategories = {}) => {
 
        if (!isConnected) {
           
            return;
        }

        setSearchQuery(text);

        if (text.trim() === '' && Object.keys(selectedCategories).length === 0) {
            setSearchTriggered(false);
            setSearchResults([]);
            return;
        }

        setSearchTriggered(true);
        setLoading(true);
        searchInputRef.current?.blur();

        const selectedCategoryKeys = Object.keys(selectedCategories).filter(
            (key) => selectedCategories[key]
        );

        const requestData = {
            command: "searchProducts",
            searchQuery: text.trim(),
            categories: selectedCategoryKeys.length > 0 ? selectedCategoryKeys : undefined,
        };

        try {
            const res = await withTimeout(apiClient.post('/searchProducts', requestData), 10000);
            const searchResults = res?.data?.response || [];

            setSearchResults(searchResults);
            setLastEvaluatedKey(null);
            fetchProductImageUrls(searchResults);
        } catch (error) {
            console.error('[handleSearch] Error occurred during search:', error);
        } finally {
            setSearchTriggered(true);
            setLoading(false);

        }
    };



    const refreshCooldown = useRef(false);

    const handleRefresh = async () => {

        if (!isConnected) {

            return;
        }
        if (refreshCooldown.current) return;

        refreshCooldown.current = true;
        setRefreshing(true);

        setSearchQuery('');
        setSuggestions([]);
        setSearchTriggered(false);
        setSearchResults([]);
        setLastEvaluatedKey(null);
        if (products.length > 0) {
            setProducts([]);
        }
        setSelectedCategories({});

        await fetchProducts();

        setRefreshing(false);
        setTimeout(() => {
            refreshCooldown.current = false;
        }, 3000);
    };



    const handleAddProduct = (product) => {
        setTimeout(() => {
            navigation.navigate('ProductDetails', { product_id: product.product_id, company_id: product.company_id });

        }, 100);
    };

    const renderItem = ({ item, index }) => (
        <TouchableOpacity activeOpacity={1} onPress={() => handleAddProduct(item)} >
            <View style={styles.card} >
                <View style={styles.productImageContainer}>
                    {imageUrls[item.product_id] ? (
                        <Image source={{ uri: imageUrls[item.product_id] }} style={styles.productImage} />
                    ) : (
                        <View style={styles.productImagePlaceholder} />
                    )}
                </View>

                <View style={styles.cardContent}>
                    <View>
                        <Text numberOfLines={1} style={styles.title}>{item.title || ' '}</Text>
                        <Text numberOfLines={1} style={styles.category}>{item.specifications.model_name || ' '}</Text>
                        <Text numberOfLines={1} style={styles.description}>{item.description || ' '}</Text>
                        <Text numberOfLines={1} style={styles.company}>{item.company_name || ' '}</Text>

                        {item.price && item.price.trim() !== '' ? (
                            <View style={styles.priceRow}>
                                <Text numberOfLines={1} style={styles.price}>₹ {item.price}</Text>
                            </View>
                        ) : (
                            <Text style={styles.category}>₹ Contact Supplier</Text> // Show "Contact Supplier" instead of empty space
                        )}

                    </View>

                    <TouchableOpacity style={styles.productDetailsContainer} onPress={() => handleAddProduct(item)} activeOpacity={1}>
                        <Text numberOfLines={1} style={styles.productDetailsText}>View details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );



    const renderFooter = () => loadingMore ? <ActivityIndicator size="large" color="#075cab" style={{ marginVertical: 10 }} /> : null;
    const hasFiltersApplied = searchTriggered && (
        searchQuery.trim() !== '' || Object.keys(selectedCategories).some(key => selectedCategories[key])
    );


    return (
        <SafeAreaView style={styles.container}>
            <View style={AppStyles.headerContainer}>
                {/* <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#075cab" />
                </TouchableOpacity> */}
                <View style={AppStyles.searchContainer}>
                    <View style={AppStyles.inputContainer}>
                        <TextInput
                            style={AppStyles.searchInput}
                            placeholder="Search"
                            ref={searchInputRef}
                            placeholderTextColor="gray"
                            value={searchQuery}

                            onChangeText={handleInputChange}
                            onSubmitEditing={() => {
                                if (searchQuery.trim() !== '') {
                                    handleSearch(searchQuery);
                                    setSearchTriggered(true);
                                    setSuggestions([]);
                                    searchInputRef.current?.blur();
                                }
                            }}
                            returnKeyType="search"
                        />
                        {searchQuery.trim() !== '' ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setSearchQuery('');
                                    setSearchTriggered(false);
                                    setSearchResults([]);
                                    setSuggestions([]);

                                }}
                                style={AppStyles.iconButton}
                            >
                                <Icon name="close-circle" size={20} color="gray" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                // onPress={() => {
                                //     if (searchQuery.trim() !== '') {
                                //         handleSearch(searchQuery);
                                //         setSearchTriggered(true);
                                //         setSuggestions([]);
                                //         searchInputRef.current?.blur();

                                //     }
                                // }}
                                style={AppStyles.searchIconButton}
                            >
                                <Icon name="magnify" size={20} color="#075cab" />
                            </TouchableOpacity>

                        )}
                    </View>

                </View>
                {isConnected && (
                    <TouchableOpacity onPress={handleFilterClick} style={AppStyles.circle}>
                        <Icon name="filter-variant" size={30} color="#075cab" />
                    </TouchableOpacity>
                )}
            </View>

            {suggestions.length > 0 && (

                <ScrollView
                    style={styles.suggestionContainer}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ backgroundColor: '#fff' }}
                >

                    {suggestions.slice(0, suggestionsLimit).map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => {
                                setSearchQuery(`${item.title}, ${item.category}, ${item.company_name}`);
                                handleSearch(item.title, item.category, item.company_name);
                                setSuggestions([]);
                                setSuggestionsLimit(5);
                                searchInputRef.current?.blur();
                            }}
                            style={styles.suggestionItem}
                        >

                            <Text style={styles.suggestionTitle}>{`${item.title}`} - {`${item.category}`}</Text>
                            <Text style={styles.suggestionJob}>{`${item.company_name}`}</Text>

                        </TouchableOpacity>
                    ))}


                    {suggestions.length > suggestionsLimit && (
                        <TouchableOpacity
                            onPress={() => setSuggestionsLimit(suggestionsLimit + 5)}
                            style={styles.loadMoreButton}
                        >
                            <Text style={styles.loadMoreText}>Load More</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

            )}

            <TouchableWithoutFeedback
                onPress={() => {
                    Keyboard.dismiss();
                    searchInputRef.current?.blur?.();  // Optional chaining in case ref is not set yet
                    setSuggestions([]);
                }}

            >
                {!loading ? (
                    <FlatList
                        data={hasFiltersApplied ? searchResults : products}
                        renderItem={renderItem}
                        onScrollBeginDrag={() => {
                            Keyboard.dismiss();
                            searchInputRef.current?.blur?.();
                            setSuggestions([]);
                        }}
                        keyboardShouldPersistTaps="handled"
                        keyExtractor={(item, index) => `${item.product_id}-${index}`}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.flatListContainer}
                        onEndReached={() => {
                            if (lastEvaluatedKey && !loadingMore && !loading) {
                                fetchProducts(lastEvaluatedKey);
                            }
                        }}
                        ref={flatListRef}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                        ListEmptyComponent={
                            (searchTriggered && searchResults.length === 0) ? (
                                <View style={{ alignItems: 'center', marginTop: 40 }}>
                                    <Text style={{ fontSize: 16, color: '#666' }}>No products found</Text>
                                </View>
                            ) : null
                        }
                        ListHeaderComponent={
                            <View>
                                {searchTriggered && searchResults.length > 0 && (
                                    <Text style={styles.companyCount}>
                                        {searchResults.length} results found
                                    </Text>
                                )}
                            </View>
                        }
                        ListFooterComponent={
                            loadingMore ? (
                                <View style={{ paddingVertical: 20 }}>
                                    <ActivityIndicator size="small" color="#075cab" />
                                </View>
                            ) : null
                        }

                    />
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color={'#075cab'} size="large" />
                    </View>
                )}

            </TouchableWithoutFeedback>


            {isFilterOpen && (
                <View style={StyleSheet.absoluteFill}>
                    {/* Transparent overlay to detect outside touches */}
                    <TouchableWithoutFeedback onPress={() => setIsFilterOpen(false)}>
                        <View style={styles.overlay} />
                    </TouchableWithoutFeedback>

                    <Animated.View
                        style={[
                            styles.filterContainer,
                            {
                                transform: [{ translateX: filterSlideAnim }],
                            },
                        ]}
                        {...panResponder.panHandlers}
                    >
                        {/* Filter content */}
                        <View style={styles.buttonWrapper}>
                            <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                                <Text style={styles.clearButtonText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={applyFilters} style={styles.applyButton}>
                                <Text style={styles.applyButtonText}>Apply</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: 'gray' }}>Select Category:</Text>
                        <View style={styles.divider} />

                        <FlatList
                            data={filteredCategories}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => toggleCheckbox(item)}
                                    style={styles.checkboxContainer}
                                >
                                    <View
                                        style={[
                                            styles.checkbox,
                                            selectedCategories[item] && styles.checkboxChecked,
                                        ]}
                                    >
                                        {selectedCategories[item] && (
                                            <Icon name="check" size={12} color="#fff" />
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: '30%' }}
                            showsVerticalScrollIndicator={false}
                        />
                    </Animated.View>
                </View>
            )}

            {!isFilterOpen && (

                <View style={styles.bottomNavContainer}>
                    {tabConfig.map((tab, index) => {
                        const isFocused = tabNameMap[currentRouteName] === tab.name;
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    const targetTab = tab.name;

                                    if (isFocused) {
                                        if (scrollOffsetY.current > 0) {
                                            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

                                            setTimeout(() => {
                                                handleRefresh();
                                            }, 300);
                                        } else {
                                            handleRefresh();
                                        }
                                    } else {
                                        navigation.navigate(targetTab);
                                    }
                                }}

                                style={styles.navItem}
                                activeOpacity={0.8}
                            >
                                <tab.iconComponent
                                    name={isFocused ? tab.focusedIcon : tab.unfocusedIcon}
                                    size={22}
                                    color={isFocused ? '#075cab' : 'black'}
                                />
                                <Text style={[styles.navText, { color: isFocused ? '#075cab' : 'black' }]}>
                                    {tab.name}
                                </Text>
                            </TouchableOpacity>

                        );
                    })}
                </View>
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    suggestionContainer: {
        position: 'absolute',
        top: 50, // adjust depending on your header/search bar height
        width: '95%',
        alignSelf: 'center',
        maxHeight: '45%',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 999, // ensures it's above FlatList
    },

    suggestionItem: {
        padding: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    suggestionTitle: {
        fontSize: 14,
        color: 'black'
    },
    suggestionJob: {
        fontSize: 12,
        color: '#888'
    },

    loadMoreButton: {
        padding: 10,
        alignItems: 'center',

    },

    loadMoreText: {
        color: '#075cab',
        fontWeight: 'bold',
    },

    bottomNavContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 12,
        paddingBottom: 15,
        backgroundColor: '#ffffff',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },


    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    navText: {
        fontSize: 12,
        color: 'black',
        marginTop: 2,
    },

    container: {
        flex: 1,
        backgroundColor: 'whitesmoke',
    },

    flatListContainer: {
        paddingBottom: '20%',

    },
    company: {
        fontSize: 12,
        fontWeight: '400',
        color: '#555',
        textAlign: 'center',
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    companyCount: {
        fontSize: 13,
        fontWeight: '400',
        color: 'black',
        padding: 5,
    },

    category: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },

    discountPrice: {
        textDecorationLine: 'line-through',
        marginLeft: 8,
        color: 'red',
        fontSize: 14,
    },
    loaderContainer: {
        backgroundColor: 'whitesmoke',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        flex: 1,
    },
    noProductsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        // padding: 20,
    },
    noProductsText: {
        fontSize: 18,
        color: 'black',
        textAlign: 'center',
    },

    offer: {
        color: 'green',
        marginLeft: 8,
        fontWeight: '700',
        fontSize: 14,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'whitesmoke',

    },
    backButton: {
        alignSelf: 'flex-start',
        padding: 10
    },


    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        marginHorizontal: 10,
    },

    productImageContainer: {
        flex: 1.2, // Shares space equally with cardContent
        maxWidth: 140, // Restricts width to avoid overflow
        alignSelf: 'center',

    },

    productImage: {
        width: 120,
        height: 140, // Ensures it fills the container
        backgroundColor: '#fafafa',
        resizeMode: 'contain',
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        alignSelf: 'center',

    },

    cardContent: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 10,
        marginVertical: 5,
        alignItems: 'flex-start',

    },

    title: {
        fontSize: 15,
        fontWeight: '500',
        color: '#222',

    },

    description: {
        fontSize: 14,
        fontWeight: '400',
        color: '#666',
        marginTop: 4,
    },

    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    price: {
        fontSize: 14,
        fontWeight: '400',
        color: 'black'
    },
    separator: {

        margin: 2,
        width: '98%',
        borderWidth: 0.5,
        borderColor: '#ddd',
    },

    productDetailsContainer: {
        marginTop: 10,

    },

    productDetailsText: {
        fontSize: 14,
        color: '#075cab',
        fontWeight: '600',
    },
    filterContainer: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '80%',
        backgroundColor: '#fff',
        zIndex: 100,
        elevation: 10,
        padding: 16,
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },


    buttonWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: -5
    },

    applyButton: {
        width: 80,
        paddingVertical: 6,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#075cab',
        // borderWidth: 1,
        // backgroundColor: '#075cab',
        // elevation: 2,
        // shadowColor: '#000',
        // shadowOpacity: 0.1,
        // shadowRadius: 6,
        // shadowOffset: { width: 0, height: 3 },
    },

    applyButtonText: {
        color: '#075cab',
        fontWeight: '600',
        fontSize: 14,
    },

    clearButton: {
        width: 80,
        paddingVertical: 6,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#FF3B30',
        // borderWidth: 1,
        // backgroundColor: 'white',
        // elevation: 2,
        // shadowColor: '#000',
        // shadowOpacity: 0.1,
        // shadowRadius: 6,
        // shadowOffset: { width: 0, height: 3 },
    },

    clearButtonText: {
        color: '#FF0000',
        fontWeight: '600',
        fontSize: 14,
    },

    divider: {
        borderBottomWidth: 0.5,
        borderBottomColor: "#ccc",
        marginVertical: 10,
    },

    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },

    checkbox: {
        width: 13,
        height: 13,
        // borderRadius: 6,
        borderWidth: 1,
        borderColor: 'gray',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },

    checkboxChecked: {
        backgroundColor: '#075cab',
    },

    checkboxLabel: {
        fontSize: 12,
        color: '#333',
    },


});





export default ProductsList;

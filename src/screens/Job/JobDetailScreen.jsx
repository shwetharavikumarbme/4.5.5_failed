
import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Modal, ToastAndroid, Linking, RefreshControl, SafeAreaView, Pressable, TouchableWithoutFeedback, Share, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from 'react-native-fast-image';
import default_image from '../../images/homepage/buliding.jpg'
import ImageViewer from 'react-native-image-zoom-viewer';
import apiClient from '../ApiClient';
import ContactSupplierModal from '../helperComponents.jsx/ContactsModal';
import { showToast } from '../AppUtils/CustomToast';
import { useNetwork } from '../AppUtils/IdProvider';
import { openMediaViewer } from '../helperComponents.jsx/mediaViewer';

const defaultImage = Image.resolveAssetSource(default_image).uri;
const JobDetailScreen = ({ route }) => {
  const { myId, myData } = useNetwork();
  const { post_id } = route.params || {};

  const [profileCreated, setProfileCreated] = useState(false)
  const navigation = useNavigation();
  const [post, setPost] = useState([])
  const [jobImageUrls, setJobImageUrls] = useState({});
  const [isApplied, setIsApplied] = useState(false);
  const [isModalVisibleImage, setModalVisibleImage] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalVisible1, setModalVisible1] = useState(false);


  const openModal = (type) => {
    setModalVisible(true);
  };


  const fetchProfile1 = async () => {
    if (!myId) return;
  
    try {
      const response = await apiClient.post('/getUserDetails', {
        command: 'getUserDetails',
        user_id: myId,
      });
  
      if (response.data.status === 'success') {
        const profileData = response.data.status_message;
        setProfile(profileData);
      }
    } catch (error) {
      console.error('❌ Error in fetchProfile1:', error);
    }
  };
  



  const fetchProfile = async () => {
    try {
      const response = await apiClient.post('/getJobProfiles', {
        command: 'getJobProfiles',
        user_id: myId,
      });
  
      if (response.data.status === 'error') {
        setProfileCreated(false);
      } else if (response.data.status === 'success') {
        const profileData = response.data.response?.[0];
        setProfileCreated(!!profileData); // true if profileData exists, false otherwise
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      setProfileCreated(false); // Optional fallback
    }
  };
  


  useEffect(() => {
    fetchProfile();
    fetchProfile1();
  }, [])
  const withTimeout = (promise, timeout = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
    ]);
  };

  const fetchJobs = async () => {
    try {
      const requestData = {
        command: 'getJobPost',
        post_id: post_id,
      };

      const res = await withTimeout(apiClient.post('/getJobPost', requestData), 5000);

      const hasValidResponse = res.data.response?.length > 0;

      if (hasValidResponse) {
        const jobData = res.data.response[0];
        setPost(jobData);

        let imageUrl = defaultImage;

        if (jobData.fileKey) {
          try {
            const imgRes = await apiClient.post('/getObjectSignedUrl', {
              command: 'getObjectSignedUrl',
              key: jobData.fileKey,
            });
            if (imgRes.data) {
              imageUrl = imgRes.data;
            }
          } catch (error) {
            console.warn('Error fetching image URL, using default:', error);
          }
        }

        setJobImageUrls(prevUrls => ({
          ...prevUrls,
          [jobData.post_id]: imageUrl,
        }));
      } else {
        setPost({ removed_by_author: true });
      }

    } catch (error) {

      showToast('Network error', 'error')
    }
  };



  useEffect(() => {
    fetchJobs();
    fetchAppliedJobs();
  }, [])


  const shareJob = async (post) => {
    try {
      const baseUrl = 'https://bmebharat.com/jobs/post/';
      const jobUrl = `${baseUrl}${post.post_id}`;

      const result = await Share.share({
        message: `Check out this job opportunity!\n${jobUrl}`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {

        } else {

        }
      } else if (result.action === Share.dismissedAction) {

      }
    } catch (error) {

    }
  };





  const fetchAppliedJobs = async () => {
    try {
      const response = await apiClient.post('/getUsersAppliedJobs', {
        command: 'getUsersAppliedJobs',
        user_id: myId,
      });

      if (response.data.status === "success" && response.data.response) {
        const appliedJobsList = response.data.response;

        const appliedJob = appliedJobsList.find(job => job.post_id === post_id);
        setIsApplied(appliedJob?.applied_status === "Applied");

      } else {
        setIsApplied(false);
      }
    } catch (error) {

    }
  };



  const handleApplyJob = async () => {
    if (!profileCreated) {

      showToast('Please create your job profile before applying', 'info');

      setTimeout(() => {
        navigation.navigate('UserJobProfileCreate');
      }, 300);

      return;
    }

    if (isApplied) {

      handleRevoke(post.job_title);
    } else {
      try {
        const response = await apiClient.post('/applyJobs', {
          command: 'applyJobs',
          company_id: post.company_id,
          user_id: myId,
          post_id: post.post_id,
        });

        if (response.data.status === 'success') {
          setIsApplied(true);

          showToast('Job application successful', 'success');

        } else {
          showToast('Something went wrong', 'error');

        }
      } catch (error) {

        showToast('Something went wrong', 'error');

      }
    }
  };


  const confirmAction = () => {
    handleRevoke();
    setModalVisible(false);
  };


  const handleRevoke = async () => {
    try {

      const response = await apiClient.post('/revokeJobs', {
        command: "revokeJobs",
        company_id: post.company_id,
        user_id: myId,
        post_id: post.post_id,
      });

      if (response.data.status === 'success') {
        setIsApplied(false);
        showToast('The application has been successfully revoked', 'success');

      } else {
        showToast('Something went wrong', 'error');

      }
    } catch (error) {
      showToast('Network error', 'error');

    }
  };
  
  const handleNavigate = (company_id) => {
    navigation.navigate('CompanyDetailsPage', { userId: company_id });
  };

  const toggleModal = useCallback(() => setModalVisibleImage(!isModalVisibleImage), [isModalVisibleImage]);

  const handleCancel = () => {
    toggleModal(false);

  };

  if (!post) {

    return (
      <SafeAreaView style={styles.container}>

        <View style={styles.headerContainer}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home3');
              }
            }}
          >
            <Icon name="arrow-left" size={24} color="#075cab" />
          </TouchableOpacity>

        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size='small' color='#075cab' />
        </View>
      </SafeAreaView>
    );
  }

  if (post?.removed_by_author) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home3'); // Fallback to a safe screen
              }
            }}
          >
            <Icon name="arrow-left" size={24} color="#075cab" />
          </TouchableOpacity>

        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: 'gray' }}>This post was removed by the author</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (

    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home3');
            }
          }}
        >
          <Icon name="arrow-left" size={24} color="#075cab" />
        </TouchableOpacity>


        <TouchableOpacity onPress={() => shareJob(post)} style={styles.dropdownItem}>
          <Icon name="share" size={20} color="#075cab" style={styles.icon} />
          <Text style={styles.dropdownText}>Share</Text>
        </TouchableOpacity>
      </View>

      <>
        {post ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: '20%' }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.imageContainer}>

                <TouchableOpacity
                 onPress={() => openMediaViewer([{ type: 'image', url: jobImageUrls[post?.post_id] }])}
                  activeOpacity={1}
                >
                  <FastImage
                    source={{ uri: jobImageUrls[post?.post_id] }}
                    style={styles.detailImage}
                    resizeMode={jobImageUrls[post?.post_id]?.includes('buliding.jpg') ? 'cover' : 'contain'}
                  />
                </TouchableOpacity>


              </View>


              <View style={styles.textContainer1}>
                <Text style={styles.title}>{post?.job_title || 'No Title'}</Text>
              </View>
              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={styles.label}>Company</Text>
                </View>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.value} onPress={() => handleNavigate(post?.company_id)} >{post?.company_name || ''}</Text>
              </View>


              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={styles.label}>Category</Text>
                </View>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.value}>{post?.category || ''}</Text>
              </View>

              {post?.Website?.trimStart().trimEnd() ? (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Website</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.Website.trim()}</Text>
                </View>
              ) : null}

              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={styles.label}>Industry type</Text>
                </View>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.value}>{post?.industry_type || ''}</Text>
              </View>

              {post?.required_qualifications?.trim() && (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Required qualification</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.required_qualifications.trim()}</Text>
                </View>
              )}

              {post?.required_expertise?.trim() && (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Required expertise</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.required_expertise.trim()}</Text>
                </View>
              )}

              {post?.experience_required?.trim() && (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Required experience</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.experience_required.trim()}</Text>
                </View>
              )}

              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={[styles.label]}>Required speicializations </Text>
                </View>
                <Text style={styles.colon}>:</Text>

                <Text style={[styles.value]}>{post?.speicializations_required || ''}</Text>
              </View>

              {post?.working_location?.trim() && (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Work location</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.working_location.trim()}</Text>
                </View>
              )}


              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={styles.label}>Salary package</Text>
                </View>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.value}>{post?.Package || ''}</Text>
              </View>

              {post?.job_description?.trimStart().trimEnd() ? (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={styles.label}>Job description</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={styles.value}>{post?.job_description.trim()}</Text>
                </View>
              ) : null}



              {post?.preferred_languages?.trimStart().trimEnd() ? (
                <View style={styles.detailContainer}>
                  <View style={styles.lableIconContainer}>
                    <Text style={[styles.label]}>Required languages</Text>
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <Text style={[styles.value]}>{post?.preferred_languages || ''}</Text>
                </View>
              ) : null}

              <View style={styles.detailContainer}>
                <View style={styles.lableIconContainer}>
                  <Text style={styles.label}>Posted on</Text>
                </View>
                <Text style={styles.colon}>:</Text>
                <Text style={styles.value}>
                  {
                    post?.job_post_created_on
                      ? (() => {
                        const date = new Date(post?.job_post_created_on * 1000);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = String(date.getFullYear());

                        return `${day}/${month}/${year}`;
                      })()
                      : ''
                  }
                </Text>

              </View>

              {myId !== post?.company_id && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible1(true);
                    }}
                    style={{ padding: 10 }}
                  >
                    <Text style={styles.contact}>Contact details</Text>
                  </TouchableOpacity>

                  <ContactSupplierModal
                    visible={modalVisible1}
                    onClose={() => {
                      setModalVisible1(false);
                    }}
                    company_id={post?.company_id}
                  />
                </>
              )}

            </TouchableOpacity>
          </ScrollView>
        ) : null}



        {(profile?.user_type === 'users') && (
          <TouchableOpacity
            style={[
              styles.applyButton,
              isApplied && styles.applyButtonRevoke,
            ]}
            onPress={() => {
              if (!profileCreated) {

                showToast("Job profile doesn't exists. Create one before applying for a job", 'info');

                setTimeout(() => {
                  navigation.navigate('UserJobProfileCreate');
                }, 300);
              } else {
                if (isApplied) {
                  openModal('revoke');
                } else {
                  handleApplyJob();
                }
              }
            }}

            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, isApplied && styles.revokeText]}>
              {isApplied ? 'Revoke' : 'Apply'}
            </Text>
          </TouchableOpacity>
        )}
      </>


      <Modal visible={isModalVisibleImage} transparent={true} animationType="slide"
        onRequestClose={handleCancel}>
        <View style={styles.modalContainerImage}>
          <ImageViewer
            imageUrls={[{ url: jobImageUrls[post?.post_id] }]}
            enableSwipeDown={true}
            onSwipeDown={toggleModal}
            showIndicators={false}
            renderIndicator={() => null}
          />
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton1}>
            <Icon name="close" size={24} color="white" />
          </TouchableOpacity>

        </View>
      </Modal>

      <Modal
        transparent={true}
        animationType="fade"
        visible={isModalVisible}

      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              Confirm revocation
            </Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to revoke your application?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText1}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={confirmAction}
              >
                <Text style={styles.buttonText2}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>




    </SafeAreaView >

  );
};




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffff',

  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
  },

  value: {
    flex: 2, // Take the remaining space
    flexShrink: 1,
    color: 'black',
    fontWeight: '400',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',
  },
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between', // Distribute the icons evenly
    alignItems: 'center',
    paddingHorizontal: 20,

    elevation: 5, // Optional, adds shadow for Android
  },

  stickyContactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 50,

  },
  createPostButtonShare: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 50,

  },

  dropdownText: {
    fontSize: 16,
    color: '#075cab',
  },
  applyButtonText: {
    marginLeft: 5,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075cab',
    bottom: -9
  },

  icon: {
    marginRight: 5,
  },
  textContainer1: {
    textAlign: 'center',
    padding: 10,

  },
  title: {
    color: 'black',
    fontWeight: '700',
    fontSize: 15,
    paddingHorizontal: 12,
  },

  textContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  detailContainer: {

    flexDirection: 'row',  // Align label and detail in a row
    alignItems: 'center',  // Center the items vertically
    elevation: 3, // Android shadow
    backgroundColor: 'white',
    shadowColor: '#0d6efd', // iOS shadow color
    shadowOffset: { width: 0, height: 2 }, // iOS shadow offset
    shadowOpacity: 0.2, // iOS shadow opacity
    shadowRadius: 3, // iOS shadow radius
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10
  },
  lableIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '35%', // Label and icon occupy 35% of the row
  },

  label: {
    flex: 1, // Take up available space
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'left', // Align text to the left
    alignSelf: 'flex-start',

  },
  colon: {
    width: 20, // Fixed width for the colon
    textAlign: 'center', // Center the colon
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    alignSelf: 'flex-start',

  },
  label1: {
    width: '35%', // Occupies 35% of the row
    color: 'black',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'justify',
  },
  value1: {
    flex: 1,
    flexShrink: 1, // Allows the text to wrap within available space
    color: 'black',
    fontWeight: '300',
    fontSize: 15,
    textAlign: 'justify',
    marginTop: 10,
    lineHeight: 23,
  },



  dropdownContainer1: {
    position: 'absolute',
    top: 45,
    right: 19,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 5,
    zIndex: 1,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  icon: {
    marginRight: 10,
  },

  dropdownText: {
    fontSize: 16,
    color: '#075cab',
  },
  imageContainer: {
    width: '100%',
    height: 250,
    padding: 15,

  },

  detailImage: {
    width: '100%',
    height: '100%',

  },
  body: {
    fontSize: 16,
    color: '#333',
    textAlign: 'justify',
    lineHeight: 22

  },
  modalContainerImage: { flex: 1, backgroundColor: 'white' },
  closeButton1: { position: 'absolute', top: 70, right: 10 },
  modalImage: { width: '100%', height: '100%', resizeMode: 'contain' },

  createPostButton: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    width: 35,
    height: 35,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: "#075cab"
  },
  noPostsText: {
    fontWeight: '400',
    textAlign: 'center',
    padding: 10,
    fontSize: 16

  },
  contact: {
    fontSize: 16,
    color: '#075cab',
    textDecorationLine: 'underline',
    marginTop: 10,
    textAlign: 'center'
  },

  applyButton: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    width: 80,
    paddingVertical: 8,
    borderRadius: 25,
    borderColor: '#075cab',
    borderWidth: 1,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    
  },


  applyButtonRevoke: {
    borderColor: '#FF0000',

  },

  buttonText: {
    color: '#075cab',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    transition: 'color 0.3s ease',
  },

  revokeText: {
    color: '#FF0000',
  },

  buttonActive: {
    opacity: 0.8,
  },

  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  modalMessage: {
    fontSize: 15,
    color: 'black',
    marginBottom: 20,
    textAlign: 'center', // Centered message
    fontWeight: '400',
    lineHeight: 23,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
    margin: 10
  },

  buttonText1: {
    color: 'red',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonText2: {
    color: 'green',
    fontSize: 17,
    fontWeight: '600',
  },

  phoneNumber: {
    color: '#075cab',
    fontWeight: 'bold',
    padding: 10,

  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  modalContent: {
    width: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },

  modalText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#000',
  },

  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,

    borderRadius: 20,
  },
  closeButtonText: {
    color: '#075cab',
    fontSize: 16,
  },


});


export default JobDetailScreen;
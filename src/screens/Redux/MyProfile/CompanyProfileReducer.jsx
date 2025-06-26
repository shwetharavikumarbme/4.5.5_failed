import company from '../../../images/homepage/buliding.jpg';
import maleImage from '../../../images/homepage/dummy.png';
import femaleImage from '../../../images/homepage/female.jpg';
import { Image } from 'react-native';

const defaultLogo = Image.resolveAssetSource(company).uri;
const defaultMaleImage = Image.resolveAssetSource(maleImage).uri;
const defaultFemaleImage = Image.resolveAssetSource(femaleImage).uri;

const initialState = {
  profile: null,
};

const CompanyReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'UPDATE_COMPANY_PROFILE': {
      const incoming = action.payload || {};
      const current = state.profile || {};

      let imageUrl = null;

      if (!incoming.fileKey || incoming.fileKey.trim() === '') {
        if (incoming.user_type === 'company') {
          imageUrl = defaultLogo;
        } else if (incoming.gender?.toLowerCase() === 'female') {
          imageUrl = defaultFemaleImage;
        } else {
          imageUrl = defaultMaleImage;
        }
      } else {
        imageUrl = incoming.imageUrl || null;
      }

      return {
        ...state,
        profile: {
          ...current,
          ...incoming,
          imageUrl,
        },
      };
    }

    default:
      return state;
  }
};

export default CompanyReducer;

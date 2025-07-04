import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated from 'react-native-reanimated';

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

// In your component
<AnimatedIcon 
  name="magnify" 
  size={24} 
  color="#fff"
  style={{
    transform: [{
      scale: searchButtonOpacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1],
      })
    }]
  }}
/>
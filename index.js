// App entry: register the Android home-screen widgets, then start the app's screens.
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  require('./src/widgets/register');
}

require('expo-router/entry');

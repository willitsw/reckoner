import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import type { BiometricPort } from '@/src/ports/biometric';

export function createExpoBiometricAdapter(): BiometricPort {
  return {
    async isAvailable() {
      if (Platform.OS === 'web') return false;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && enrolled;
    },
    async authenticate(promptMessage = 'Unlock Reckoner') {
      if (Platform.OS === 'web') return true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    },
  };
}

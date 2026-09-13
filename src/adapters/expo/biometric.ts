import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import type { BiometricPort } from '@/src/ports/biometric';

const LOCK_KEY = 'reckoner.app-lock';

async function deviceCanLock() {
  if (Platform.OS === 'web') return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export function createExpoBiometricAdapter(): BiometricPort {
  return {
    isAvailable: deviceCanLock,

    async label() {
      if (Platform.OS === 'web') return 'biometrics';
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
      }
      return 'biometrics';
    },

    async isLockEnabled() {
      if (!(await deviceCanLock())) return false;
      return (await AsyncStorage.getItem(LOCK_KEY)) === '1';
    },

    async setLockEnabled(enabled) {
      if (enabled && !(await deviceCanLock())) {
        throw new Error('Biometrics are not available on this device.');
      }
      if (enabled) await AsyncStorage.setItem(LOCK_KEY, '1');
      else await AsyncStorage.removeItem(LOCK_KEY);
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

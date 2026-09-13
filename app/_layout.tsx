import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AppLockProvider, AppLockScreen, useAppLock } from '@/src/modules/auth/app-lock';
import { SessionProvider, useSession } from '@/src/modules/auth/session-context';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SessionProvider>
      <AppLockProvider>
        <RootLayoutNav />
      </AppLockProvider>
    </SessionProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading, pendingPasswordReset } = useSession();
  const appLock = useAppLock();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const onSignIn = segments[0] === 'sign-in';
    const onReset = segments[0] === 'reset-password';

    if (pendingPasswordReset && !onReset) {
      router.replace('/reset-password');
      return;
    }
    if (!session && !onSignIn && !onReset) {
      router.replace('/sign-in');
    } else if (session && !pendingPasswordReset && (onSignIn || onReset)) {
      router.replace('/(tabs)');
    }
  }, [session, loading, pendingPasswordReset, segments, router]);

  const holdForLock = Boolean(session) && !appLock.ready;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {holdForLock ? null : appLock.locked ? (
        <AppLockScreen />
      ) : (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen
            name="process/[id]"
            options={{ title: 'Process', headerBackTitle: 'Library' }}
          />
          <Stack.Screen name="run/[id]" options={{ title: 'Run' }} />
        </Stack>
      )}
    </ThemeProvider>
  );
}

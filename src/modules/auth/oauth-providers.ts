import type { OAuthProvider } from '@/src/ports/auth';

/**
 * Which SSO buttons the sign-in screen should show.
 * Apple is iOS-only (App Store expectation + platform support).
 */
export function oauthProvidersForPlatform(platform: string): OAuthProvider[] {
  if (platform === 'ios') return ['google', 'apple'];
  return ['google'];
}

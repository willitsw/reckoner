import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { oauthProvidersForPlatform } from '../src/modules/auth/oauth-providers';

describe('OAuth provider availability on sign-in', () => {
  it('offers Google on web and iOS', () => {
    assert.deepEqual(oauthProvidersForPlatform('web'), ['google']);
    assert.ok(oauthProvidersForPlatform('ios').includes('google'));
  });

  it('offers Apple on iOS only', () => {
    assert.deepEqual(oauthProvidersForPlatform('ios'), ['google', 'apple']);
    assert.ok(!oauthProvidersForPlatform('web').includes('apple'));
    assert.ok(!oauthProvidersForPlatform('android').includes('apple'));
  });
});

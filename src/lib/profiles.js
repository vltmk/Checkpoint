/**
 * profiles.js - Profile Management Engine for CHECKPOINT
 * Supports dual profiles: 'booster' (default) and 'advertiser'.
 * Manages profile metadata, active profile persistence, and cross-profile synchronization.
 */

export const ACTIVE_PROFILE_STORAGE_KEY = 'checkpoint_active_profile';
export const ONBOARDING_COMPLETED_KEY = 'checkpoint_profile_onboarding_completed';
export const ADVERTISER_LAST_FEE_KEY = 'checkpoint_advertiser_last_fee_percent';

export const PROFILES = Object.freeze({
  booster: {
    id: 'booster',
    name: 'Booster',
    nameFa: 'بوستر',
    icon: 'Zap',
    badge: '⚡ Booster',
    badgeFa: '⚡ بوستر',
    dbPath: 'sqlite:checkpoint.db', // Canonical existing database path
    supportsQuickAdd: true,
    supportsOrderId: false,
    roleTerm: 'Booster',
    roleTermFa: 'بوستر',
    sourceLabel: 'Seller / Source',
    sourceLabelFa: 'سورس / فروشنده',
    teamLabel: 'Teammates',
    teamLabelFa: 'هم‌تیمی‌ها',
    defaultSource: '',
  },
  advertiser: {
    id: 'advertiser',
    name: 'Advertiser',
    nameFa: 'ادورتایزر',
    icon: 'Megaphone',
    badge: '📢 Advertiser',
    badgeFa: '📢 ادورتایزر',
    dbPath: 'sqlite:checkpoint_advertiser.db', // Isolated advertiser database
    supportsQuickAdd: false,
    supportsOrderId: true,
    roleTerm: 'Advertiser',
    roleTermFa: 'ادورتایزر',
    sourceLabel: 'Source / Platform',
    sourceLabelFa: 'سورس / پلتفرم',
    teamLabel: 'Assigned Boosters',
    teamLabelFa: 'بوستر(های) اختصاص‌یافته',
    defaultSource: '',
  },
});

export const SHARED_SYNC_SETTING_KEYS = [
  'checkpoint_custom_categories_v1',
  'checkpoint_user_saved_sources_v2',
  'checkpoint_saved_teammates_v1',
  'checkpoint_gold_rate_toman',
  'checkpoint_currency',
];

/**
 * Get active profile ID. Defaults to 'booster'.
 */
export function getActiveProfileId() {
  if (typeof localStorage === 'undefined') return 'booster';
  const saved = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
  if (saved && PROFILES[saved]) {
    return saved;
  }
  return 'booster';
}

/**
 * Check if the user has completed or bypassed the first-launch onboarding.
 */
export function isOnboardingCompleted() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
}

export const isProfileOnboardingCompleted = isOnboardingCompleted;

export function setProfileOnboardingCompleted(completed = true) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(completed));
  }
}

/**
 * Set the active profile ID and broadcast an event for real-time reactivity.
 */
export function setActiveProfileId(profileId) {
  if (!PROFILES[profileId]) return;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('checkpoint:profile-changed', {
        detail: { profileId, profile: PROFILES[profileId] },
      })
    );
  }
}

/**
 * Get the profile config object for an ID.
 */
export function getProfileConfig(profileId = null) {
  const id = profileId || getActiveProfileId();
  return PROFILES[id] || PROFILES.booster;
}

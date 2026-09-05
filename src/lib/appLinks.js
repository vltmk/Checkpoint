/**
 * App-Aware Link Detection & Deep Linking Engine for Checkpoint
 * Detects supported platforms (Discord, Telegram, Steam, Google Sheets, GitHub)
 * and resolves native desktop application protocol URIs (e.g., discord://, tg://, steam://).
 */

/**
 * Platform identifiers
 * @typedef {'discord' | 'telegram' | 'steam' | 'sheets' | 'github' | 'generic'} AppPlatform
 */

/**
 * Detailed platform metadata
 * @typedef {Object} AppLinkInfo
 * @property {AppPlatform} platform - Platform identifier
 * @property {string} label - Clean display label (e.g. "Discord Message")
 * @property {string} [labelFa] - Persian display label
 * @property {boolean} appLaunchable - Whether this platform can launch an installed OS application
 * @property {string|null} deepLinkUrl - OS protocol URI (discord://, tg://, steam://) or null if browser-based
 * @property {string} canonicalUrl - Safe normalized HTTPS or scheme URL
 * @property {string} raw - Original input string
 */

/**
 * Normalizes input URL strings, adding https:// if protocol is omitted.
 * @param {string} rawInput
 * @returns {string}
 */
export function normalizeUrl(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('discord://') ||
    lower.startsWith('tg://') ||
    lower.startsWith('steam://') ||
    lower.startsWith('mailto:')
  ) {
    return trimmed;
  }

  // If user pasted e.g. "discord.com/..." or "t.me/..." or "docs.google.com/..."
  if (lower.startsWith('www.') || lower.includes('.')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Inspects a URL and determines platform, deep-link URI, and human-friendly metadata.
 * @param {string} rawUrl
 * @returns {AppLinkInfo | null}
 */
export function detectAppLink(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = normalizeUrl(rawUrl);
  if (!url) return null;

  const lower = url.toLowerCase();

  // 1. DISCORD
  if (
    lower.startsWith('discord://') ||
    lower.includes('discord.com/') ||
    lower.includes('discordapp.com/') ||
    lower.includes('discord.gg/')
  ) {
    return resolveDiscordLink(url);
  }

  // 2. TELEGRAM
  if (
    lower.startsWith('tg://') ||
    lower.includes('t.me/') ||
    lower.includes('telegram.me/')
  ) {
    return resolveTelegramLink(url);
  }

  // 3. STEAM
  if (
    lower.startsWith('steam://') ||
    lower.includes('steamcommunity.com/') ||
    lower.includes('store.steampowered.com/')
  ) {
    return resolveSteamLink(url);
  }

  // 4. GOOGLE SHEETS / DOCS
  if (lower.includes('docs.google.com/spreadsheets')) {
    return {
      platform: 'sheets',
      label: 'Google Sheets',
      labelFa: 'گوگل شیت',
      appLaunchable: false,
      deepLinkUrl: null,
      canonicalUrl: url,
      raw: rawUrl,
    };
  }

  if (lower.includes('docs.google.com/document')) {
    return {
      platform: 'sheets',
      label: 'Google Docs',
      labelFa: 'گوگل داکز',
      appLaunchable: false,
      deepLinkUrl: null,
      canonicalUrl: url,
      raw: rawUrl,
    };
  }

  // 5. GITHUB
  if (lower.includes('github.com/')) {
    return {
      platform: 'github',
      label: 'GitHub',
      labelFa: 'گیت‌هاب',
      appLaunchable: false,
      deepLinkUrl: null,
      canonicalUrl: url,
      raw: rawUrl,
    };
  }

  // 6. GENERIC WEB LINK
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    let hostname = '';
    try {
      hostname = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      hostname = 'Web Link';
    }

    return {
      platform: 'generic',
      label: hostname || 'Web Link',
      labelFa: hostname || 'پیوند وب',
      appLaunchable: false,
      deepLinkUrl: null,
      canonicalUrl: url,
      raw: rawUrl,
    };
  }

  return null;
}

/**
 * Resolves Discord web URLs or URIs to discord:// deep links.
 */
function resolveDiscordLink(url) {
  // Already a native discord:// protocol
  if (url.toLowerCase().startsWith('discord://')) {
    return {
      platform: 'discord',
      label: 'Discord',
      labelFa: 'دیسکورد',
      appLaunchable: true,
      deepLinkUrl: url,
      canonicalUrl: url,
      raw: url,
    };
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Channels / Messages: /channels/{guild_id|@me}/{channel_id}/{message_id?}
    const channelMatch = pathname.match(/\/channels\/([^/]+)\/([^/]+)(?:\/([^/]+))?/);
    if (channelMatch) {
      const [, guildId, channelId, messageId] = channelMatch;
      const deepLink = messageId
        ? `discord://-/channels/${guildId}/${channelId}/${messageId}`
        : `discord://-/channels/${guildId}/${channelId}`;

      const isMessage = Boolean(messageId);
      return {
        platform: 'discord',
        label: isMessage ? 'Discord Message' : 'Discord Channel',
        labelFa: isMessage ? 'پیام دیسکورد' : 'کانال دیسکورد',
        appLaunchable: true,
        deepLinkUrl: deepLink,
        canonicalUrl: url,
        raw: url,
      };
    }

    // Invites: discord.gg/{code} or discord.com/invite/{code}
    if (parsed.hostname === 'discord.gg' || pathname.startsWith('/invite/')) {
      const code = parsed.hostname === 'discord.gg' 
        ? pathname.replace(/^\//, '').split('/')[0] 
        : pathname.replace(/^\/invite\//, '').split('/')[0];

      if (code) {
        return {
          platform: 'discord',
          label: 'Discord Invite',
          labelFa: 'دعوتنامه دیسکورد',
          appLaunchable: true,
          deepLinkUrl: `discord://-/invite/${code}`,
          canonicalUrl: url,
          raw: url,
        };
      }
    }
  } catch (e) {
    // Ignore URL parse error and fall back
  }

  // Fallback for other general discord.com URLs
  return {
    platform: 'discord',
    label: 'Discord',
    labelFa: 'دیسکورد',
    appLaunchable: true,
    deepLinkUrl: `discord://-`,
    canonicalUrl: url,
    raw: url,
  };
}

/**
 * Resolves Telegram web URLs or URIs to tg:// deep links.
 */
function resolveTelegramLink(url) {
  if (url.toLowerCase().startsWith('tg://')) {
    return {
      platform: 'telegram',
      label: 'Telegram',
      labelFa: 'تلگرام',
      appLaunchable: true,
      deepLinkUrl: url,
      canonicalUrl: url,
      raw: url,
    };
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Private post: /c/{chat_id}/{post_id}
    const privateMatch = pathname.match(/^\/c\/(\d+)\/(\d+)/);
    if (privateMatch) {
      const [, channelId, postId] = privateMatch;
      return {
        platform: 'telegram',
        label: 'Telegram Post',
        labelFa: 'پست تلگرام',
        appLaunchable: true,
        deepLinkUrl: `tg://privatepost?channel=${channelId}&post=${postId}`,
        canonicalUrl: url,
        raw: url,
      };
    }

    // Join / Invite link: /+{hash} or /joinchat/{hash}
    const joinMatch = pathname.match(/^\/(?:\+|joinchat\/)([a-zA-Z0-9_-]+)/);
    if (joinMatch) {
      const [, hash] = joinMatch;
      return {
        platform: 'telegram',
        label: 'Telegram Invite',
        labelFa: 'لینک عضویت تلگرام',
        appLaunchable: true,
        deepLinkUrl: `tg://join?invite=${hash}`,
        canonicalUrl: url,
        raw: url,
      };
    }

    // Public post: /{domain}/{post_id}
    const publicPostMatch = pathname.match(/^\/([a-zA-Z0-9_]{4,})\/(\d+)/);
    if (publicPostMatch) {
      const [, domain, postId] = publicPostMatch;
      return {
        platform: 'telegram',
        label: 'Telegram Post',
        labelFa: 'پست تلگرام',
        appLaunchable: true,
        deepLinkUrl: `tg://resolve?domain=${domain}&post=${postId}`,
        canonicalUrl: url,
        raw: url,
      };
    }

    // Username / Channel / Bot: /{domain}
    const domainMatch = pathname.match(/^\/([a-zA-Z0-9_]{4,})/);
    if (domainMatch) {
      const domain = domainMatch[1];
      return {
        platform: 'telegram',
        label: 'Telegram Chat',
        labelFa: 'چت تلگرام',
        appLaunchable: true,
        deepLinkUrl: `tg://resolve?domain=${domain}`,
        canonicalUrl: url,
        raw: url,
      };
    }
  } catch (e) {
    // Ignore URL parse error
  }

  return {
    platform: 'telegram',
    label: 'Telegram',
    labelFa: 'تلگرام',
    appLaunchable: true,
    deepLinkUrl: 'tg://',
    canonicalUrl: url,
    raw: url,
  };
}

/**
 * Resolves Steam web URLs or URIs to steam:// deep links.
 */
function resolveSteamLink(url) {
  if (url.toLowerCase().startsWith('steam://')) {
    return {
      platform: 'steam',
      label: 'Steam',
      labelFa: 'استیم',
      appLaunchable: true,
      deepLinkUrl: url,
      canonicalUrl: url,
      raw: url,
    };
  }

  try {
    const parsed = new URL(url);

    // Steam Store app page: /app/{appId}
    const storeMatch = parsed.pathname.match(/\/app\/(\d+)/);
    if (storeMatch) {
      const appId = storeMatch[1];
      return {
        platform: 'steam',
        label: 'Steam Store',
        labelFa: 'استور استیم',
        appLaunchable: true,
        deepLinkUrl: `steam://store/${appId}`,
        canonicalUrl: url,
        raw: url,
      };
    }

    // Steam Community (profiles, inventory, trade offers, guides)
    // steam://openurl/{URL} opens any web URL directly in the native Steam client
    return {
      platform: 'steam',
      label: 'Steam',
      labelFa: 'استیم',
      appLaunchable: true,
      deepLinkUrl: `steam://openurl/${url}`,
      canonicalUrl: url,
      raw: url,
    };
  } catch (e) {
    // Fallback
  }

  return {
    platform: 'steam',
    label: 'Steam',
    labelFa: 'استیم',
    appLaunchable: true,
    deepLinkUrl: `steam://openurl/${url}`,
    canonicalUrl: url,
    raw: url,
  };
}

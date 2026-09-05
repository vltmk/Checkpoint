import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAppLink, normalizeUrl } from '../src/lib/appLinks.js';

test('normalizeUrl handles protocol prefixes and missing protocols', () => {
  assert.equal(normalizeUrl(''), '');
  assert.equal(normalizeUrl('   '), '');
  assert.equal(normalizeUrl(null), '');
  assert.equal(normalizeUrl('https://discord.com'), 'https://discord.com');
  assert.equal(normalizeUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeUrl('discord://-/channels/123/456'), 'discord://-/channels/123/456');
  assert.equal(normalizeUrl('tg://resolve?domain=test'), 'tg://resolve?domain=test');
  assert.equal(normalizeUrl('steam://openurl/https://steamcommunity.com'), 'steam://openurl/https://steamcommunity.com');
  assert.equal(normalizeUrl('discord.com/channels/1/2'), 'https://discord.com/channels/1/2');
  assert.equal(normalizeUrl('t.me/channel_name'), 'https://t.me/channel_name');
  assert.equal(normalizeUrl('docs.google.com/spreadsheets/d/123'), 'https://docs.google.com/spreadsheets/d/123');
});

test('detectAppLink: Discord channel and message deep linking', () => {
  // Server Channel
  const channelLink = detectAppLink('https://discord.com/channels/1029384756/987654321');
  assert.equal(channelLink.platform, 'discord');
  assert.equal(channelLink.label, 'Discord Channel');
  assert.equal(channelLink.appLaunchable, true);
  assert.equal(channelLink.deepLinkUrl, 'discord://-/channels/1029384756/987654321');

  // Server Message
  const msgLink = detectAppLink('https://discord.com/channels/1029384756/987654321/5566778899');
  assert.equal(msgLink.platform, 'discord');
  assert.equal(msgLink.label, 'Discord Message');
  assert.equal(msgLink.appLaunchable, true);
  assert.equal(msgLink.deepLinkUrl, 'discord://-/channels/1029384756/987654321/5566778899');

  // Direct Message (@me)
  const dmLink = detectAppLink('https://discord.com/channels/@me/987654321/5566778899');
  assert.equal(dmLink.platform, 'discord');
  assert.equal(dmLink.deepLinkUrl, 'discord://-/channels/@me/987654321/5566778899');

  // Discord Canary / PTB / App domains
  const canaryLink = detectAppLink('https://canary.discord.com/channels/1/2/3');
  assert.equal(canaryLink.platform, 'discord');
  assert.equal(canaryLink.deepLinkUrl, 'discord://-/channels/1/2/3');

  const appDomainLink = detectAppLink('https://discordapp.com/channels/1/2/3');
  assert.equal(appDomainLink.platform, 'discord');
  assert.equal(appDomainLink.deepLinkUrl, 'discord://-/channels/1/2/3');

  // Server Invite (discord.gg and discord.com/invite)
  const ggInvite = detectAppLink('https://discord.gg/TYPRXeKPp');
  assert.equal(ggInvite.platform, 'discord');
  assert.equal(ggInvite.label, 'Discord Invite');
  assert.equal(ggInvite.deepLinkUrl, 'discord://-/invite/TYPRXeKPp');

  const comInvite = detectAppLink('https://discord.com/invite/TYPRXeKPp');
  assert.equal(comInvite.platform, 'discord');
  assert.equal(comInvite.deepLinkUrl, 'discord://-/invite/TYPRXeKPp');

  // Raw discord:// URI
  const rawDiscord = detectAppLink('discord://-/channels/11/22/33');
  assert.equal(rawDiscord.platform, 'discord');
  assert.equal(rawDiscord.deepLinkUrl, 'discord://-/channels/11/22/33');
});

test('detectAppLink: Telegram deep linking', () => {
  // Username / User / Bot
  const userLink = detectAppLink('https://t.me/sovrgn0');
  assert.equal(userLink.platform, 'telegram');
  assert.equal(userLink.label, 'Telegram Chat');
  assert.equal(userLink.appLaunchable, true);
  assert.equal(userLink.deepLinkUrl, 'tg://resolve?domain=sovrgn0');

  // Public channel post
  const postLink = detectAppLink('https://t.me/checkpoint_news/42');
  assert.equal(postLink.platform, 'telegram');
  assert.equal(postLink.label, 'Telegram Post');
  assert.equal(postLink.deepLinkUrl, 'tg://resolve?domain=checkpoint_news&post=42');

  // Private channel post
  const privatePost = detectAppLink('https://t.me/c/1234567890/99');
  assert.equal(privatePost.platform, 'telegram');
  assert.equal(privatePost.deepLinkUrl, 'tg://privatepost?channel=1234567890&post=99');

  // Invite link (+hash)
  const inviteLink = detectAppLink('https://t.me/+abcdefgh12345');
  assert.equal(inviteLink.platform, 'telegram');
  assert.equal(inviteLink.label, 'Telegram Invite');
  assert.equal(inviteLink.deepLinkUrl, 'tg://join?invite=abcdefgh12345');

  // Raw tg:// URI
  const rawTg = detectAppLink('tg://resolve?domain=test');
  assert.equal(rawTg.platform, 'telegram');
  assert.equal(rawTg.deepLinkUrl, 'tg://resolve?domain=test');
});

test('detectAppLink: Steam deep linking', () => {
  // Steam Community Profile
  const profileLink = detectAppLink('https://steamcommunity.com/id/boosterpro');
  assert.equal(profileLink.platform, 'steam');
  assert.equal(profileLink.appLaunchable, true);
  assert.equal(profileLink.deepLinkUrl, 'steam://openurl/https://steamcommunity.com/id/boosterpro');

  // Steam Community Trade Offer
  const tradeLink = detectAppLink('https://steamcommunity.com/tradeoffer/new/?partner=12345678');
  assert.equal(tradeLink.platform, 'steam');
  assert.equal(tradeLink.deepLinkUrl, 'steam://openurl/https://steamcommunity.com/tradeoffer/new/?partner=12345678');

  // Steam Store App
  const storeLink = detectAppLink('https://store.steampowered.com/app/730/CounterStrike_2/');
  assert.equal(storeLink.platform, 'steam');
  assert.equal(storeLink.label, 'Steam Store');
  assert.equal(storeLink.deepLinkUrl, 'steam://store/730');

  // Raw steam:// URI
  const rawSteam = detectAppLink('steam://openurl/https://steamcommunity.com');
  assert.equal(rawSteam.platform, 'steam');
  assert.equal(rawSteam.deepLinkUrl, 'steam://openurl/https://steamcommunity.com');
});

test('detectAppLink: Google Sheets and Docs', () => {
  const sheetLink = detectAppLink('https://docs.google.com/spreadsheets/d/1abcXYZ123_456/edit#gid=0');
  assert.equal(sheetLink.platform, 'sheets');
  assert.equal(sheetLink.label, 'Google Sheets');
  assert.equal(sheetLink.appLaunchable, false);
  assert.equal(sheetLink.deepLinkUrl, null);

  const docLink = detectAppLink('https://docs.google.com/document/d/1abcXYZ123_456/edit');
  assert.equal(docLink.platform, 'sheets');
  assert.equal(docLink.label, 'Google Docs');
  assert.equal(docLink.appLaunchable, false);
});

test('detectAppLink: GitHub and Generic links', () => {
  const ghLink = detectAppLink('https://github.com/vltmk/Checkpoint');
  assert.equal(ghLink.platform, 'github');
  assert.equal(ghLink.label, 'GitHub');
  assert.equal(ghLink.appLaunchable, false);

  const webLink = detectAppLink('https://dashboard.nodra.gg/orders/123');
  assert.equal(webLink.platform, 'generic');
  assert.equal(webLink.label, 'dashboard.nodra.gg');
  assert.equal(webLink.appLaunchable, false);
});

test('detectAppLink: Invalid or empty inputs do not throw', () => {
  assert.equal(detectAppLink(null), null);
  assert.equal(detectAppLink(''), null);
  assert.equal(detectAppLink('    '), null);
  assert.equal(detectAppLink(123), null);
});

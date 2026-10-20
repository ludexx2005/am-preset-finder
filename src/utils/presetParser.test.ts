import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePresetLinks,
  validateSocialUrl,
  extractYouTubeVideoId,
  unwrapYouTubeRedirectLinksInText,
  inspectQrCodePayload,
  convertOrExtractAlightCreativeUrl,
  extractUrlParametersList,
  normalizeRawTikwmComment,
  normalizeRawTikwmReply,
  extractPresetLinksFromCommentsAndReplies,
  mergeUniquePresetLinks,
} from './presetParser.ts';

test('parsePresetLinks separates 5MB, XML, and Shortlinks without altering URLs', () => {
  const sampleCaption = `
    Preset 5MB Alight Link: https://alight.link/u8x9AbCdEf123456
    Share Link Resmi: https://alightcreative.com/am/share/u/6x89AbCdEfGhIjKlMnOpQrStUvWxYz/p/1a2b3c4d5e6f7g8h9i0j-123456
    Link XML Google Drive: https://drive.google.com/file/d/1xYzAbC99887766/view?usp=sharing
    Link XML Mediafire: https://www.mediafire.com/file/99aabbcc/Preset_AM_Full.xml/file
    Shortlink: https://bit.ly/3xYzAbC
  `;

  const result = parsePresetLinks(sampleCaption);

  assert.equal(result.links5mb.length, 2);
  assert.equal(result.links5mb[0].url, 'https://alight.link/u8x9AbCdEf123456');
  assert.equal(result.links5mb[0].needsAlightResolve, true);
  assert.equal(
    result.links5mb[1].url,
    'https://alightcreative.com/am/share/u/6x89AbCdEfGhIjKlMnOpQrStUvWxYz/p/1a2b3c4d5e6f7g8h9i0j-123456'
  );
  assert.equal(result.links5mb[1].needsAlightResolve, false);

  assert.equal(result.linksXml.length, 2);
  assert.equal(result.shortlinks.length, 1);
});

test('inspectQrCodePayload preserves rawPayload 100% unmodified', () => {
  const rawQr1 = 'http://alight.link/rQ9xYz123AbC?d=1';
  const info1 = inspectQrCodePayload(rawQr1);
  // Must not change even a single character of rawPayload (not even http -> https)
  assert.equal(info1.rawPayload, rawQr1);
  assert.equal(info1.isAlightShortlink, true);
  assert.equal(info1.isAlightCreativeShare, false);

  const rawQr2 =
    'https://alightcreative.com/am/share/u/FYPCreatorID/p/SlowmoVelo8K?pkg=full&fps=60';
  const info2 = inspectQrCodePayload(rawQr2);
  assert.equal(info2.rawPayload, rawQr2);
  assert.equal(info2.isAlightCreativeShare, true);
  assert.equal(info2.directAlightCreativeUrl, rawQr2);
});

test('convertOrExtractAlightCreativeUrl converts embedded Dynamic Links and alight:// schemes to https://alightcreative.com/am/share/u/.../p/...', () => {
  const fromDynamicLinkParam = convertOrExtractAlightCreativeUrl(
    'https://alight.link/?link=https%3A%2F%2Falightcreative.com%2Fam%2Fshare%2Fu%2FUser99%2Fp%2FPreset88%3Fver%3D2&apn=com.alightcreative.motion'
  );
  assert.equal(
    fromDynamicLinkParam,
    'https://alightcreative.com/am/share/u/User99/p/Preset88?ver=2'
  );

  const fromAlightScheme = convertOrExtractAlightCreativeUrl(
    'alight://am/share/u/User99/p/Preset88?ver=2'
  );
  assert.equal(
    fromAlightScheme,
    'https://alightcreative.com/am/share/u/User99/p/Preset88?ver=2'
  );

  const fromAlightShortPath = convertOrExtractAlightCreativeUrl(
    'https://alight.link/u/User99/p/Preset88?ver=2'
  );
  assert.equal(
    fromAlightShortPath,
    'https://alightcreative.com/am/share/u/User99/p/Preset88?ver=2'
  );

  // Short token without /u/.../p/... returns null so it is resolved via real HTTP redirect
  const opaqueShortToken = convertOrExtractAlightCreativeUrl(
    'https://alight.link/aBcDeFgHiJkLmNoP'
  );
  assert.equal(opaqueShortToken, null);
});

test('extractUrlParametersList extracts u (User ID), p (Package ID), and query parameters intact', () => {
  const params = extractUrlParametersList(
    'https://alightcreative.com/am/share/u/EditorKelasAtas/p/GlowShake5MB?pkg=full&rev=3'
  );
  assert.equal(params.length, 4);
  assert.deepEqual(params[0], { key: 'u (User ID)', value: 'EditorKelasAtas' });
  assert.deepEqual(params[1], { key: 'p (Package ID)', value: 'GlowShake5MB' });
  assert.deepEqual(params[2], { key: 'pkg', value: 'full' });
  assert.deepEqual(params[3], { key: 'rev', value: '3' });
});

test('validateSocialUrl validates TikTok, Instagram, and YouTube links with all parameters intact', () => {
  const ttCheck = validateSocialUrl(
    'https://www.tiktok.com/@user/video/7419882341092837649?is_from_webapp=1'
  );
  assert.equal(ttCheck.isValid, true);
  assert.equal(ttCheck.platform, 'tiktok');
  assert.equal(
    ttCheck.normalizedUrl,
    'https://www.tiktok.com/@user/video/7419882341092837649?is_from_webapp=1'
  );

  const ytWatch = validateSocialUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s');
  assert.equal(ytWatch.isValid, true);
  assert.equal(ytWatch.platform, 'youtube');
  assert.equal(ytWatch.videoId, 'dQw4w9WgXcQ');

  const ytShort = validateSocialUrl('https://youtube.com/shorts/dQw4w9WgXcQ?si=abc123');
  assert.equal(ytShort.isValid, true);
  assert.equal(ytShort.platform, 'youtube');
  assert.equal(ytShort.videoId, 'dQw4w9WgXcQ');

  const ytBe = validateSocialUrl('https://youtu.be/dQw4w9WgXcQ?si=xyz999');
  assert.equal(ytBe.isValid, true);
  assert.equal(ytBe.platform, 'youtube');
  assert.equal(ytBe.videoId, 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('unwrapYouTubeRedirectLinksInText and parsePresetLinks extract preset URLs inside YouTube redirect links intact', () => {
  const ytDescriptionWithRedirect =
    'Preset 5MB: https://www.youtube.com/redirect?event=video_description&redir_token=QUFFLUhqa123&q=https%3A%2F%2Falight.link%2Fu%2FCreatorYT%2Fp%2FPresetYT5MB%3Fpkg%3Dfull&v=dQw4w9WgXcQ';
  const unwrapped = unwrapYouTubeRedirectLinksInText(ytDescriptionWithRedirect);
  assert.equal(
    unwrapped,
    'Preset 5MB: https://alight.link/u/CreatorYT/p/PresetYT5MB?pkg=full'
  );

  const parsed = parsePresetLinks(ytDescriptionWithRedirect);
  assert.equal(parsed.links5mb.length, 1);
  assert.equal(
    parsed.links5mb[0].url,
    'https://alight.link/u/CreatorYT/p/PresetYT5MB?pkg=full'
  );
  assert.equal(
    parsed.links5mb[0].resolvedUrl,
    'https://alightcreative.com/am/share/u/CreatorYT/p/PresetYT5MB?pkg=full'
  );
});

test('extractPresetLinksFromCommentsAndReplies extracts 5MB, XML, and shortlinks from top-level comments and nested replies', () => {
  const comment1 = normalizeRawTikwmComment(
    {
      id: 'c-101',
      video_id: 'v-999',
      text: 'Ini kak preset 5MB nya: https://alight.link/u/CreatorJedag/p/JedagJedugFull?fps=60',
      create_time: 1710000100,
      digg_count: 145,
      reply_total: 2,
      user: {
        id: 'u-1',
        unique_id: 'editor_am_official',
        nickname: 'Editor AM Official',
        avatar: '',
      },
    },
    'editor_am_official'
  );

  const reply1 = normalizeRawTikwmReply(
    {
      id: 'r-201',
      video_id: 'v-999',
      text: 'Buat yang cari versi XML Google Drive ini ya: https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drivesdk',
      create_time: 1710000200,
      digg_count: 34,
      user: {
        id: 'u-2',
        unique_id: 'bantu_share_preset',
        nickname: 'Preset Helper',
        avatar: '',
      },
    },
    'c-101',
    'editor_am_official'
  );

  comment1.replies = [reply1];
  comment1.repliesLoaded = true;

  const extracted = extractPresetLinksFromCommentsAndReplies([comment1]);
  assert.equal(extracted.length, 2);
  assert.equal(
    extracted[0].url,
    'https://alight.link/u/CreatorJedag/p/JedagJedugFull?fps=60'
  );
  assert.equal(
    extracted[0].resolvedUrl,
    'https://alightcreative.com/am/share/u/CreatorJedag/p/JedagJedugFull?fps=60'
  );
  assert.equal(extracted[0].label, 'Komentar Kreator @editor_am_official');

  assert.equal(
    extracted[1].url,
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drivesdk'
  );
  assert.equal(extracted[1].category, 'xml');
  assert.equal(extracted[1].label, 'Balasan @bantu_share_preset');

  // Verify mergeUniquePresetLinks deduplicates if caption already had the same link
  const merged = mergeUniquePresetLinks([extracted[0]], extracted);
  assert.equal(merged.length, 2);
});

test('formatVideoTimestamp and buildYouTubeEmbedUrl format player timestamps and embed URLs', async () => {
  const { formatVideoTimestamp, buildYouTubeEmbedUrl } = await import('./presetParser.ts');
  assert.equal(formatVideoTimestamp(0), '0:00');
  assert.equal(formatVideoTimestamp(9.8), '0:09');
  assert.equal(formatVideoTimestamp(65), '1:05');
  assert.equal(formatVideoTimestamp(3661), '1:01:01');
  assert.equal(formatVideoTimestamp(-5), '0:00');

  assert.equal(
    buildYouTubeEmbedUrl('dQw4w9WgXcQ'),
    'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&rel=0&modestbranding=1&playsinline=1'
  );
  assert.equal(
    buildYouTubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share'),
    'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&rel=0&modestbranding=1&playsinline=1'
  );
  assert.equal(buildYouTubeEmbedUrl('https://www.tiktok.com/@u/video/123'), null);
});



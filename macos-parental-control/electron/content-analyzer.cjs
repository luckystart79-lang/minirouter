/**
 * Content Analyzer
 * 
 * Analyzes browsing history URLs to determine content safety.
 * - YouTube: fetches video metadata (title, channel, description)
 * - Other sites: fetches page meta tags
 * - Classifies content: Safe / Caution / Danger
 * - Flags: 18+, violence, gambling, drugs, horror, inappropriate
 */

const https = require('https');
const http = require('http');

// --- Danger keywords (Vietnamese + English) ---
const DANGER_KEYWORDS = {
  adult: [
    'porn', 'xxx', 'sex', '18+', 'nsfw', 'adult only', 'hentai', 'onlyfans',
    'nude', 'naked', 'erotic', 'phim sex', 'clip nóng', 'khiêu dâm',
    'gái gọi', 'sugar baby', 'dating', 'hookup'
  ],
  violence: [
    'gore', 'brutal', 'murder', 'kill', 'blood', 'torture', 'execution',
    'bạo lực', 'giết người', 'đánh nhau', 'máu me', 'kinh dị', 'creepypasta',
    'jumpscare', 'horror compilation', 'scary'
  ],
  gambling: [
    'casino', 'gambling', 'poker', 'slot', 'bet365', 'cá cược', 'cá độ',
    'xổ số', 'đánh bạc', 'lô đề', 'baccarat', 'tài xỉu'
  ],
  drugs: [
    'drug', 'cocaine', 'weed', 'marijuana', 'heroin', 'meth',
    'ma túy', 'cần sa', 'thuốc lắc', 'ketamine', 'vaping', 'thuốc lá điện tử'
  ],
  scam: [
    'free robux', 'free vbucks', 'hack account', 'password hack',
    'get rich quick', 'kiếm tiền online nhanh', 'lừa đảo'
  ]
};

// --- Caution keywords (not dangerous but parents should know) ---
const CAUTION_KEYWORDS = {
  wastetime: [
    'tiktok compilation', 'shorts', 'meme', 'funny video', 'prank',
    'reaction video', 'drama', 'gossip', 'nhảm', 'hài hước', 'troll',
    'challenge', 'mukbang', 'asmr', 'unboxing'
  ],
  gaming_excessive: [
    'gameplay', 'walkthrough', 'speedrun', 'live stream gaming',
    'fortnite', 'roblox', 'minecraft', 'genshin', 'valorant',
    'free fire', 'pubg', 'league of legends', 'liên quân'
  ],
  social_drama: [
    'beef', 'drama', 'scandal', 'expose', 'cancelled', 'tea',
    'phốt', 'lộ clip', 'bóc phốt', 'showbiz'
  ]
};

// --- Safe keywords ---
const SAFE_KEYWORDS = [
  'tutorial', 'education', 'learn', 'study', 'course', 'lecture',
  'science', 'math', 'history', 'documentary', 'ted talk', 'khan academy',
  'coding', 'programming', 'howto', 'diy',
  'học', 'bài giảng', 'giáo dục', 'kiến thức', 'khoa học', 'toán', 'lịch sử'
];

/**
 * Fetch YouTube video metadata via oEmbed (no API key needed)
 */
function fetchYouTubeInfo(url) {
  return new Promise((resolve) => {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    https.get(oembedUrl, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({
            title: info.title || '',
            channel: info.author_name || '',
            thumbnail: info.thumbnail_url || ''
          });
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null))
      .on('timeout', function() { this.destroy(); resolve(null); });
  });
}

/**
 * Fetch page meta tags (title, description) for any URL
 */
function fetchPageMeta(url) {
  return new Promise((resolve) => {
    const getter = url.startsWith('https') ? https : http;
    
    getter.get(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPageMeta(res.headers.location).then(resolve);
      }
      
      let html = '';
      res.on('data', chunk => {
        html += chunk;
        if (html.length > 50000) res.destroy(); // Don't download entire page
      });
      res.on('end', () => {
        const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || '';
        const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
        const keywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
        resolve({ title, description: desc, keywords });
      });
    }).on('error', () => resolve(null))
      .on('timeout', function() { this.destroy(); resolve(null); });
  });
}

/**
 * Classify content safety based on text analysis
 * Returns: { safety: 'safe'|'caution'|'danger', flags: string[], details: string }
 */
function classifyContent(url, text) {
  const lower = (url + ' ' + text).toLowerCase();
  const flags = [];
  let safety = 'safe';

  // Explicit check for Shorts and TikTok (wastetime: shorts)
  if (url.includes('youtube.com/shorts') || url.includes('youtu.be/shorts') || url.includes('tiktok.com')) {
    safety = 'caution';
    flags.push('⚠️ wastetime: shorts');
  }

  // Check DANGER keywords
  if (safety !== 'danger') {
    for (const [category, keywords] of Object.entries(DANGER_KEYWORDS)) {
      const matched = keywords.filter(kw => lower.includes(kw));
      if (matched.length > 0) {
        safety = 'danger';
        flags.push(`🚫 ${category.toUpperCase()}: ${matched.join(', ')}`);
      }
    }
  }

  // Check CAUTION keywords (only if not already flagged as danger)
  if (safety !== 'danger') {
    for (const [category, keywords] of Object.entries(CAUTION_KEYWORDS)) {
      const matched = keywords.filter(kw => lower.includes(kw));
      if (matched.length > 0 && !flags.some(f => f.includes(category))) {
        safety = 'caution';
        flags.push(`⚠️ ${category}: ${matched.join(', ')}`);
      }
    }
  }

  // Check SAFE keywords
  const safeMatched = SAFE_KEYWORDS.filter(kw => lower.includes(kw));
  if (safeMatched.length > 0 && safety !== 'danger') {
    if (safety === 'caution') {
      // Mixed: has both caution and safe signals
    } else {
      safety = 'safe';
    }
    flags.push(`✅ Educational: ${safeMatched.join(', ')}`);
  }

  return { safety, flags };
}

/**
 * Analyze a single history entry — enrich with content metadata + safety rating
 */
async function analyzeEntry(entry) {
  const { url, title } = entry;
  let enrichedTitle = title;
  let description = '';
  let channel = '';

  // YouTube: get video metadata
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    const ytInfo = await fetchYouTubeInfo(url);
    if (ytInfo) {
      enrichedTitle = ytInfo.title || title;
      channel = ytInfo.channel;
    }
  }

  // Combine all text for classification
  const allText = `${enrichedTitle} ${description} ${channel}`;
  const { safety, flags } = classifyContent(url, allText);

  return {
    ...entry,
    enrichedTitle,
    channel,
    description,
    safety,    // 'safe' | 'caution' | 'danger'
    flags      // array of flag strings
  };
}

/**
 * Batch analyze history entries (with rate limiting)
 * Only analyzes entries that haven't been analyzed yet
 */
async function analyzeHistory(entries, maxAnalyze = 20) {
  const results = [];
  let analyzed = 0;

  for (const entry of entries) {
    // Quick classification based on title + URL (always, no network)
    const { safety, flags } = classifyContent(entry.url, entry.title);
    
    results.push({
      ...entry,
      enrichedTitle: entry.title,
      safety,
      flags,
      channel: ''
    });
  }

  // For YouTube URLs, enrich with oEmbed data (limited to avoid rate limits)
  for (let i = 0; i < results.length && analyzed < maxAnalyze; i++) {
    const entry = results[i];
    if (entry.url.includes('youtube.com/watch') || entry.url.includes('youtu.be/')) {
      const ytInfo = await fetchYouTubeInfo(entry.url);
      if (ytInfo) {
        entry.enrichedTitle = ytInfo.title || entry.title;
        entry.channel = ytInfo.channel;
        // Re-classify with enriched data
        const reText = `${entry.enrichedTitle} ${entry.channel}`;
        const reclassified = classifyContent(entry.url, reText);
        entry.safety = reclassified.safety;
        entry.flags = reclassified.flags;
      }
      analyzed++;
    }
  }

  return results;
}

module.exports = { analyzeHistory, classifyContent, fetchYouTubeInfo };

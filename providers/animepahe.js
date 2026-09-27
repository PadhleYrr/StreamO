// AnimePahe provider — https://animepahe.ru (kwik.cx streams)
// Anime only. High quality, multiple resolutions.

var SOURCE_ID = 'animepahe';
var SITE = 'https://animepahe.ru';
var API = 'https://animepahe.ru/api';
var KWIK = 'https://kwik.cx';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': SITE + '/' };

function getInfo() {
  return { name: 'AnimePahe', lang: 'en', baseUrl: SITE,
           logo: SITE + '/favicon.ico', type: 'anime', version: '1.0.0' };
}

// ── Search ────────────────────────────────────────────────────────────────────
function search(query, page) {
  var url = API + '?m=search&q=' + encodeURIComponent(String(query || ''));
  return fetch(url, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var results = data.data || [];
      var out = [];
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        out.push({
          id: 'anime:' + item.session,
          title: item.title || '',
          cover: item.poster || null,
          url: 'anime:' + item.session,
          type: 'anime', sourceId: SOURCE_ID
        });
      }
      return out;
    })
    .catch(function() { return []; });
}

// ── Detail ────────────────────────────────────────────────────────────────────
function getDetail(url) {
  var session = String(url).replace('anime:', '');
  return _fetchAllEpisodes(session, 1, []);
}

function _fetchAllEpisodes(session, page, acc) {
  var epUrl = API + '?m=release&id=' + session + '&sort=episode_asc&page=' + page;
  return fetch(epUrl, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var eps = data.data || [];
      for (var i = 0; i < eps.length; i++) {
        var ep = eps[i];
        acc.push({
          id: 'ep:' + ep.session,
          title: 'Episode ' + ep.episode,
          number: ep.episode,
          url: 'ep:' + ep.session,
          thumbnail: ep.snapshot || null
        });
      }
      // Paginate
      if (data.next_page_url && page < 10) {
        return _fetchAllEpisodes(session, page + 1, acc);
      }
      // Get show metadata
      return fetch(SITE + '/anime/' + session, { headers: HEADERS, timeoutMs: 10000 })
        .then(function(r2) {
          var html = r2.body || '';
          var titleMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
          var title = titleMatch ? titleMatch[1].trim() : session;
          var coverMatch = html.match(/<div[^>]*class="[^"]*poster[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);
          var cover = coverMatch ? coverMatch[1] : null;
          var descMatch = html.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/);
          var desc = descMatch ? htmlText(descMatch[1]) : '';
          return { id: 'anime:' + session, title: title, cover: cover, description: desc,
                   status: 'completed', genres: [], studios: [],
                   type: 'anime', sourceId: SOURCE_ID, episodes: acc };
        })
        .catch(function() {
          return { id: 'anime:' + session, title: session, cover: null, description: '',
                   status: 'completed', genres: [], studios: [],
                   type: 'anime', sourceId: SOURCE_ID, episodes: acc };
        });
    })
    .catch(function() {
      return { id: 'anime:' + session, title: session, cover: null, description: '',
               status: 'completed', genres: [], studios: [],
               type: 'anime', sourceId: SOURCE_ID, episodes: acc };
    });
}

// ── Streams ───────────────────────────────────────────────────────────────────
function getVideoSources(episodeUrl) {
  var session = String(episodeUrl).replace('ep:', '');
  var apiUrl = API + '?m=links&id=' + session;
  return fetch(apiUrl, { headers: HEADERS, timeoutMs: 12000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var links = data.data || [];
      if (!links.length) return [];
      // Each link has { kwik, resolution, audio } — resolve kwik URLs in parallel
      var jobs = links.slice(0, 4).map(function(link) {
        return _resolveKwik(link.kwik, link.resolution, link.audio)
               .catch(function() { return null; });
      });
      return Promise.all(jobs).then(function(results) {
        var out = [];
        for (var i = 0; i < results.length; i++) {
          if (results[i]) out.push(results[i]);
        }
        return out;
      });
    })
    .catch(function() { return []; });
}

function _resolveKwik(kwikUrl, resolution, audio) {
  return fetch(kwikUrl, {
    headers: { 'User-Agent': UA, 'Referer': SITE + '/', 'Origin': KWIK },
    timeoutMs: 10000
  }).then(function(r) {
    var html = r.body || '';
    // Extract cookie from Set-Cookie header
    var cookie = '';
    var sc = r.headers && (r.headers['set-cookie'] || r.headers['Set-Cookie']);
    if (sc) {
      var ck = String(sc).match(/_utmz=([^;]+)/);
      if (ck) cookie = '_utmz=' + ck[1];
    }
    // Find the obfuscated script: eval(function(p,a,c,k,e,d)
    var scriptMatch = html.match(/eval\(function\(p,a,c,k,e,[dr]\)[^)]+\)([^;]+;)/);
    if (!scriptMatch) {
      // Try plain m3u8 link
      var m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
      if (m3u8Match) {
        return _buildSource(m3u8Match[0], resolution, audio, kwikUrl, cookie);
      }
      return null;
    }
    // Unpack the p,a,c,k encoded payload
    var unpacked = _unpackPack(scriptMatch[0] + scriptMatch[1]);
    var m3u8Match = unpacked ? unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/) : null;
    if (!m3u8Match) {
      // Try key extraction: look for const source = '...'
      var srcMatch = html.match(/source\s*=\s*'(https?:\/\/[^']+\.m3u8[^']*)'/);
      if (!srcMatch) return null;
      return _buildSource(srcMatch[1], resolution, audio, kwikUrl, cookie);
    }
    return _buildSource(m3u8Match[0], resolution, audio, kwikUrl, cookie);
  });
}

function _buildSource(url, resolution, audio, referer, cookie) {
  var headers = { 'User-Agent': UA, 'Referer': referer || KWIK + '/' };
  if (cookie) headers['Cookie'] = cookie;
  var kind = audio === 'jpn' || audio === 'ja' ? 'sub' : 'dub';
  return { url: url, quality: resolution || 'auto', container: 'hls',
           kind: kind, audioLang: kind === 'dub' ? 'en' : 'ja',
           headers: headers, subtitles: [] };
}

// Minimal p,a,c,k unpacker
function _unpackPack(src) {
  try {
    var m = src.match(/\}\('(.+)',(\d+),(\d+),'([^']+)'\.split/);
    if (!m) return null;
    var p = m[1], a = parseInt(m[2]), c = parseInt(m[3]);
    var k = m[4].split('|');
    var e = function(c) { return (c < a ? '' : e(Math.floor(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36)); };
    while (c--) { if (k[c]) p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]); }
    return p;
  } catch(ex) { return null; }
}

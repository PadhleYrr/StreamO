// VidSrc provider — https://vidsrc.me (TMDB-based embed scraper)
// Covers movies and TV. Episode URL format: tmdbId|type|season|episode
// type = 'movie' | 'tv'. season/episode = 0 for movies.

var SOURCE_ID = 'vidsrc';
var SITE = 'https://vidsrc.me';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var IMG_BASE = 'https://image.tmdb.org/t/p/w500';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function getInfo() {
  return { name: 'VidSrc', lang: 'en', baseUrl: SITE,
           logo: SITE + '/favicon.ico', type: 'movie', version: '2.0.0' };
}

// ── TMDB search ──────────────────────────────────────────────────────────────
function _tmdbFetch(path) {
  return fetch('https://api.themoviedb.org/3' + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + TMDB_KEY)
    .then(function(r) {
      try { return JSON.parse(r.body || '{}'); } catch(e) { return {}; }
    });
}

function search(query, page) {
  return _tmdbFetch('/search/multi?query=' + encodeURIComponent(String(query || '')) + '&page=' + (page || 1))
    .then(function(data) {
      var results = data.results || [];
      var out = [];
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
        out.push({
          id: item.id + '|' + item.media_type,
          title: item.title || item.name || '',
          cover: item.poster_path ? IMG_BASE + item.poster_path : null,
          url: item.id + '|' + item.media_type,
          type: item.media_type === 'tv' ? 'series' : 'movie',
          sourceId: SOURCE_ID
        });
      }
      return out;
    });
}

function popular(opts) {
  var page = (opts && opts.page) || 1;
  return _tmdbFetch('/trending/all/week?page=' + page)
    .then(function(data) {
      var results = data.results || [];
      var out = [];
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
        out.push({
          id: item.id + '|' + item.media_type,
          title: item.title || item.name || '',
          cover: item.poster_path ? IMG_BASE + item.poster_path : null,
          url: item.id + '|' + item.media_type,
          type: item.media_type === 'tv' ? 'series' : 'movie',
          sourceId: SOURCE_ID
        });
      }
      return out;
    });
}

function getHome() {
  return Promise.all([
    _tmdbFetch('/trending/all/week').then(function(d) { return { title: 'Trending This Week', items: _mapResults(d.results || []) }; }),
    _tmdbFetch('/movie/popular').then(function(d) { return { title: 'Popular Movies', items: _mapResults(d.results || []) }; }),
    _tmdbFetch('/tv/popular').then(function(d) { return { title: 'Popular TV Shows', items: _mapResults(d.results || []) }; }),
    _tmdbFetch('/movie/top_rated').then(function(d) { return { title: 'Top Rated Movies', items: _mapResults(d.results || []) }; })
  ]).catch(function() { return []; });
}

function _mapResults(results) {
  var out = [];
  for (var i = 0; i < results.length; i++) {
    var item = results[i];
    var type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    out.push({
      id: item.id + '|' + type,
      title: item.title || item.name || '',
      cover: item.poster_path ? IMG_BASE + item.poster_path : null,
      url: item.id + '|' + type,
      type: type === 'tv' ? 'series' : 'movie',
      sourceId: SOURCE_ID
    });
  }
  return out;
}

// ── Detail + episodes ─────────────────────────────────────────────────────────
function getDetail(url) {
  var parts = String(url).split('|');
  var tmdbId = parts[0], type = parts[1] || 'movie';
  return _tmdbFetch('/' + type + '/' + tmdbId + (type === 'tv' ? '?append_to_response=seasons' : ''))
    .then(function(data) {
      var episodes = [];
      if (type === 'movie') {
        episodes.push({ id: url + '|0|0', title: data.title || 'Movie',
                        number: 1, url: url + '|0|0' });
      } else {
        var seasons = data.seasons || [];
        for (var s = 0; s < seasons.length; s++) {
          var season = seasons[s];
          if (!season || season.season_number === 0) continue;
          var ec = season.episode_count || 0;
          for (var e = 1; e <= ec; e++) {
            var sn = season.season_number;
            episodes.push({
              id: url + '|' + sn + '|' + e,
              title: 'S' + _pad(sn) + 'E' + _pad(e),
              number: (sn - 1) * 1000 + e,
              url: url + '|' + sn + '|' + e,
              season: sn, episode: e
            });
          }
        }
      }
      return {
        id: url, title: data.title || data.name || url,
        cover: data.poster_path ? IMG_BASE + data.poster_path : null,
        description: data.overview || '', status: 'completed',
        genres: (data.genres || []).map(function(g) { return g.name; }),
        studios: [], type: type === 'tv' ? 'series' : 'movie',
        sourceId: SOURCE_ID, episodes: episodes
      };
    });
}

function _pad(n) { return n < 10 ? '0' + n : String(n); }

// ── Stream resolution ─────────────────────────────────────────────────────────
// VidSrc embed page → server list → RCP handler → stream URL
var BASEDOM = 'https://vidsrc.me';
var VSRC_HEADERS = { 'User-Agent': UA, 'Referer': SITE + '/' };

function getVideoSources(episodeUrl) {
  var parts = String(episodeUrl).split('|');
  var tmdbId = parts[0], type = parts[1] || 'movie';
  var season = parts[2] ? parseInt(parts[2]) : 0;
  var episode = parts[3] ? parseInt(parts[3]) : 0;

  var embedUrl;
  if (type === 'movie') {
    embedUrl = SITE + '/embed/movie/' + tmdbId;
  } else {
    embedUrl = SITE + '/embed/tv/' + tmdbId + '/' + season + '/' + episode;
  }

  return fetch(embedUrl, { headers: VSRC_HEADERS, timeoutMs: 15000 })
    .then(function(r) {
      var html = r.body || '';
      // Extract servers: class="server" data-hash="..."
      var servers = [];
      var re = /data-hash="([^"]+)"/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        servers.push(m[1]);
      }
      if (!servers.length) return [];
      // Fetch all server RCP entries in parallel, take first 3
      var jobs = servers.slice(0, 3).map(function(hash) {
        return _resolveServer(hash).catch(function() { return []; });
      });
      return Promise.all(jobs).then(function(results) {
        var out = [];
        for (var i = 0; i < results.length; i++) {
          if (results[i] && results[i].length) {
            out = out.concat(results[i]);
          }
        }
        return out;
      });
    })
    .catch(function() { return []; });
}

function _resolveServer(hash) {
  return fetch(BASEDOM + '/rcp/' + hash, { headers: VSRC_HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var body = r.body || '';
      // Extract src: 'https://...'
      var srcMatch = body.match(/src:\s*'([^']+)'/);
      if (!srcMatch) return [];
      var src = srcMatch[1];
      // Could be a further redirect — handle /prorcp/ pattern
      if (src.indexOf('/prorcp/') === 0) {
        return _resolveProrcp(src.replace('/prorcp/', ''));
      }
      if (!src.startsWith('http')) return [];
      return _extractStreams(src);
    })
    .catch(function() { return []; });
}

function _resolveProrcp(hash) {
  return fetch(BASEDOM + '/prorcp/' + hash, { headers: VSRC_HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var urls = _parseM3u8Urls(r.body || '');
      if (urls.length) return urls;
      // Try direct stream
      var urlMatch = (r.body || '').match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
      if (urlMatch) return _extractStreams(urlMatch[0]);
      return [];
    })
    .catch(function() { return []; });
}

function _extractStreams(url) {
  if (!url) return Promise.resolve([]);
  if (url.indexOf('.m3u8') >= 0) {
    return _parseHlsMaster(url);
  }
  return Promise.resolve([{ url: url, quality: 'auto', container: 'mp4',
                             headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: [] }]);
}

function _parseHlsMaster(masterUrl) {
  return fetch(masterUrl, { headers: { 'Referer': SITE + '/', 'User-Agent': UA }, timeoutMs: 8000 })
    .then(function(r) {
      var body = r.body || '';
      if (!body.includes('#EXT-X-STREAM-INF')) {
        // Not a master playlist — direct segment playlist
        return [{ url: masterUrl, quality: 'auto', container: 'hls',
                  headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: [] }];
      }
      return _parseM3u8Urls(body, masterUrl);
    })
    .catch(function() {
      return [{ url: masterUrl, quality: 'auto', container: 'hls',
                headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: [] }];
    });
}

function _parseM3u8Urls(body, base) {
  var re = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
  var out = [];
  var m;
  while ((m = re.exec(body)) !== null) {
    var h = parseInt(m[1]), segUrl = m[2].trim();
    if (h < 360) continue;
    if (!segUrl.startsWith('http') && base) {
      var slash = base.lastIndexOf('/');
      segUrl = (slash >= 0 ? base.substring(0, slash + 1) : base + '/') + segUrl;
    }
    out.push({ url: segUrl, quality: h + 'p', container: 'hls',
               headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: [] });
  }
  if (!out.length && base) {
    out.push({ url: base, quality: 'auto', container: 'hls',
               headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: [] });
  }
  return out;
}

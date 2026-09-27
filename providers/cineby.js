// Cineby provider — https://cineby.app (TMDB-based, good quality)
// Movies + TV.

var SOURCE_ID = 'cineby';
var SITE = 'https://cineby.app';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var IMG_BASE = 'https://image.tmdb.org/t/p/w500';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';

function getInfo() {
  return { name: 'Cineby', lang: 'en', baseUrl: SITE,
           logo: SITE + '/favicon.ico', type: 'movie', version: '1.0.0' };
}

function _tmdbFetch(path) {
  var sep = path.indexOf('?') >= 0 ? '&' : '?';
  return fetch('https://api.themoviedb.org/3' + path + sep + 'api_key=' + TMDB_KEY)
    .then(function(r) { try { return JSON.parse(r.body || '{}'); } catch(e) { return {}; } });
}

function search(query, page) {
  return _tmdbFetch('/search/multi?query=' + encodeURIComponent(String(query || '')) + '&page=' + (page || 1))
    .then(function(data) {
      var out = [];
      for (var i = 0; i < (data.results || []).length; i++) {
        var item = data.results[i];
        if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
        out.push({ id: item.id + '|' + item.media_type,
          title: item.title || item.name || '',
          cover: item.poster_path ? IMG_BASE + item.poster_path : null,
          url: item.id + '|' + item.media_type,
          type: item.media_type === 'tv' ? 'series' : 'movie', sourceId: SOURCE_ID });
      }
      return out;
    });
}

function popular(opts) {
  return _tmdbFetch('/trending/all/week?page=' + ((opts && opts.page) || 1))
    .then(function(data) {
      var out = [];
      for (var i = 0; i < (data.results || []).length; i++) {
        var item = data.results[i];
        if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
        out.push({ id: item.id + '|' + item.media_type,
          title: item.title || item.name || '',
          cover: item.poster_path ? IMG_BASE + item.poster_path : null,
          url: item.id + '|' + item.media_type,
          type: item.media_type === 'tv' ? 'series' : 'movie', sourceId: SOURCE_ID });
      }
      return out;
    });
}

function getDetail(url) {
  var parts = String(url).split('|');
  var tmdbId = parts[0], type = parts[1] || 'movie';
  var ep = type === 'tv' ? '?append_to_response=seasons' : '';
  return _tmdbFetch('/' + type + '/' + tmdbId + ep).then(function(data) {
    var episodes = [];
    if (type === 'movie') {
      episodes.push({ id: url + '|0|0', title: data.title || 'Movie', number: 1, url: url + '|0|0' });
    } else {
      for (var s = 0; s < (data.seasons || []).length; s++) {
        var season = data.seasons[s];
        if (!season || season.season_number === 0) continue;
        for (var e = 1; e <= (season.episode_count || 0); e++) {
          var sn = season.season_number;
          var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
          episodes.push({ id: url + '|' + sn + '|' + e,
            title: 'S' + pad(sn) + 'E' + pad(e), number: (sn - 1) * 1000 + e,
            url: url + '|' + sn + '|' + e, season: sn, episode: e });
        }
      }
    }
    return { id: url, title: data.title || data.name || url,
      cover: data.poster_path ? IMG_BASE + data.poster_path : null,
      description: data.overview || '', status: 'completed',
      genres: (data.genres || []).map(function(g) { return g.name; }),
      studios: [], type: type === 'tv' ? 'series' : 'movie',
      sourceId: SOURCE_ID, episodes: episodes };
  });
}

function getVideoSources(episodeUrl) {
  var parts = String(episodeUrl).split('|');
  var tmdbId = parts[0], type = parts[1] || 'movie';
  var season = parts[2] ? parseInt(parts[2]) : 0;
  var episode = parts[3] ? parseInt(parts[3]) : 0;

  var embedUrl;
  if (type === 'movie') {
    embedUrl = SITE + '/watch?id=' + tmdbId;
  } else {
    embedUrl = SITE + '/watch?id=' + tmdbId + '&s=' + season + '&e=' + episode;
  }

  var REFERER = SITE + '/';
  return fetch(embedUrl, {
    headers: { 'User-Agent': UA, 'Referer': REFERER },
    timeoutMs: 12000
  }).then(function(r) {
    var html = r.body || '';
    // Look for stream URL in page scripts
    var m3u8 = html.match(/"(https?:\/\/[^\s"]+\.m3u8[^\s"]*)"/);
    if (m3u8) return _parseMaster(m3u8[1], REFERER);
    // JSON source embed
    var jsonSrc = html.match(/source\s*:\s*["'](https?:\/\/[^"']+)["']/);
    if (jsonSrc) return _parseMaster(jsonSrc[1], REFERER);
    // Try API endpoint
    var apiUrl = SITE + '/api/source/' + tmdbId;
    if (type === 'tv') apiUrl += '?s=' + season + '&e=' + episode;
    return fetch(apiUrl, { headers: { 'User-Agent': UA, 'Referer': REFERER }, timeoutMs: 8000 })
      .then(function(ar) {
        var data; try { data = JSON.parse(ar.body || '{}'); } catch(e) { data = {}; }
        var src = data.url || data.source || data.file ||
                  (data.data && (data.data.url || data.data.source));
        if (!src) return [];
        return _parseMaster(src, REFERER);
      })
      .catch(function() { return []; });
  }).catch(function() { return []; });
}

function _parseMaster(masterUrl, referer) {
  if (!masterUrl) return Promise.resolve([]);
  var hdrs = { 'User-Agent': UA, 'Referer': referer || SITE + '/' };
  return fetch(masterUrl, { headers: hdrs, timeoutMs: 8000 })
    .then(function(r) {
      var body = r.body || '';
      if (!body.includes('#EXT-X-STREAM-INF')) {
        return [{ url: masterUrl, quality: 'auto', container: 'hls', headers: hdrs, subtitles: [] }];
      }
      var re = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
      var out = [], m, base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
      while ((m = re.exec(body)) !== null) {
        var h = parseInt(m[1]), seg = m[2].trim();
        if (h < 240) continue;
        if (!seg.startsWith('http')) seg = base + seg;
        out.push({ url: seg, quality: h + 'p', container: 'hls', headers: hdrs, subtitles: [] });
      }
      if (!out.length) out.push({ url: masterUrl, quality: 'auto', container: 'hls', headers: hdrs, subtitles: [] });
      return out;
    })
    .catch(function() {
      return [{ url: masterUrl, quality: 'auto', container: 'hls', headers: hdrs, subtitles: [] }];
    });
}

// VidLink provider — https://vidlink.pro (TMDB-based API)
// Episode URL: tmdbId|type|season|episode

var SOURCE_ID = 'vidlink';
var SITE = 'https://vidlink.pro';
var API = 'https://vidlink.pro';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var IMG_BASE = 'https://image.tmdb.org/t/p/w500';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': SITE + '/', 'Origin': SITE };

function getInfo() {
  return { name: 'VidLink', lang: 'en', baseUrl: SITE,
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
          type: item.media_type === 'tv' ? 'series' : 'movie',
          sourceId: SOURCE_ID });
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
          type: item.media_type === 'tv' ? 'series' : 'movie',
          sourceId: SOURCE_ID });
      }
      return out;
    });
}

function getHome() {
  function row(endpoint, title) {
    return _tmdbFetch(endpoint).then(function(d) {
      var out = [];
      for (var i = 0; i < (d.results || []).length; i++) {
        var item = d.results[i];
        var type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        out.push({ id: item.id + '|' + type,
          title: item.title || item.name || '',
          cover: item.poster_path ? IMG_BASE + item.poster_path : null,
          url: item.id + '|' + type,
          type: type === 'tv' ? 'series' : 'movie', sourceId: SOURCE_ID });
      }
      return { title: title, items: out };
    }).catch(function() { return { title: title, items: [] }; });
  }
  return Promise.all([
    row('/trending/all/week', 'Trending'),
    row('/movie/popular', 'Popular Movies'),
    row('/tv/top_rated', 'Top Rated Series'),
    row('/movie/now_playing', 'Now Playing')
  ]);
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
          episodes.push({ id: url + '|' + sn + '|' + e,
            title: 'S' + (sn < 10 ? '0' + sn : sn) + 'E' + (e < 10 ? '0' + e : e),
            number: (sn - 1) * 1000 + e, url: url + '|' + sn + '|' + e,
            season: sn, episode: e });
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

  var apiUrl;
  if (type === 'movie') {
    apiUrl = API + '/api/b/movie/' + tmdbId;
  } else {
    apiUrl = API + '/api/b/tv/' + tmdbId + '/' + season + '/' + episode;
  }

  return fetch(apiUrl, { headers: HEADERS, timeoutMs: 12000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { return []; }
      var playlist = data && data.stream && data.stream.playlist;
      if (!playlist) return [];
      return _parseMaster(playlist);
    })
    .catch(function() {
      // Fallback: try direct embed iframe approach
      var embedUrl = type === 'movie'
        ? SITE + '/movie/' + tmdbId
        : SITE + '/tv/' + tmdbId + '/' + season + '/' + episode;
      return fetch(embedUrl, { headers: HEADERS, timeoutMs: 10000 })
        .then(function(r) {
          var body = r.body || '';
          var m = body.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
          if (m) return _parseMaster(m[0]);
          return [];
        })
        .catch(function() { return []; });
    });
}

function _parseMaster(masterUrl) {
  if (!masterUrl) return Promise.resolve([]);
  return fetch(masterUrl, { headers: HEADERS, timeoutMs: 8000 })
    .then(function(r) {
      var body = r.body || '';
      if (!body.includes('#EXT-X-STREAM-INF')) {
        return [{ url: masterUrl, quality: 'auto', container: 'hls', headers: HEADERS, subtitles: [] }];
      }
      var re = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
      var out = [], m;
      var base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
      while ((m = re.exec(body)) !== null) {
        var h = parseInt(m[1]), seg = m[2].trim();
        if (h < 240) continue;
        if (!seg.startsWith('http')) seg = base + seg;
        out.push({ url: seg, quality: h + 'p', container: 'hls', headers: HEADERS, subtitles: [] });
      }
      if (!out.length) out.push({ url: masterUrl, quality: 'auto', container: 'hls', headers: HEADERS, subtitles: [] });
      return out;
    })
    .catch(function() {
      return [{ url: masterUrl, quality: 'auto', container: 'hls', headers: HEADERS, subtitles: [] }];
    });
}

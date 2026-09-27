// HiAnime provider — https://hianime.to (Aniwatch API)
// Anime only. Uses hianime.to's own search + streaming API.

var SOURCE_ID = 'hianime';
var SITE = 'https://hianime.to';
var API = 'https://hianime.to';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': SITE + '/', 'X-Requested-With': 'XMLHttpRequest' };

function getInfo() {
  return { name: 'HiAnime', lang: 'en', baseUrl: SITE,
           logo: SITE + '/favicon.png', type: 'anime', version: '1.0.0' };
}

// ── Search ────────────────────────────────────────────────────────────────────
function search(query, page) {
  var url = API + '/search?keyword=' + encodeURIComponent(String(query || '')) + '&page=' + (page || 1);
  return fetch(url, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var html = r.body || '';
      var items = [];
      // Parse .flw-item elements: data-id, img src, h3 a
      var re = /class="film-poster[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?class="film-name"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        var animeUrl = m[1] || m[3];
        var cover = m[2];
        var title = m[4];
        if (!animeUrl || !title) continue;
        // extract slug id from URL: /watch/naruto-123
        var slug = animeUrl.replace(/\/watch\//, '').replace(/\?.*/, '');
        items.push({ id: slug, title: title, cover: cover,
                     url: slug, type: 'anime', sourceId: SOURCE_ID });
      }
      // Simpler fallback: parse film-poster links
      if (!items.length) {
        var re2 = /<a[^>]+href="\/watch\/([^"?]+)[^"]*"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/g;
        while ((m = re2.exec(html)) !== null) {
          items.push({ id: m[1], title: m[2], cover: m[3],
                       url: m[1], type: 'anime', sourceId: SOURCE_ID });
        }
      }
      return items;
    })
    .catch(function() { return []; });
}

// ── Detail ────────────────────────────────────────────────────────────────────
function getDetail(url) {
  var slug = String(url).replace(/\/watch\//, '').replace(/\?.*/, '');
  return fetch(SITE + '/watch/' + slug, { headers: HEADERS, timeoutMs: 12000 })
    .then(function(r) {
      var html = r.body || '';
      // Extract anime ID from page scripts: data-id="..."
      var idMatch = html.match(/data-id="(\d+)"/);
      var animeId = idMatch ? idMatch[1] : slug;
      // Title
      var titleMatch = html.match(/<h2[^>]*class="[^"]*film-name[^"]*"[^>]*>([^<]+)<\/h2>/) ||
                       html.match(/<title>([^<]+) - Watch/);
      var title = titleMatch ? titleMatch[1].trim() : slug;
      // Cover
      var coverMatch = html.match(/<img[^>]+class="[^"]*film-poster-img[^"]*"[^>]+src="([^"]+)"/);
      var cover = coverMatch ? coverMatch[1] : null;
      // Description
      var descMatch = html.match(/class="[^"]*film-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      var desc = descMatch ? htmlText(descMatch[1]) : '';
      // Genres
      var genres = [];
      var gRe = /class="[^"]*item[^"]*"[^>]*>Genre[^<]*<\/span>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/;
      var gMatch = html.match(gRe);
      if (gMatch) {
        var gLinks = gMatch[1].match(/>([^<]+)</g) || [];
        for (var i = 0; i < gLinks.length; i++) {
          var g = gLinks[i].replace(/[><]/g, '').trim();
          if (g) genres.push(g);
        }
      }
      // Episodes via AJAX
      return _fetchEpisodes(animeId, slug, title, cover, desc, genres);
    })
    .catch(function() {
      return { id: url, title: url, url: url, type: 'anime',
               sourceId: SOURCE_ID, episodes: [], status: 'unknown',
               genres: [], studios: [], description: '' };
    });
}

function _fetchEpisodes(animeId, slug, title, cover, desc, genres) {
  var epUrl = API + '/ajax/v2/episode/list/' + animeId;
  return fetch(epUrl, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var html = (data && data.html) || '';
      var episodes = [];
      var re = /data-id="(\d+)"[^>]*title="([^"]+)"[^>]*data-number="(\d+)"/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        var epId = m[1], epTitle = m[2], epNum = parseInt(m[3]);
        episodes.push({ id: 'ep:' + epId, title: epTitle,
                        number: epNum, url: slug + '?ep=' + epId });
      }
      return { id: slug, title: title, cover: cover, description: desc,
               status: 'completed', genres: genres, studios: [],
               type: 'anime', sourceId: SOURCE_ID, episodes: episodes };
    })
    .catch(function() {
      return { id: slug, title: title, cover: cover, description: desc,
               status: 'completed', genres: genres, studios: [],
               type: 'anime', sourceId: SOURCE_ID, episodes: [] };
    });
}

// ── Streams ───────────────────────────────────────────────────────────────────
function getVideoSources(episodeUrl) {
  // episodeUrl = slug?ep=EPISODE_ID
  var epMatch = String(episodeUrl).match(/\?ep=(\d+)$/);
  if (!epMatch) return Promise.resolve([]);
  var epId = epMatch[1];

  // Get servers list
  var serversUrl = API + '/ajax/v2/episode/servers?episodeId=' + epId;
  return fetch(serversUrl, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var html = (data && data.html) || '';
      // Extract server IDs: data-id="..." data-type="sub|dub"
      var servers = [];
      var re = /data-id="(\d+)"[^>]*data-type="(sub|dub|raw)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        servers.push({ id: m[1], type: m[2], name: m[3].trim() });
      }
      if (!servers.length) return [];
      // Prefer sub, take first 2
      var preferred = servers.filter(function(s) { return s.type === 'sub'; }).concat(
                      servers.filter(function(s) { return s.type !== 'sub'; }));
      var jobs = preferred.slice(0, 2).map(function(server) {
        return _resolveServer(server.id, server.type, server.name)
               .catch(function() { return []; });
      });
      return Promise.all(jobs).then(function(results) {
        var out = [];
        for (var i = 0; i < results.length; i++) {
          if (results[i] && results[i].length) out = out.concat(results[i]);
        }
        return out;
      });
    })
    .catch(function() { return []; });
}

function _resolveServer(serverId, audioType, serverName) {
  var url = API + '/ajax/v2/episode/sources?id=' + serverId;
  return fetch(url, { headers: HEADERS, timeoutMs: 10000 })
    .then(function(r) {
      var data; try { data = JSON.parse(r.body || '{}'); } catch(e) { data = {}; }
      var src = data && (data.link || data.url || (data.sources && data.sources[0] && data.sources[0].file));
      if (!src) return [];
      var kind = audioType === 'dub' ? 'dub' : 'sub';
      var subtitles = (data.tracks || [])
        .filter(function(t) { return t.kind === 'captions' || t.kind === 'subtitles'; })
        .map(function(t) { return { url: t.file, lang: t.label || 'en', format: 'vtt' }; });

      // HLS master playlist
      return fetch(src, { headers: { 'Referer': SITE + '/', 'User-Agent': UA }, timeoutMs: 8000 })
        .then(function(r2) {
          var body = r2.body || '';
          if (!body.includes('#EXT-X-STREAM-INF')) {
            return [{ url: src, quality: 'auto', container: 'hls', kind: kind, audioLang: kind === 'dub' ? 'en' : 'ja',
                      headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: subtitles }];
          }
          var re = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
          var out = [], m, base = src.substring(0, src.lastIndexOf('/') + 1);
          while ((m = re.exec(body)) !== null) {
            var h = parseInt(m[1]), seg = m[2].trim();
            if (h < 240) continue;
            if (!seg.startsWith('http')) seg = base + seg;
            out.push({ url: seg, quality: h + 'p', container: 'hls', kind: kind,
                       audioLang: kind === 'dub' ? 'en' : 'ja',
                       headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: subtitles });
          }
          if (!out.length) out.push({ url: src, quality: 'auto', container: 'hls', kind: kind,
                                       audioLang: kind === 'dub' ? 'en' : 'ja',
                                       headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: subtitles });
          return out;
        })
        .catch(function() {
          return [{ url: src, quality: 'auto', container: 'hls', kind: kind,
                    headers: { 'Referer': SITE + '/', 'User-Agent': UA }, subtitles: subtitles }];
        });
    });
}

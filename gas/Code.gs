// 부동산신탁사 재무 현황 — Google Apps Script 웹앱 서버 코드
// 데이터는 GitHub Actions가 매일 갱신하는 GitHub Pages의 data/trusts.json 을 읽어옵니다.
// (FISIS 인증키를 Apps Script에 따로 둘 필요가 없습니다.)

// ▼ GitHub Pages 주소가 다르면 여기만 바꾸세요 (끝에 슬래시 없이)
var SITE_URL = 'https://hsound21.github.io/trust-dashboard';

var DATA_URL = SITE_URL + '/data/trusts.json';
var CACHE_KEY = 'trusts-json';
var CACHE_SECONDS = 30 * 60; // 30분
var CHUNK = 90000; // CacheService 값 하나의 한도(100KB)보다 작게 쪼갬

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('부동산신탁사 재무 현황')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl(SITE_URL + '/icons/icon-192.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 클라이언트(google.script.run)가 호출. JSON 문자열을 돌려줍니다.
function getData() {
  var cache = CacheService.getScriptCache();
  var cached = readChunked_(cache, CACHE_KEY);
  if (cached) return cached;

  var res = UrlFetchApp.fetch(DATA_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('데이터를 가져오지 못했습니다 (HTTP ' + res.getResponseCode() + ')');
  }
  var text = res.getContentText('UTF-8');
  JSON.parse(text); // 깨진 응답을 캐시에 넣지 않도록 검증
  writeChunked_(cache, CACHE_KEY, text, CACHE_SECONDS);
  return text;
}

function writeChunked_(cache, key, text, seconds) {
  var parts = {};
  var count = Math.ceil(text.length / CHUNK);
  for (var i = 0; i < count; i += 1) parts[key + ':' + i] = text.substr(i * CHUNK, CHUNK);
  parts[key + ':n'] = String(count);
  cache.putAll(parts, seconds);
}

function readChunked_(cache, key) {
  var n = Number(cache.get(key + ':n'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i += 1) keys.push(key + ':' + i);
  var got = cache.getAll(keys);
  var out = '';
  for (var j = 0; j < n; j += 1) {
    var piece = got[key + ':' + j];
    if (piece == null) return null; // 일부가 만료됨 → 다시 가져오기
    out += piece;
  }
  return out;
}

// 캐시를 비우고 싶을 때 편집기에서 직접 실행
function clearCache() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(CACHE_KEY + ':n')) || 0;
  var keys = [CACHE_KEY + ':n'];
  for (var i = 0; i < n; i += 1) keys.push(CACHE_KEY + ':' + i);
  cache.removeAll(keys);
}

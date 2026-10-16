const HOST = "https://little-waterfall-ea20.sjzkn886.workers.dev/proxy";
const PIC = "https://little-waterfall-ea20.sjzkn886.workers.dev/img?u=";
const UA = "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const CATEGORIES = [
  { type_id: "newest", type_name: "最近上新", mode: "list", sort: "new" },
  { type_id: "recommend", type_name: "精选推荐", mode: "list", sort: "hot" },
  { type_id: "ai-duanju", type_name: "AI成人短剧", mode: "category", slug: "ai-duanju" },
  { type_id: "ai-manju", type_name: "AI成人漫剧", mode: "category", slug: "ai-manju" },
  { type_id: "ai-huanlian", type_name: "AI换脸", mode: "category", slug: "ai-huanlian" },
  { type_id: "ai-mogai", type_name: "AI魔改", mode: "category", slug: "ai-mogai" }
];

function getText(res) {
  if (res == null) return "";
  if (typeof res === "string") return res;
  try {
    if (typeof res.content === "string") return res.content;
    if (typeof res.body === "string") return res.body;
    if (typeof res.data === "string") return res.data;
    return JSON.stringify(res);
  } catch (e) { return ""; }
}

function parseJson(res) {
  var text = getText(res).trim();
  if (!text) return null;
  var i = text.indexOf("{");
  if (i > 0) text = text.slice(i);
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function httpGet(url) {
  var opts = {
    method: "GET",
    headers: { "User-Agent": UA, "Accept": "application/json,*/*" },
    timeout: 25000
  };
  try {
    if (typeof req === "function") return await req(url, opts);
  } catch (e) {}
  try {
    if (typeof fetch === "function") {
      var r = await fetch(url, opts);
      return await r.text();
    }
  } catch (e) {}
  return "";
}

function proxyPic(url) {
  if (!url) return "";
  url = String(url).trim();
  if (!url) return "";
  if (url.indexOf("/img?u=") >= 0) return url;
  return PIC + encodeURIComponent(url);
}

function mapItem(it) {
  if (!it || it.id == null) return null;
  var ep = parseInt(it.episode_count || it.total_episodes || 1, 10) || 1;
  return {
    vod_id: String(it.id),
    vod_name: String(it.title || "未命名").trim(),
    vod_pic: proxyPic(it.cover || ""),
    vod_remarks: ep > 1 ? ("全" + ep + "集") : "全集"
  };
}

function mapList(arr) {
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var m = mapItem(arr[i]);
    if (m) out.push(m);
  }
  return out;
}

function pickItems(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (json.data) {
    if (Array.isArray(json.data.items)) return json.data.items;
    if (Array.isArray(json.data.list)) return json.data.list;
    if (Array.isArray(json.data)) return json.data;
  }
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.list)) return json.list;
  return [];
}

function init(ext) {}

async function home(filter) {
  var classes = [];
  for (var i = 0; i < CATEGORIES.length; i++) {
    classes.push({ type_id: CATEGORIES[i].type_id, type_name: CATEGORIES[i].type_name });
  }
  var list = [];
  try {
    var res = await httpGet(HOST + "/videos?sort=hot&page=1&size=24");
    list = mapList(pickItems(parseJson(res)));
  } catch (e) {}
  return JSON.stringify({ class: classes, list: list, filters: {} });
}

async function homeVod() {
  try {
    var res = await httpGet(HOST + "/videos?sort=hot&page=1&size=24");
    return JSON.stringify({ list: mapList(pickItems(parseJson(res))) });
  } catch (e) {
    return JSON.stringify({ list: [] });
  }
}

async function category(tid, pg, filter, extend) {
  pg = parseInt(pg, 10) || 1;
  var cat = CATEGORIES[0];
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (String(CATEGORIES[i].type_id) === String(tid)) {
      cat = CATEGORIES[i];
      break;
    }
  }
  var list = [];
  try {
    var url = cat.mode === "list"
      ? (HOST + "/videos?sort=" + cat.sort + "&page=" + pg + "&size=24")
      : (HOST + "/videos/category/" + cat.slug + "?sort=hot&page=" + pg + "&size=24");
    var res = await httpGet(url);
    list = mapList(pickItems(parseJson(res)));
  } catch (e) {}
  return JSON.stringify({
    page: pg,
    pagecount: list.length < 12 ? pg : pg + 1,
    limit: 24,
    total: 999999,
    list: list
  });
}

async function detail(id) {
  try {
    var res = await httpGet(HOST + "/videos/" + id);
    var json = parseJson(res);
    var data = json && (json.data || json);
    if (!data || data.id == null) return JSON.stringify({ list: [] });
    var totalEp = 1;
    if (Array.isArray(data.episodes) && data.episodes.length) totalEp = data.episodes.length;
    else totalEp = parseInt(data.episode_count || data.total_episodes || 1, 10) || 1;
    var playUrls = [];
    for (var ep = 1; ep <= totalEp; ep++) {
      playUrls.push(ep + "$" + HOST + "/videos/" + id + "/play?ep=" + ep);
    }
    return JSON.stringify({
      list: [{
        vod_id: String(data.id),
        vod_name: data.title || ("短剧" + id),
        vod_pic: proxyPic(data.cover || ""),
        type_name: "短剧",
        vod_remarks: totalEp > 1 ? ("全" + totalEp + "集") : "全集",
        vod_content: data.description || data.title || "",
        vod_play_from: "黄果",
        vod_play_url: playUrls.join("#")
      }]
    });
  } catch (e) {
    return JSON.stringify({ list: [] });
  }
}

async function play(flag, id, flags) {
  try {
    var res = await httpGet(id);
    var json = parseJson(res);
    var videoUrl = (json && json.data && json.data.video_url) || (json && json.video_url) || "";
    if (videoUrl) {
      videoUrl = String(videoUrl).split("\u0026").join("&").split("&amp;").join("&");
      return JSON.stringify({
        parse: 0,
        url: videoUrl,
        header: { "User-Agent": UA, "Referer": "https://huangguoai.com/" }
      });
    }
  } catch (e) {}
  return JSON.stringify({ parse: 0, url: "" });
}

async function search(wd, quick, pg) {
  pg = parseInt(pg, 10) || 1;
  try {
    var kw = encodeURIComponent(String(wd || "").trim());
    if (!kw) return JSON.stringify({ list: [] });
    var res = await httpGet(HOST + "/search?q=" + kw + "&page=" + pg);
    var json = parseJson(res);
    var pagination = (json && json.data && json.data.pagination) || {};
    return JSON.stringify({
      page: pg,
      pagecount: pagination.pages || 1,
      list: mapList(pickItems(json))
    });
  } catch (e) {
    return JSON.stringify({ list: [] });
  }
}

export function __jsEvalReturn() {
  return {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
  };
}

process.env.YTDL_NO_UPDATE = '1';
const ytdl = require('ytdl-core');
const ytdlInfo = require('ytdl-core/lib/info');
const utils = require('ytdl-core/lib/utils');
const sig = require('ytdl-core/lib/sig');
const formatUtils = require('ytdl-core/lib/format-utils');

exports.getInfo = async(id, options) => {
  let info = await ytdl.getBasicInfo(id, options);
  let funcs = [];
  if (info.formats.length) {
    info.formats = info.formats.filter(fmt => fmt.mimeType.startsWith('audio'));
    info.formats = [info.formats.reduce((f0, f1) => (f0.bitrate > f1.bitrate) ? f0 : f1)];
    info.html5player = info.html5player || getHTML5player(await getWatchHTMLPageBody(id, options));
    if (!info.html5player) {
      throw Error('Unable to find html5player file');
    }
    const html5player = new URL(info.html5player, BASE_URL).toString();
    funcs.push(sig.decipherFormats(info.formats, html5player, options));
  }

  let results = await Promise.all(funcs);
  info.formats = Object.values(Object.assign({}, ...results));
  info.formats = info.formats.map(formatUtils.addFormatMeta);
  info.formats.sort(formatUtils.sortFormats);
  info.full = true;
  return info;
};

const BASE_URL = 'https://www.youtube.com/watch?v=';
const getWatchHTMLURL = (id, options) => `${BASE_URL + id}&hl=${options.lang || 'en'}`;
const getWatchHTMLPageBody = (id, options) => {
  const url = getWatchHTMLURL(id, options);
  return ytdlInfo.watchPageCache.getOrSet(url, () => utils.exposedMiniget(url, options).text());
};

const getHTML5player = body => {
  let html5playerRes =
    /<script\s+src="([^"]+)"(?:\s+type="text\/javascript")?\s+name="player_ias\/base"\s*>|"jsUrl":"([^"]+)"/
      .exec(body);
  return html5playerRes ? html5playerRes[1] || html5playerRes[2] : null;
};

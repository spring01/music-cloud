const ytdl = require('ytdl-core');
const impl = require('./impl.js');

exports.handler = async (event) => {
  const item = await impl[`call${event.header.name}`](event);
  if (item) {
    if ('GetPlayableContent' != event.header.name) {
      item.url = await resolveItemUrl(item.link);
    }
    return impl[`build${event.header.name}Response`](event, item);
  } else {
    return buildNotFound(event);
  }
};

async function resolveItemUrl(link) {
  const info = await ytdl.getInfo(link);
  const audios = info.formats.filter(fmt => fmt.hasAudio && !fmt.hasVideo);
  const biggest = audios.reduce(
      (f0, f1) => (f0.audioBitrate > f1.audioBitrate) ? f0 : f1);
  return biggest.url;
}

async function buildNotFound(event) {
  const header = impl.buildHeader('ErrorResponse');
  const payload = {
    type: 'CONTENT_NOT_FOUND',
    message: 'Requested content could not be found.',
  };
  return {header, payload};
}

const crypto = require('crypto');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const ytdl = require('ytdl-core');

const docClient = new AWS.DynamoDB.DocumentClient();
const scanAsync = promisify(docClient.scan).bind(docClient);
const queryAsync = promisify(docClient.query).bind(docClient);
const getAsync = promisify(docClient.get).bind(docClient);
const putAsync = promisify(docClient.put).bind(docClient);

const ALL_MUSIC_QUEUE = 'Playlist.AllMusic';
const DELIM = ' ||| ';

exports.callGetPlayableContent = async (event) => {
  const attributes = event.payload.selectionCriteria.attributes;
  // Entity Type 	Catalog Type
  // TRACK 	AMAZON.MusicRecording
  // ALBUM 	AMAZON.MusicAlbum
  // ARTIST 	AMAZON.MusicGroup
  // PLAYLIST 	AMAZON.MusicPlaylist
  // GENRE 	AMAZON.Genre
  // STATION 	AMAZON.BroadcastChannel
  const header = new Header('Alexa.Media.Search', 'GetPlayableContent.Response');
  var id;
  var speechText;
  console.log(attributes);
  if (attributes.length == 1 && attributes[0].type == 'MEDIA_TYPE'
      && attributes[0].value == 'TRACK') {
    id = ALL_MUSIC_QUEUE;
    speechText = 'All music';
  }
  const payload = {
    content: {
      id,
      actions: {
        playable: true,
        browsable: false
      },
      metadata: new PlaylistMetadata(speechText),
    },
  };
  return {header, payload};
  //~ var track = attributes.find(({ type }) => {
    //~ return type === 'MEDIA_TYPE';
  //~ });
  //~ var track = attributes.find(({ type }) => {
    //~ return type === 'TRACK';
  //~ });
  //~ var artist = attributes.find(({ type }) => {
    //~ return type === 'ARTIST';
  //~ });
  //~ if (track) track = track.entityId;
  //~ if (artist) artist = artist.entityId;
  //~ console.log('track=', track);
  //~ console.log('artist=', artist);
  //~ return await find(event);
}

exports.callInitiate = async (event) => {
  var id;
  var item = null;
  if (event.payload.contentId === ALL_MUSIC_QUEUE) {
    id = ALL_MUSIC_QUEUE;
    const alphaBet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = alphaBet.charAt(Math.floor(Math.random() * alphaBet.length));
    var items = await queryAsync({
      TableName: 'WebMusic',
      IndexName: 'IsMusic-ArtistAlbumTitle-index',
      KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle > :artistAlbumTitle',
      ExpressionAttributeValues: {
        ':isMusic': 1,
        ':artistAlbumTitle': randomLetter,
      },
      Limit: 1,
    });
    item = items.Items[0];
    if (!item) {
      items = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
      });
      item = items.Items[0];
    }
  }
  const header = new Header('Alexa.Media.Playback', 'Initiate.Response');
  const [artist, album, title] = item.ArtistAlbumTitle.split(DELIM);
  const uri = await resolveItemUrl(item.Link);
  const payload = {
    playbackMethod: {
      type: 'ALEXA_AUDIO_PLAYER_QUEUE',
      id,
      rules: {
        feedback: {
          type: 'PREFERENCE',
          enabled: false
        },
      },
      firstItem: {
        id: item.ArtistAlbumTitle,
        playbackInfo: {
          type: 'DEFAULT',
        },
        metadata: new TrackMetadata(artist, album, title),
        controls: bidirectionalControls(),
        rules: new ItemRules(),
        stream: new Stream(item.ArtistAlbumTitle, uri),
      },
    },
  };
  return {header, payload};
}

exports.callGetNextItem = async (event) => {
  var isQueueFinished = null;
  var item;
  const currentItemReference = event.payload.currentItemReference;
  if (currentItemReference.queueId === ALL_MUSIC_QUEUE) {
    const lastItemContentId = currentItemReference.id;  // contentId is queueId
    var items = null;
    if (lastItemContentId) {
      items = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle > :artistAlbumTitle',
        ExpressionAttributeValues: {
          ':isMusic': 1,
          ':artistAlbumTitle': lastItemContentId,
        },
        Limit: 1,
      });
      item = items.Items[0];
    }
    if (!item) {
      items = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
      });
    }
    item = items.Items[0];
    isQueueFinished = false;
  }
  const header = new Header('Alexa.Audio.PlayQueue', 'GetNextItem.Response');
  const [artist, album, title] = item.ArtistAlbumTitle.split(DELIM);
  const uri = await resolveItemUrl(item.Link);
  const payload = {
    isQueueFinished,
    item: {
      id: item.ArtistAlbumTitle,
      playbackInfo: {
        type: 'DEFAULT',
      },
      metadata: new TrackMetadata(artist, album, title),
      controls: bidirectionalControls(),
      rules: new ItemRules(),
      stream: new Stream(item.ArtistAlbumTitle, uri),
    },
  };
  return {header, payload};
}

exports.callGetPreviousItem = async (event) => {
  var item;
  const currentItemReference = event.payload.currentItemReference;
  if (currentItemReference.queueId === ALL_MUSIC_QUEUE) {
    const currentItemContentId = currentItemReference.id;  // contentId is queueId
    var items = null;
    if (currentItemContentId) {
      items = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle < :artistAlbumTitle',
        ExpressionAttributeValues: {
          ':isMusic': 1,
          ':artistAlbumTitle': currentItemContentId,
        },
        Limit: 1,
        ScanIndexForward: false,
      });
      item = items.Items[0];
    }
    if (!item) {
      items = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
        ScanIndexForward: false,
      });
    }
    item = items.Items[0];
  }
  const header = new Header('Alexa.Audio.PlayQueue', 'GetPreviousItem.Response');
  const [artist, album, title] = item.ArtistAlbumTitle.split(DELIM);
  const uri = await resolveItemUrl(item.Link);
  const payload = {
    item: {
      id: item.ArtistAlbumTitle,
      playbackInfo: {
        type: 'DEFAULT',
      },
      metadata: new TrackMetadata(artist, album, title),
      controls: bidirectionalControls(),
      rules: new ItemRules(),
      stream: new Stream(item.ArtistAlbumTitle, uri),
    },
  };
  return {header, payload};
}

async function resolveItemUrl(link) {
  const info = await ytdl.getInfo(link);
  const audios = info.formats.filter(fmt => fmt.hasAudio && !fmt.hasVideo);
  const biggest = audios.reduce(
      (f0, f1) => (f0.audioBitrate > f1.audioBitrate) ? f0 : f1);
  return biggest.url;
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('base64');
}

function newId() {
  return hash(new Date().toISOString());
}

function buildHeader(name, namespace = 'Alexa.Media') {
  return {
    namespace,
    name,
    messageId: newId(),
    payloadVersion: '1.0',
  };
}

class Header {
  constructor(namespace, name) {
    this.namespace = namespace;
    this.name = name;
    this.messageId = newId();
    this.payloadVersion = '1.0';
  }
}

class SpeechInfo {
  type = 'PLAIN_TEXT';
  constructor(text) {
    this.text = text;
  }
}

class MetadataNameProperty {
  constructor(text) {
    this.speech = new SpeechInfo(text);
    this.display = text;
  }
}

class EntityMetadata {
  constructor(text) {
    this.name = new MetadataNameProperty(text);
  }
}

class BaseMetadata {
  type = null;
  constructor(text, sources = []) {
    this.name = new MetadataNameProperty(text);
    this.art = {sources};
  }
}

class PlaylistMetadata extends BaseMetadata {
  type = 'PLAYLIST';
}

class TrackMetadata extends BaseMetadata {
  type = 'TRACK';
  constructor(artist, album, title, sources = []) {
    super(title, sources);
    this.authors = [
      new EntityMetadata(artist),
    ];
    this.album = new EntityMetadata(album);
  }
}

class Stream {
  constructor(id, uri) {
    this.id = id;
    this.uri = uri;
    this.offsetInMilliseconds = 0;
    this.validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
}

class ItemControl {
  type = 'COMMAND';
  enabled = true;
  constructor(name) {
    this.name = name;
  }
}

function bidirectionalControls() {
  return [new ItemControl('NEXT'), new ItemControl('PREVIOUS')];
}

class ItemRules {
  feedbackEnabled = false;
}

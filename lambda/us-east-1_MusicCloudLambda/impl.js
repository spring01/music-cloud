const crypto = require('crypto');
const { promisify } = require('util');
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const scanAsync = promisify(docClient.scan).bind(docClient);
const queryAsync = promisify(docClient.query).bind(docClient);
const getAsync = promisify(docClient.get).bind(docClient);
const putAsync = promisify(docClient.put).bind(docClient);

exports.find = async (event) => {
  if (event.payload.contentId) {
    const item = await getAsync({
      TableName: 'web-music',
      Key: JSON.parse(event.payload.contentId)
    });
    return item.Item;
  }
  let lastKeyGet = await getAsync({
    TableName: 'last-key-evaluated',
    Key: {
      id: "0"
    }
  });
  let lastKeyEvaluated = {
    artist: hash(new Date().toISOString()),
    album_title: hash(new Date().toISOString())
  };
  if (lastKeyGet.Item) {
    lastKeyEvaluated = lastKeyGet.Item.value;
  }
  console.log(lastKeyEvaluated);
  var items;
  items = await scanAsync({
    TableName: 'web-music',
    ExclusiveStartKey: lastKeyEvaluated,
    Limit: 1
  });
  var item = items.Items[0];
  if (!item) {
    items = await scanAsync({
      TableName: 'web-music',
      Limit: 1
    });
    item = items.Items[0];
  }
  let lastKey = await putAsync({
    TableName: 'last-key-evaluated',
    Item: {
      id: "0",
      'value': {artist: item.artist, album_title: item.album_title}
    }
  });
  return item;
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('base64');
}

function newId() {
  return hash(new Date().toISOString());
}

function getItemId(item) {
  const artist = item.artist;
  const album_title = item.album_title;
  return JSON.stringify({artist, album_title});
}

function buildHeader(name, namespace = 'Alexa.Media') {
  return {
    namespace,
    name,
    messageId: newId(),
    payloadVersion: '1.0',
  };
}

function buildMetadata(item) {
  return {
    'type': 'TRACK',
    'name': {
      'speech': {
        'type': 'PLAIN_TEXT',
        'text': item.title,
      },
      'display': item.title,
    },
    'authors': [
      {
        'name': {
          'speech': {
            'type': 'PLAIN_TEXT',
            'text': item.artist,
          },
          'display': item.artist,
        }
      },
    ],
    'art': {},
  };
}

function buildStream(item) {
  return {
    "id": getItemId(item),
    "uri": item.url,
    "offsetInMilliseconds": 0,
    "validUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildControls() {
  return [
    {
      "type": "COMMAND",
      "name": "NEXT",
      "enabled": true,
    },
    {
      "type": "COMMAND",
      "name": "PREVIOUS",
      "enabled": false,
    }
  ];
}

function buildItemRules() {
  return {
    "feedbackEnabled": false,
  };
}

function buildPlayableItem(item) {
  return {
    "id": getItemId(item),
    "playbackInfo": {
        "type": "DEFAULT"
    },
    metadata: buildMetadata(item),
    "controls": buildControls(),
    "rules": buildItemRules(),
    "stream": buildStream(item),
  };
}

async function buildNotFound(event) {
  const header = buildHeader('ErrorResponse');
  const payload = {
    type: 'CONTENT_NOT_FOUND',
    message: 'Requested content could not be found.',
  };
  return {header, payload};
}

exports.buildGetPlayableContentResponse = async (event, item) => {
  const header = buildHeader('GetPlayableContent.Response', 'Alexa.Media.Search');
  const payload = {
    "content": {
      "id": getItemId(item),
      "actions": {
        "playable": true,
        "browsable": false
      },
      metadata: buildMetadata(item),
    },
  };
  return {header, payload};
}

exports.buildInitiateResponse = async (event, item) => {
  const header = buildHeader('Initiate.Response', 'Alexa.Media.Playback');
  const payload = {
    "playbackMethod": {
      "type": "ALEXA_AUDIO_PLAYER_QUEUE",
      "id": newId(),
      "rules": {
        "feedback": {
          "type": "PREFERENCE",
          "enabled": false
        },
      },
      "firstItem": buildPlayableItem(item),
    },
  };
  return {header, payload};
}

exports.buildGetNextItemResponse = async (event, item) => {
  const header = buildHeader('GetNextItem.Response', 'Alexa.Audio.PlayQueue');
  const payload = {
    "isQueueFinished": false,
    "item": buildPlayableItem(item),
  };
  return {header, payload};
}

async function buildInternalError(event) {
  const header = buildHeader('ErrorResponse', 'Alexa.Audio');
  const payload = {
    "type": "INTERNAL_ERROR",
    "message": "Unknown error"
  };
  return {header, payload};
}

async function buildGetPreviousItem(event) {
  const header = buildHeader('ErrorResponse', 'Alexa.Audio');
  const payload = {
    "type": "ITEM_NOT_FOUND",
    "message": "There is no previous item."
  };
  return {header, payload};
}

exports.buildHeader = buildHeader;

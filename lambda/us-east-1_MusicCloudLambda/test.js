const index = require('./index.js');
const ytdl = require('ytdl-core');

async function test() {
    get_event = {
      "header": {
        "name": "GetPlayableContent",
        "messageId": "response_undefined"
      },
      "payload": {
        "requestContext": {
          "user": {"id": "amzn1.ask.skill.b2df8b90-9598-499c-ab52-22d0f4e2741a"}
        },
        "filters": {
          "explicitLanguageAllowed": true
        },
        "selectionCriteria": {
          "attributes": [
          ]
        }
      }
    };
    get_event2 = {
      "header": {
        "name": "GetPlayableContent",
        "messageId": "response_undefined"
      },
      "payload": {
        "requestContext": {
          "user": {"id": "amzn1.ask.skill.b2df8b90-9598-499c-ab52-22d0f4e2741a"}
        },
        "filters": {
          "explicitLanguageAllowed": true
        },
        "selectionCriteria": {
          "attributes": [
            {
              "type": "TRACK"
            }
          ]
        }
      }
    };
    init_event = {
      "header": {
        "name": "Initiate"
      },
      "payload": {
        "requestContext": {
          "user": {"id": "amzn1.ask.skill.b2df8b90-9598-499c-ab52-22d0f4e2741a"}
        },
        "filters": {
          "explicitLanguageAllowed": true
        },
        "contentId": "Playlist.AllMusic",
        "playbackModes": {
          "shuffle": false,
          "loop": false
        }
      }
    };
    init_event2 = {
      "header": {
        "name": "Initiate"
      },
      "payload": {
        "requestContext": {
          "user": {"id": "amzn1.ask.skill.b2df8b90-9598-499c-ab52-22d0f4e2741a"}
        },
        "filters": {
          "explicitLanguageAllowed": true
        },
        "contentId": "Playlist.AllMusic",
        "currentItemReference": {
          "namespace": "Alexa.Audio.PlayQueue",
          "name": "item",
          "value": {
            "id": "???",
            "queueId": "Playlist.AllMusic",
            "contentId": "周杰伦 ||| 八度空间 ||| 火车叨位去"
          }
        },
      }
    };
    next_event = {
      "header": {
        "namespace": "Alexa.Audio.PlayQueue",
        "name": "GetNextItem",
        "messageId": "",
        "payloadVersion": "1.0"
      },
      "payload": {
        "requestContext": {
          "user": {
              "id": "amzn1.ask.skill.b2df8b90-9598-499c-ab52-22d0f4e2741a",
              "accessToken": ""
          },
          "location": {
            "originatingLocale": "en-US"
          }
        },
        "currentItemReference": {
          "id": "???",
          "queueId": "Playlist.AllMusic",
          "contentId": "周杰伦 ||| 八度空间 ||| 火车叨位去"
        },
      },
      "isUserInitiated": false
    };

    //~ ':artistAlbumTitle': '周杰伦 ||| 八度空间 ||| 火车叨位去',
    //~ ':artistAlbumTitle': '周杰伦 ||| 叶惠美 ||| 她的睫毛',

    real_get0 = {
        "header": {
            "messageId": "dgGHdJXCM2FItd7ovaSEfoOlW",
            "namespace": "Alexa.Media.Search",
            "name": "GetPlayableContent",
            "payloadVersion": "1.0"
        },
        "payload": {
            "requestContext": {
                "user": {
                    "id": "amzn1.ask.account.hidden",
                    "accessToken": null
                },
                "location": {
                    "originatingLocale": "en-US",
                    "countryCode": "US"
                }
            },
            "filters": {
                "explicitLanguageAllowed": true
            },
            "selectionCriteria": {
                "attributes": [
                    {
                        "type": "MEDIA_TYPE",
                        "value": "TRACK"
                    }
                ]
            },
            "responseOptions": null,
            "experience": null
        }
    };
    real_init0 = {
        "header": {
            "messageId": "dtvC4HhSFLg0CZxbKF7JcIj44",
            "namespace": "Alexa.Media.Playback",
            "name": "Initiate",
            "payloadVersion": "1.0"
        },
        "payload": {
            "requestContext": {
                "user": {
                    "id": "amzn1.ask.account.hidden",
                    "accessToken": null
                },
                "location": {
                    "originatingLocale": "en-US",
                    "countryCode": "US",
                    "timeZone": "America/Los_Angeles"
                }
            },
            "playbackModes": {
                "shuffle": false,
                "loop": false,
                "repeat": null
            },
            "currentItemReference": null,
            "contentId": "Playlist.AllMusic",
            "filters": {
                "explicitLanguageAllowed": true
            },
            "experience": null
        }
    };
    real_next0 = {
        "header": {
            "messageId": "k8roclRgM91RPvY8E2TbCcW2a",
            "namespace": "Alexa.Audio.PlayQueue",
            "name": "GetNextItem",
            "payloadVersion": "1.0"
        },
        "payload": {
            "requestContext": {
                "user": {
                    "id": "amzn1.ask.account.hidden",
                    "accessToken": null
                },
                "location": {
                    "originatingLocale": "en-US",
                    "countryCode": "US"
                }
            },
            "policies": null,
            "currentItemReference": {
                "contentId": "Playlist.AllMusic",
                "queueId": "Playlist.AllMusic",
                "id": "周杰伦 ||| 叶惠美 ||| 她的睫毛"
            },
            "isUserInitiated": false
        }
    }

    result = await index.handler(real_get0);
    //~ result = await index.handler(real_init0);
    //~ result = await index.handler(real_next0);
    //~ console.log(JSON.stringify(result, null, 2));
}

test();

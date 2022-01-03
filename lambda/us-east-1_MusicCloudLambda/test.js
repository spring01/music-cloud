const index = require('./index.js');

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
        "contentId": "{\"artist\":\"周杰伦\",\"album_title\":\"叶惠美 ||| 她的睫毛\"}",
        "currentItemReference": {
          "namespace": "Alexa.Audio.PlayQueue",
          "name": "item"
        },
        "value": {
          "id": "",
          "queueId": "",
          "contentId": ""
        }
      }
    };
    result = await index.handler(get_event);
    //~ result = await index.handler(init_event);
    console.log(JSON.stringify(result, null, 2));
}

test();

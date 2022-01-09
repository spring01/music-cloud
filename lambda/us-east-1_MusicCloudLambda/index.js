const impl = require('./impl.js');

exports.handler = async (event) => {
  console.info("EVENT\n" + JSON.stringify(event, null, 2));
  const response = await impl[`call${event.header.name}`](event);
  console.info("RESPONSE\n" + JSON.stringify(response, null, 2));
  return response;
};

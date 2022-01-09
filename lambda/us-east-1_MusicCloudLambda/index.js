const impl = require('./impl.js');

exports.handler = async (event) => {
  console.info("EVENT\n" + JSON.stringify(event, null, 2));
  const queue = await impl[`queue${event.header.name}`](event);
  const response = await impl[`call${event.header.name}`](event, queue);
  console.info("RESPONSE\n" + JSON.stringify(response, null, 2));
  return response;
};

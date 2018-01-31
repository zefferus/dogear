'use strict';

const Dogear = require('./dogear');

exports.register = (server, options) => {

  const dogear = new Dogear(options);

  dogear.attachToServer(server);

  server.expose(dogear);

  server.decorate('server', 'statsd', dogear.client);
};

exports.name = require('../package.json').name;

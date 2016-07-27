'use strict';

const Dogear = require('./dogear');

exports.register = function setUpDogear(server, config, next) {

  const dogear = new Dogear(config);

  dogear.attachToServer(server);

  server.expose(dogear);

  server.decorate('server', 'statsd', dogear.client);

  return next();
};

exports.register.attributes = {
  pkg: require('../package.json')
};

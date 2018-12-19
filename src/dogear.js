'use strict';

const StatsD = require('hot-shots');
const Oppsy = require('oppsy');
const Hoek = require('hoek');
const At = require('lodash.at');

const internals = {
  defaults: {
    statsdConfig: {
      prefix: 'hapi.'
    },
    opsInterval: 1000,
    opsMetrics: null
  },
  opsMetricTypes: {
    'os.load.1': {
      path: 'osload[0]',
      type: 'gauge'
    },
    'os.load.5': {
      path: 'osload[1]',
      type: 'gauge'
    },
    'os.load.15': {
      path: 'osload[2]',
      type: 'gauge'
    },
    'proc.uptime': {
      path: 'psup',
      type: 'gauge'
    },
    'proc.mem.rss': {
      path: 'psmem.rss',
      type: 'gauge'
    },
    'proc.mem.heapTotal': {
      path: 'psmem.heapTotal',
      type: 'gauge'
    },
    'proc.mem.heapUsed': {
      path: 'psmem.heapUsed',
      type: 'gauge'
    },
    'proc.delay': {
      path: 'psdelay',
      type: 'timing'
    }
  }
};

exports = module.exports = internals.Dogear = Dogear;
function Dogear(config) {
  this._config = config;

  this._settings = Hoek.applyToDefaults(internals.defaults, config || {});

  if (!this._settings.opsMetrics) {
    this._settings.opsMetrics = Object.keys(internals.opsMetricTypes);
  }

  this.client = new StatsD(this._settings.statsdConfig);
}


internals.Dogear.prototype.close = close;
function close(cb) {
  if (this._ops) {
    this._ops.stop();
  }
  this.client.close(cb);
}


internals.Dogear.prototype.attachToServer = attachToServer;
function attachToServer(server) {

  const self = this;

  server.ext('onPreResponse', (request, reply) => {
    const msec = Date.now() - request.info.received;

    let path = request._route.path;
    const specials = request.connection._router.specials;

    if (request._route === specials.notFound.route) {
      path = '/{notFound*}';
    } else if (specials.options && request._route === specials.options.route) {
      path = '/{cors*}';
    } else if (request._route.path === '/' && request._route.method === 'options'){
      path = '/{cors*}';
    }

    const statusCode = (request.response.isBoom) ?
      request.response.output.statusCode :
      request.response.statusCode;

    const tags = [
      `path:${ path }`,
      `method:${ request.method.toUpperCase() }`
    ];

    if (statusCode) {
      tags.push(`status:${ statusCode }`);

      self.client.increment(`request.status.${ statusCode }`, 1, tags);
      self.client.increment('request.received', 1, tags);
    }

    self.client.histogram('request.response_time', msec, tags);

    reply.continue();
  });


  if (self._settings.opsInterval > 0 &&
    Array.isArray(self._settings.opsMetrics) && self._settings.opsMetrics.length) {

    const metrics = self._settings.opsMetrics.filter((val) =>
      internals.opsMetricTypes[val] !== undefined);

    if (metrics.length > 0) {
      self._ops = new Oppsy(server);
      self._ops.start(self._settings.opsInterval);

      const dataPath = metrics.map((metric) => internals.opsMetricTypes[metric].path);

      self._ops.on('ops', (data) => {

        const values = At(data, dataPath);

        for (let i = 0; i < metrics.length; i++) {
          const metricType = internals.opsMetricTypes[metrics[i]].type;

          self.client[metricType](metrics[i], values[i]);
        }
      });
    }
  }


  server.ext('onPreStop', (server, next) => {
    self.close();
    next();
  });
}

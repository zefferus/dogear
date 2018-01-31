'use strict';

const StatsD = require('hot-shots');
const Oppsy = require('oppsy');
const Hoek = require('hoek');
const At = require('lodash.at');

const defaultConfig = {
  statsdConfig: {
    prefix: 'hapi.'
  },
  opsInterval: 1000,
  opsMetrics: null
};

const opsMetricTypes = {
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
};

class Dogear {
  constructor(config) {
    this._config = config;

    this._settings = Hoek.applyToDefaults(defaultConfig, config || {});

    if (!this._settings.opsMetrics) {
      this._settings.opsMetrics = Object.keys(opsMetricTypes);
    }

    this.client = new StatsD(this._settings.statsdConfig);
  }

  close(cb) {
    if (this._ops) {
      this._ops.stop();
    }
    this.client.close(cb);
  }

  attachToServer(server) {
    server.ext('onPreResponse', (request, h) => {
      const msec = Date.now() - request.info.received;

      let path = request._route.path;
      const specials = request._core.router.specials;

      if (request._route === specials.notFound.route) {
        path = '/{notFound*}';
      } else if (specials.options && request._route === specials.options.route) {
        path = '/{cors*}';
      } else if (request._route.path === '/' && request._route.method === 'options') {
        path = '/{cors*}';
      }

      const statusCode = request.response.isBoom ?
        request.response.output.statusCode :
        request.response.statusCode;

      const tags = [
        `path:${ path }`,
        `method:${ request.method.toUpperCase() }`
      ];

      if (statusCode) {
        tags.push(`status:${ statusCode }`);

        this.client.increment(`request.status.${ statusCode }`, 1, tags);
        this.client.increment('request.received', 1, tags);
      }

      this.client.histogram('request.response_time', msec, tags);

      return h.continue;
    });

    if (this._settings.opsInterval > 0 &&
      Array.isArray(this._settings.opsMetrics) && this._settings.opsMetrics.length) {

      const metrics = this._settings.opsMetrics.filter((val) => opsMetricTypes[val] !== undefined);

      if (metrics.length > 0) {
        this._ops = new Oppsy(server);
        this._ops.start(this._settings.opsInterval);

        const dataPath = metrics.map((metric) => opsMetricTypes[metric].path);

        this._ops.on('ops', (data) => {

          const values = At(data, dataPath);

          for (let i = 0; i < metrics.length; i++) {
            const metricType = opsMetricTypes[metrics[i]].type;

            this.client[metricType](metrics[i], values[i]);
          }
        });
      }
    }

    server.ext('onPreStop', () => {
      this.close();
    });
  }
}

module.exports = Dogear;

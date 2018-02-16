# Dogear

[![Build Status](https://travis-ci.org/zefferus/dogear.svg?branch=master)](https://travis-ci.org/zefferus/dogear)
[![Current Version](https://img.shields.io/npm/v/dogear.svg)](https://npmjs.com/package/dogear)

A hapi plugin for sending request round trip metrics and server ops metrics to a statsd-compliant service (Datadog, InfluxDB's Telegraf, etc) and also exposes an expanded statsd client to the server.

This plugin started life as a fork of [hapi-statsd](http://npmjs.com/package/hapi-statsd) and has evolved since then. Thanks to Mac Angell for his hard work on hapi-statsd!

**NOTE:** Dogear 3.x.x works with Hapi 17 and above. Please continue to use 2.x.x if you require an earlier version of Hapi.

## Install

```bash
$ npm install --save dogear
```

## Usage

To install this plugin on your Hapi server, do something similar to this:

```javascript
const Hapi = require('hapi');
const server = new Hapi.Server();

const dogearOptions = {}

await server.register({
  plugin: require('dogear'),
  options: dogearOptions
});

await server.start();
```

## Configuration

The plugin accepts multiple optional configuration parameters to customize its behavior.

### `statsdConfig`

Optional initialization parameters for the statsd client:

- `host` - The host to send stats to `default: localhost`
- `port` - The port to send stats to `default: 8125`
- `prefix` - What to prefix each stat name with `default: 'hapi.'`
- `suffix` - What to suffix each stat name with `default: ''`
- `globalize` - Expose this StatsD instance globally? `default: false`
- `cacheDns` - Cache the initial dns lookup to *host* `default: false`
- `mock` - Create a mock StatsD instance, sending no stats to the server? `default: false`
- `globalTags` - Tags that will be added to every metric `default: []`
- `maxBufferSize` - If larger than 0,  metrics will be buffered and only sent when the string length is greater than the size. `default: 0`
- `bufferFlushInterval` - If buffering is in use, this is the time in ms to always flush any buffered metrics. `default: 1000`
- `telegraf` - Use Telegraf's StatsD line protocol, which is slightly different than the rest `default: false`
- `errorHandler` - A function with one argument. It is called to handle various errors. `default: none`, errors are thrown/logger to console

### `opsInterval`

How often the server will send operational stats. Defaults to `1000`. If set to `null` or <= `0`, the plugin will not report operational metrics.

### `opsMetrics`

An array of strings represeting the operational metrics to report. Allowed values:

- `os.load.1` - One minute average of server CPU load
- `os.load.5` - Five minute average of server CPU load
- `os.load.15` - Fifteen minute average of server CPU load
- `proc.uptime` - Uptime for Hapi server process
- `proc.mem.rss` - Amount of memory set aside for Hapi server process ([Learn More](http://stackoverflow.com/questions/12023359/what-do-the-return-values-of-node-js-process-memoryusage-stand-for))
- `proc.mem.heapTotal` - Heap memory allocated for Hapi server process
- `proc.mem.heapUsed` - Heap memory used by Hapi server process
- `proc.delay` - Current event queue delay

Defaults to an array containing all the above.


## Example

A Hapi route configured like this:

```javascript
server.route({
  method: 'GET',
  path: '/test/{param}',
  handler: () => 'Success!'
});
```

would send increment stats to statsd with the following names:

    hapi.request.status.200
    hapi.request.received

and a timing stat named:

    hapi.request.response_time

if the statsd server supports tags, it will also receive the following tags (in addition to any global tags):

    path:/test/{param}
    method:GET
    status:200

As the [statsd client](https://npmjs.com/package/hot-shots) is also exposed to the hapi server, you can use any of its methods, e.g.:

```javascript
server.statsd.increment('systemname.subsystem.value');
server.statsd.gauge('what.you.gauge', 100);
server.statsd.set('your.set', 200);
server.statsd.histogram('timing.metric', 235, [ 'tags' ]);
```

## Version Compatibility

- Version 3: Currently tested with Hapi 17.x.x on Node 8
- Version 2: Up to Hapi 16.x.x

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.


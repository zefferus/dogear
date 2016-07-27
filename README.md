# Dogear

[![Build Status](https://travis-ci.org/zefferus/dogear.svg?branch=master)](https://travis-ci.org/zefferus/dogear)
[![Current Version](https://img.shields.io/npm/v/dogear.svg)](https://npmjs.com/package/dogear)

A hapi plugin for sending request round trip metrics and server ops metrics to a statsd-compliant service (Datadog, InfluxDB's Telegraf, etc) and also exposes an expanded statsd client to the server.

This plugin started life as a fork of [hapi-statsd](http://npmjs.com/package/hapi-statsd) and has evolved since then. Thanks to Mac Angell for his hard work on hapi-statsd!

Development on **Dogear** is sponsored by [Sparo Labs](http://www.sparolabs.com/).

## Install

```bash
$ npm install --save dogear
```

## Usage

To install this plugin on your Hapi server, do something similar to this:

```js
var Hapi = require('hapi');
var server = new Hapi.Server();

var dogearOptions = {}

server.register({ register: require('dogear'), options: dogearOptions }, function (err) {
	if (err) {
		console.log('error', 'Failed loading plugin: dogear');
	}
});
```

## Configuration

The plugin accepts multiple optional configuration parameters to customize its behavior.

### `statsdConfig`

Optional initialization parameters for the statsd client:

- `host` - The host to send stats to `default: localhost`
- `port` - The port to send stats to `default: 8125`
- `prefix` - What to prefix each stat name with `default: 'hapi'`
- `suffix` - What to suffix each stat name with `default: ''`
- `globalize` - Expose this StatsD instance globally? `default: false`
- `cacheDns` - Cache the initial dns lookup to *host* `default: false`
- `mock` - Create a mock StatsD instance, sending no stats to the server? `default: false`
- `globalTags` - Tags that will be added to every metric `default: []`
- `maxBufferSize` - If larger than 0,  metrics will be buffered and only sent when the string length is greater than the size. `default: 0`
- `bufferFlushInterval` - If buffering is in use, this is the time in ms to always flush any buffered metrics. `default: 1000`
- `telegraf` - Use Telegraf's StatsD line protocol, which is slightly different than the rest `default: false`
- `errorHandler` - A function with one argument. It is called to handle various errors. `default: none`, errors are thrown/logger to console

### `template`

A template to use for the stat names to send to statsd. This can be any string that could include the following tokens that get replaced with their actual values:

- `{path}` - the path that the request was routed to (e.g `'/users/{id}'`)
- `{method}` - the HTTP verb used on the request (e.g. `'GET'`)
- `{statusCode}` - the numerical status code of the response that the server sent back to the client (e.g. `200`)

Defaults to `'{path}.{method}.{statusCode}'`

### `pathSeparator`

A character or set of characters to replace the '/' (forward slash) characters in your URL path since forward slashes cannot be used in stat names. Defaults to `'_'`

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

```js
server.route({
	method: 'GET',
	path: '/test/{param}',
	handler: function(request, reply) {
		reply('Success!');
	}
});
```

would send an increment and timing stat to statsd with the following stat name (assuming all options are set to their defaults):

	hapi.test_{param}.GET.200

As the [statsd client](https://npmjs.com/package/hot-shots) is also exposed to the hapi server, you can use any of its methods, e.g.:

```js
server.statsd.increment('systemname.subsystem.value');
server.statsd.gauge('what.you.gauge', 100);
server.statsd.set('your.set', 200);
```

## Version Compatibility

Currently tested with Hapi 13.x.x on Node 4 and Node 6

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.


'use strict';

const Tap = require('tap');
const describe = Tap.test;

const Hapi = require('hapi');
const Sinon = require('sinon');

const plugin = require('../src/index');

let sandbox;

async function initServer() {
  const server = new Hapi.server({ routes: { cors: true } });

  const get = () => 'Success!';
  const err = () => {
    throw new Error();
  };

  server.route({ method: ['GET', 'OPTIONS'], path: '/', handler: get, config: { cors: true } });
  server.route({ method: 'GET', path: '/err', handler: err, config: { cors: true } });
  server.route({ method: 'GET', path: '/test/{param}', handler: get, config: { cors: true } });

  await server.initialize();
  return server;
}


Tap.beforeEach(() => {
  sandbox = Sinon.sandbox.create();

  return Promise.resolve();
});


Tap.afterEach(() => {
  sandbox && sandbox.restore();

  return Promise.resolve();
});


describe('Plugin attaches.', (tap) => {

  let server;

  tap.beforeEach(async () => {
    server = await initServer();

    return server.register({
      plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 0
      }
    });
  });


  tap.afterEach(() => {
    return server.stop({ timeout: 0 });
  });


  tap.test('Exposes client to the server.', (t) => {
    t.plan(1);

    t.ok(server.statsd);

    t.end();
  });


  tap.end();
});


describe('Plugin reports on paths.', (tap) => {

  let server;

  tap.beforeEach(async () => {
    server = await initServer();

    return server.register({
      plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 0
      }
    });
  });


  tap.afterEach(() => {
    return server.stop({ timeout: 0 });
  });


  tap.test('Reports stats for request.', async (t) => {

    t.plan(8);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    await server.inject('/');

    t.ok(incSpy.calledTwice);
    t.ok(timingSpy.calledOnce);

    t.equals(incSpy.getCall(0).args[0], 'request.status.200');
    t.equals(incSpy.getCall(0).args[1], 1);
    t.equals(incSpy.getCall(1).args[0], 'request.received');
    t.equals(incSpy.getCall(1).args[1], 1);
    t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
    t.type(timingSpy.getCall(0).args[1], 'number');

    t.end();
  });


  tap.test('Reports stats with tags.', async (t) => {

    t.plan(8);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    await server.inject('/test/123');

    t.ok(incSpy.calledTwice);
    t.ok(timingSpy.calledOnce);

    const tags = incSpy.getCall(0).args[2];

    t.type(tags, Array);
    t.ok(tags.indexOf('path:/test/{param}') >= 0);
    t.ok(tags.indexOf('method:GET') >= 0);
    t.ok(tags.indexOf('status:200') >= 0);

    t.strictSame(incSpy.getCall(1).args[2], tags);
    t.strictSame(timingSpy.getCall(0).args[2], tags);

    t.end();
  });


  tap.test('Reports stats with generic not found path.', async (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    await server.inject('/wont/find/this');

    t.ok(incSpy.calledTwice);
    t.ok(timingSpy.calledOnce);

    t.equals(incSpy.getCall(0).args[0], 'request.status.404');
    t.equals(incSpy.getCall(1).args[0], 'request.received');
    t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
    t.type(timingSpy.getCall(0).args[1], 'number');

    t.end();
  });


  tap.test('Reports stats with generic CORS path.', async (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    await server.inject({
      method: 'OPTIONS',
      headers: {
        Origin: 'http://test.domain.com'
      },
      url: '/'
    });

    t.ok(incSpy.calledTwice);
    t.ok(timingSpy.calledOnce);

    const tags = incSpy.getCall(0).args[2];

    t.type(tags, Array);
    t.ok(tags.indexOf('path:/{cors*}') >= 0);
    t.ok(tags.indexOf('method:OPTIONS') >= 0);
    t.ok(tags.indexOf('status:200') >= 0);

    t.end();
  });


  tap.test('Does not change status code of a response.', async (t) => {

    t.plan(7);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    const res = await server.inject('/err');

    t.ok(incSpy.calledTwice);
    t.ok(timingSpy.calledOnce);

    t.equals(incSpy.getCall(0).args[0], 'request.status.500');
    t.equals(incSpy.getCall(1).args[0], 'request.received');
    t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
    t.type(timingSpy.getCall(0).args[1], 'number');

    t.equals(res.statusCode, 500);

    t.end();
  });


  tap.end();
});


describe('Plugin reports ops.', (tap) => {

  tap.test('Starts listening to ops reports.', async (t) => {
    t.plan(1);

    const server = await initServer();

    await server.register({
      plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 500
      }
    });

    const dogear = server.plugins['dogear'];

    t.ok(dogear._ops);

    await server.stop({ timeout: 0 });
    t.end();
  });


  tap.test('Report ops metrics.', async (t) => {
    t.plan(3);

    const server = await initServer();

    await server.register({
      plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 10
      }
    });

    const client = server.statsd;
    const gaugeSpy = sandbox.spy(client, 'gauge');

    // wait for the first data sample by oppsy
    await new Promise((resolve) => setTimeout(resolve, 20));

    t.ok(gaugeSpy.called);
    t.type(gaugeSpy.getCall(0).args[0], 'string');
    t.type(gaugeSpy.getCall(0).args[1], 'number');

    await server.stop({ timeout: 0 });
    t.end();
  });


  tap.test('Ignores unsupported ops metric.', async (t) => {
    t.plan(1);

    const server = await initServer();

    await server.register({
      plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 500,
        opsMetrics: [ 'bad.op.metric' ]
      }
    });

    const dogear = server.plugins['dogear'];

    t.notOk(dogear._ops);

    await server.stop({ timeout: 0 });
    t.end();
  });


  tap.end();
});

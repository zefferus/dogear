'use strict';

const Tap = require('tap');
const describe = Tap.test;

const Hapi = require('hapi');
const Sinon = require('sinon');

const plugin = require('../src/index');

let sandbox;

function initServer() {
  const server = new Hapi.Server();
  server.connection({ routes: { cors: true } });

  const get = (request, reply) => {
    reply('Success!');
  };

  const err = (request, reply) => {
    reply(new Error());
  };

  server.route({ method: [ 'GET', 'OPTIONS' ], path: '/', handler: get, config: {cors: true}});
  server.route({ method: 'GET', path: '/err', handler: err, config: {cors: true} });
  server.route({ method: 'GET', path: '/test/{param}', handler: get, config: {cors: true}});

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

  tap.beforeEach(() => {
    server = initServer();

    return server.register({
      register: plugin,
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

  tap.beforeEach(() => {
    server = initServer();

    return server.register({
      register: plugin,
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


  tap.test('Reports stats for request.', (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    server.inject('/', () => {
      t.ok(incSpy.calledTwice);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'request.status.200');
      t.equals(incSpy.getCall(1).args[0], 'request.received');
      t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Reports stats with tags.', (t) => {

    t.plan(8);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    server.inject('/test/123', () => {
      t.ok(incSpy.calledTwice);
      t.ok(timingSpy.calledOnce);

      const tags = incSpy.getCall(0).args[1];

      t.type(tags, Array);
      t.ok(tags.indexOf('path:/test/{param}') >= 0);
      t.ok(tags.indexOf('method:GET') >= 0);
      t.ok(tags.indexOf('status:200') >= 0);

      t.strictSame(incSpy.getCall(1).args[1], tags);
      t.strictSame(timingSpy.getCall(0).args[2], tags);

      t.end();
    });
  });


  tap.test('Reports stats with generic not found path.', (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    server.inject('/wont/find/this', () => {
      t.ok(incSpy.calledTwice);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'request.status.404');
      t.equals(incSpy.getCall(1).args[0], 'request.received');
      t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Reports stats with generic CORS path.', (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    server.inject({
      method: 'OPTIONS',
      headers: {
        Origin: 'http://test.domain.com'
      },
      url: '/'
    }, () => {
      t.ok(incSpy.calledTwice);
      t.ok(timingSpy.calledOnce);

      const tags = incSpy.getCall(0).args[1];

      t.type(tags, Array);
      t.ok(tags.indexOf('path:/{cors*}') >= 0);
      t.ok(tags.indexOf('method:OPTIONS') >= 0);
      t.ok(tags.indexOf('status:200') >= 0);

      t.end();
    });
  });


  tap.test('Does not change status code of a response.', (t) => {

    t.plan(7);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'histogram');

    server.inject('/err', (res) => {
      t.ok(incSpy.calledTwice);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'request.status.500');
      t.equals(incSpy.getCall(1).args[0], 'request.received');
      t.equals(timingSpy.getCall(0).args[0], 'request.response_time');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.equals(res.statusCode, 500);

      t.end();
    });
  });


  tap.end();
});


describe('Plugin reports ops.', (tap) => {

  tap.test('Starts listening to ops reports.', (t) => {
    t.plan(1);

    const server = initServer();

    server.register({
      register: plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 500
      }
    }).then(() => {

      const plugin = server.plugins['dogear'];

      t.ok(plugin._ops);

      server.stop({ timeout: 0 }).then(t.end);
    });
  });


  tap.test('Report ops metrics.', (t) => {
    t.plan(2);

    const server = initServer();

    server.register({
      register: plugin,
      options: {
        statsdConfig: {
          mock: true
        },
        opsInterval: 500
      }
    })
    .then(() => {

      const client = server.statsd;

      sandbox.stub(client, 'gauge', (metric, value) => {

        t.type(metric, 'string');
        t.type(value, 'number');

        server.stop({ timeout: 0 }).then(t.end);
      });
    });
  });


  tap.end();
});

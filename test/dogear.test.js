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


  tap.test('Reports stats with no path in stat name.', (t) => {

    t.plan(5);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'timing');

    server.inject('/', () => {
      t.ok(incSpy.calledOnce);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'GET.200');
      t.equals(timingSpy.getCall(0).args[0], 'GET.200');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Reports stats with path in stat name.', (t) => {

    t.plan(5);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'timing');

    server.inject('/test/123', () => {
      t.ok(incSpy.calledOnce);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'test_{param}.GET.200');
      t.equals(timingSpy.getCall(0).args[0], 'test_{param}.GET.200');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Reports stats with generic not found path.', (t) => {

    t.plan(5);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'timing');

    server.inject('/wont/find/this', () => {
      t.ok(incSpy.calledOnce);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], '{notFound*}.GET.404');
      t.equals(timingSpy.getCall(0).args[0], '{notFound*}.GET.404');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Reports stats with generic CORS path.', (t) => {

    t.plan(5);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'timing');

    server.inject({
      method: 'OPTIONS',
      headers: {
        Origin: 'http://test.domain.com'
      },
      url: '/'
    }, () => {
      t.ok(incSpy.calledOnce);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], '{cors*}.OPTIONS.200');
      t.equals(timingSpy.getCall(0).args[0], '{cors*}.OPTIONS.200');
      t.type(timingSpy.getCall(0).args[1], 'number');

      t.end();
    });
  });


  tap.test('Does not change status code of a response.', (t) => {

    t.plan(6);

    const client = server.statsd;

    const incSpy = sandbox.spy(client, 'increment');
    const timingSpy = sandbox.spy(client, 'timing');

    server.inject('/err', (res) => {
      t.ok(incSpy.calledOnce);
      t.ok(timingSpy.calledOnce);

      t.equals(incSpy.getCall(0).args[0], 'err.GET.500');
      t.equals(timingSpy.getCall(0).args[0], 'err.GET.500');
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

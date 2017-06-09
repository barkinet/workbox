/*
 Copyright 2016 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/* eslint-env mocha, browser */
/* global chai, workbox */

'use strict';
const testServerGen = require('../../../../utils/test-server-generator.js');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const IDBHelper = require('../../../../lib/idb-helper');
describe('request-manager test', () => {
  let tmpDirectory;
  let testServer;
  let baseTestUrl;
  let responseAchieved = 0;
  before(function() {
    tmpDirectory = fs.mkdtempSync(
      path.join(__dirname, 'tmp-')
    );

    testServer = testServerGen();
    return testServer.start(tmpDirectory, 5050)
    .then((portNumber) => {
      baseTestUrl = `http://localhost:${portNumber}`;
    });
  });

  // Kill the web server once all tests are complete.
  after(function() {
    this.timeout(10 * 1000);

    fsExtra.removeSync(tmpDirectory);

    return testServer.stop();
  });
  const callbacks = {
    onResponse: function() {
      responseAchieved ++;
    },
  };

  let queue;
  let reqManager;

  const idbHelper = new IDBHelper(
    'bgQueueSyncDB', 1, 'QueueStore');

  before( (done) => {
    const QUEUE_NAME = 'QUEUE_NAME';
    const MAX_AGE = 6;
    queue =
      new workbox.backgroundSync.test.RequestQueue({
        idbQDb: idbHelper,
        config: {maxAge: MAX_AGE},
        queueName: QUEUE_NAME,
      });
    reqManager = new workbox.backgroundSync.test.RequestManager({
      callbacks,
      queue,
    });
    done();
  });

  it('check constructor', () => {
    chai.assert.isObject(reqManager);
    chai.assert.isFunction(reqManager.attachSyncHandler);
    chai.assert.isFunction(reqManager.replayRequest);
    chai.assert.isFunction(reqManager.replayRequests);

    chai.assert.equal(reqManager._globalCallbacks, callbacks);
    chai.assert.equal(reqManager._queue, queue);
  });

  it('check replay', async function() {
    const backgroundSyncQueue
      = new workbox.backgroundSync.test.BackgroundSyncQueue({
        callbacks,
      });
    await backgroundSyncQueue.pushIntoQueue({request: new Request(`${baseTestUrl}/__echo/counter`)});
    await backgroundSyncQueue.pushIntoQueue({request: new Request(`${baseTestUrl}/__echo/counter`)});
    await backgroundSyncQueue._requestManager.replayRequests();
    chai.assert.equal(responseAchieved, 2);
  });
});

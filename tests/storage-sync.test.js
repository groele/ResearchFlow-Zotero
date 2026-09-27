const assert = require('node:assert/strict');

const localStorageState = {};

global.chrome = {
  storage: {
    local: {
      get(keys, callback) {
        const requested = Array.isArray(keys) ? keys : [keys];
        callback(Object.fromEntries(requested.filter(key => key in localStorageState).map(key => [key, localStorageState[key]])));
      },
      set(values, callback) {
        Object.assign(localStorageState, values);
        callback?.();
      }
    }
  },
  runtime: {
    sendMessage() {
      return Promise.resolve({ success: true });
    }
  }
};

require('../scripts/storage.js');

const engine = global.storage;

assert.equal(engine.getSyncConfigurationIssue({ provider: 'local', config: {} }), null);
assert.equal(
  engine.getSyncConfigurationIssue({ provider: 'webdav', config: { url: '', username: '', password: '' } }),
  'WebDAV URL is required.'
);
assert.equal(
  engine.getSyncConfigurationIssue({
    provider: 'webdav',
    config: { url: 'not-a-url', username: 'user', password: 'secret' }
  }),
  'Invalid WebDAV URL'
);
assert.equal(
  engine.getSyncConfigurationIssue({
    provider: 'webdav',
    config: { url: 'ftp://example.com/dav', username: 'user', password: 'secret' }
  }),
  'Invalid WebDAV URL'
);
assert.equal(
  engine.getSyncConfigurationIssue({
    provider: 'webdav',
    config: { url: 'https://dav.example.com/dav', username: '', password: 'secret' }
  }),
  'WebDAV username and app password are required.'
);
assert.equal(
  engine.getSyncConfigurationIssue({
    provider: 'webdav',
    config: { url: 'https://dav.example.com/dav', username: 'user', password: 'secret' }
  }),
  null
);
assert.equal(
  engine.getSyncConfigurationIssue({
    provider: 'github',
    config: { token: 'token', repo: 'missing-owner-separator' }
  }),
  'GitHub repository must use the owner/repository format.'
);

(async () => {
  engine.syncCredentials = null;
  const migrated = await engine.ensureDbShape({
    settings: {
      syncProviders: {
        metadata: {
          provider: 'github',
          config: { token: 'legacy-token', repo: 'owner/repo', branch: 'main' }
        }
      }
    }
  }, { stamp: false });
  assert.deepEqual(
    migrated.settings.syncProviders.metadata.config,
    { repo: 'owner/repo', branch: 'main' },
    'legacy credentials must be removed from the portable database'
  );
  assert.equal(
    localStorageState.researchflow_sync_credentials.github.token,
    'legacy-token',
    'legacy credentials should migrate to device-local storage'
  );
  await engine.ensureDbShape({
    settings: {
      syncProviders: {
        metadata: {
          provider: 'github',
          config: { token: 'remote-token', repo: 'remote/repo', branch: 'main' }
        }
      }
    }
  }, { stamp: false, migrateCredentials: false });
  assert.equal(
    (await engine.loadSyncCredentials()).github.token,
    'legacy-token',
    'remote database content must not overwrite device-local credentials'
  );

  engine.syncCredentials = {
    webdav: { username: 'user', password: 'secret' },
    github: { token: 'github-secret' }
  };
  assert.equal(
    await engine.shouldRunCloudSync({
      settings: { syncProviders: { metadata: { provider: 'webdav', config: { url: 'not-a-url' } } } }
    }),
    false
  );
  assert.equal(
    await engine.shouldRunCloudSync({
      settings: { syncProviders: { metadata: { provider: 'webdav', config: { url: 'https://dav.example.com/dav' } } } }
    }),
    true
  );
  assert.equal(
    await engine.shouldRunCloudSync({
      settings: { syncProviders: { metadata: { provider: 'webdav', config: { url: 'https://dav.example.com/dav' }, autoSync: false } } }
    }),
    false,
    'manual-only cloud routes should not schedule background synchronization'
  );

  const sanitized = engine.sanitizeDatabaseForExternalUse({
    settings: {
      syncProviders: {
        metadata: {
          provider: 'github',
          config: { repo: 'owner/repo', branch: 'main', token: 'github-secret', password: 'nested-secret' }
        }
      }
    },
    nested: { refreshToken: 'refresh-secret', value: 1 },
    _github_sha: 'temporary',
    _webdav_etag: '"temporary-etag"'
  });
  assert.deepEqual(sanitized.settings.syncProviders.metadata.config, { repo: 'owner/repo', branch: 'main' });
  assert.equal(sanitized.nested.refreshToken, undefined);
  assert.equal(sanitized._github_sha, undefined);
  assert.equal(sanitized._webdav_etag, undefined);
  assert(!JSON.stringify(sanitized).includes('secret'), 'external database payload must not contain credentials');

  const deletionDb = await engine.ensureDbShape({
    submissions: [{
      id: 'sub-delete-me',
      title: 'Old remote submission',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }]
  }, { stamp: false });
  assert.equal(deletionDb.schemaVersion, 7, 'tombstone support should upgrade the database schema');
  assert.equal(
    engine.recordEntityDeletion(deletionDb, 'submissions', 'sub-delete-me'),
    true,
    'submission deletion should create a durable tombstone'
  );
  assert.equal(deletionDb.submissions.length, 0);
  assert.equal(deletionDb.deletedEntities.submissions[0].id, 'sub-delete-me');
  const deletionMerged = await engine.mergeDatabases(deletionDb, {
    submissions: [{
      id: 'sub-delete-me',
      title: 'Stale remote submission',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }]
  });
  assert.equal(
    deletionMerged.submissions.length,
    0,
    'an older remote snapshot must not resurrect a deleted submission'
  );

  let webdavPayload = '';
  global.fetch = async (_url, options = {}) => {
    webdavPayload = String(options.body || '');
    return { ok: true, json: async () => ({}) };
  };
  await engine.saveToWebDAV(
    { url: 'https://dav.example.com/dav', username: '研究者', password: 'pässword' },
    {
      settings: {
        syncProviders: {
          metadata: {
            provider: 'webdav',
            config: { url: 'https://dav.example.com/dav', username: '研究者', password: 'pässword' }
          }
        }
      }
    }
  );
  assert(!webdavPayload.includes('pässword'), 'WebDAV payload must redact credentials');
  assert(!webdavPayload.includes('研究者'), 'WebDAV payload must redact usernames');

  let webdavIfMatch = '';
  global.fetch = async (_url, options = {}) => {
    webdavIfMatch = options.headers?.get?.('If-Match') || '';
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await engine.saveToWebDAV(
    { url: 'https://dav.example.com/dav', username: 'user', password: 'secret' },
    { _webdav_etag: '"remote-version-7"', settings: {} }
  );
  assert.equal(webdavIfMatch, '"remote-version-7"', 'WebDAV writes should use the fetched ETag to prevent silent overwrite');

  const githubRequests = [];
  global.fetch = async (url, options = {}) => {
    githubRequests.push({ url, options });
    if (options.method === 'PUT' && githubRequests.filter(item => item.options.method === 'PUT').length === 1) {
      return {
        ok: false,
        status: 409,
        json: async () => ({ message: 'sha does not match' })
      };
    }
    if (!options.method) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: 'fresh-remote-sha',
          content: btoa(JSON.stringify({
            manuscripts: [{
              id: 'remote-only-manuscript',
              title: 'Remote concurrent manuscript',
              createdAt: '2026-07-30T00:00:00.000Z',
              updatedAt: '2026-07-30T00:00:00.000Z'
            }],
            settings: { syncProviders: { metadata: { provider: 'local', config: {} } } }
          }))
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: { sha: 'saved-sha' } })
    };
  };
  const githubDatabase = await engine.ensureDbShape({
    _github_sha: 'stale-sha',
    settings: { syncProviders: { metadata: { provider: 'local', config: {} } } }
  }, { stamp: false });
  await engine.saveToGitHub(
    { token: 'token', repo: 'owner/repo', branch: 'main' },
    githubDatabase
  );
  const githubPutRequests = githubRequests.filter(item => item.options.method === 'PUT');
  assert.equal(githubPutRequests.length, 2, 'GitHub SHA conflicts should retry exactly once');
  assert.equal(
    JSON.parse(githubPutRequests[1].options.body).sha,
    'fresh-remote-sha',
    'the GitHub retry should use the latest remote SHA'
  );
  assert.equal(githubDatabase._github_sha, 'saved-sha', 'successful GitHub writes should retain the new SHA');
  assert(
    githubDatabase.manuscripts.some(item => item.id === 'remote-only-manuscript'),
    'the local database should adopt records merged during a GitHub conflict retry'
  );

  let scheduledSyncs = 0;
  engine.ensureDbShape = async data => data;
  engine.persistLocal = async () => {};
  engine.scheduleBackgroundSync = () => {
    scheduledSyncs += 1;
  };

  await engine.saveAll({
    settings: {
      syncProviders: {
        metadata: {
          provider: 'webdav',
          config: { url: 'not-a-url' }
        }
      }
    }
  });
  assert.equal(scheduledSyncs, 0, 'local save must not schedule an invalid WebDAV route');

  await engine.saveAll({
    settings: {
      syncProviders: {
        metadata: {
          provider: 'webdav',
          config: { url: 'https://dav.example.com/dav' }
        }
      }
    }
  });
  assert.equal(scheduledSyncs, 1, 'local save should schedule a complete WebDAV route');

  let delegatedMessage = null;
  global.window = {};
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = (message, callback) => {
    delegatedMessage = message;
    callback?.({
      success: true,
      data: {
        revision: 7,
        settings: { syncProviders: { metadata: { provider: 'local', config: {} } } }
      }
    });
  };
  const delegatedInput = {
    revision: 6,
    settings: { syncProviders: { metadata: { provider: 'local', config: {} } } }
  };
  const delegatedResult = await engine.saveAll(delegatedInput, { mergeOnConflict: true });
  assert.equal(delegatedMessage.action, 'SAVE_DATABASE');
  assert.equal(delegatedMessage.mergeOnConflict, true);
  assert.equal(delegatedResult.revision, 7, 'workspace should adopt the serialized writer result');
  assert.equal(delegatedInput.revision, 7, 'the caller database reference should receive the committed revision');
  assert.equal(delegatedResult, delegatedInput, 'save callers should retain one authoritative in-memory database object');
  chrome.runtime.sendMessage = originalSendMessage;
  delete global.window;

  console.log('storage sync configuration tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

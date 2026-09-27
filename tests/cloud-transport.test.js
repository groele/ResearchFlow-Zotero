const assert = require('node:assert/strict');
const http = require('node:http');
const values = {};
global.chrome = {
  storage: { local: {
    get(_keys, cb) { cb(values); },
    set(next, cb) { Object.assign(values, structuredClone(next)); cb?.(); }
  } },
  runtime: { sendMessage: () => Promise.resolve() }
};
require('../scripts/storage.js');
const engine = global.storage;
let remote = null;
let revision = 0;
let forbidden = false;
let hideEtag = false;
let writes = 0;
const server = http.createServer(async (request, response) => {
  if (forbidden || request.headers.authorization !== `Basic ${Buffer.from('qa:test').toString('base64')}`) {
    response.writeHead(403).end(); return;
  }
  if (request.method === 'GET') {
    if (!remote) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': 'application/json', ...(hideEtag ? {} : { ETag: `"${revision}"` }) });
    response.end(JSON.stringify(remote)); return;
  }
  if (request.method === 'PUT') {
    if ((request.headers['if-none-match'] === '*' && remote) || (request.headers['if-match'] && request.headers['if-match'] !== `"${revision}"`)) {
      response.writeHead(412).end(); return;
    }
    let text = '';
    for await (const chunk of request) text += chunk;
    remote = JSON.parse(text); revision++; writes++;
    response.writeHead(201, { ETag: `"${revision}"` }).end(); return;
  }
  response.writeHead(405).end();
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const config = { url: `http://127.0.0.1:${server.address().port}`, username: 'qa', password: 'test' };
    const local = await engine.ensureDbShape({ deviceId: 'qa', manuscripts: [{ id: 'm1', title: '中文 α 🧪' }] });
    assert.equal(await engine.fetchFromWebDAV(config), null);
    await engine.saveToWebDAV(config, local);
    assert.equal(local._webdav_etag, '"1"');
    const downloaded = await engine.fetchFromWebDAV(config);
    assert.equal(downloaded.manuscripts[0].title, '中文 α 🧪');
    assert(!('_webdav_etag' in remote));
    const stale = structuredClone(downloaded);
    revision++;
    remote.manuscripts[0].title = 'Other device';
    await assert.rejects(engine.saveToWebDAV(config, stale), /conflict/);
    assert.equal(remote.manuscripts[0].title, 'Other device');
    const firstCreate = structuredClone(local);
    delete firstCreate._webdav_etag;
    await assert.rejects(engine.saveToWebDAV(config, firstCreate), /conflict/, 'creation must not overwrite another device');
    hideEtag = true;
    const noEtag = await engine.fetchFromWebDAV(config);
    await assert.rejects(engine.saveToWebDAV(config, noEtag), /ETag/);
    forbidden = true;
    await assert.rejects(engine.fetchFromWebDAV(config), /read failed/);
    assert.equal(writes, 1, 'failed or unsafe requests must not change remote contents');
    console.log('cloud HTTP transport tests passed (loopback WebDAV fixture)');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

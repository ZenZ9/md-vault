'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'markdown.js'), 'utf8');
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const render = context.globalThis.renderMarkdown;

assert.match(render('[safe](https://example.com)'), /href="https:\/\/example\.com"/);
assert.match(render('[mail](mailto:test@example.com)'), /href="mailto:test@example.com"/);
assert.doesNotMatch(render('[bad](javascript:alert(1))'), /href="javascript:/i);
assert.doesNotMatch(render('[bad](data:text/html,boom)'), /href="data:/i);
assert.equal(render('[bad](//evil.example/path)').includes('href='), false);
assert.doesNotMatch(render('![bad](javascript:alert(1))'), /src="javascript:/i);
assert.match(render('[[Notes/Inbox]]'), /data-wikilink="Notes\/Inbox"/);

console.log('markdown tests passed');

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

/* ---------- rendering ---------- */

assert.equal(render('# Hello'), '<h1>Hello</h1>');
assert.equal(render('### Sub ##'), '<h3>Sub</h3>');

assert.equal(render('**bold** and *it*'), '<p><strong>bold</strong> and <em>it</em></p>');
assert.equal(render('~~gone~~'), '<p><del>gone</del></p>');
assert.equal(render('`**not bold**`'), '<p><code>**not bold**</code></p>');

// raw HTML is escaped, never passed through
assert.equal(render('<b>hi</b>'), '<p>&lt;b&gt;hi&lt;/b&gt;</p>');

assert.equal(
  render('```js\nconst a = 1 < 2 && b;\n```'),
  '<pre><span class="code-lang">js</span><code>const a = 1 &lt; 2 &amp;&amp; b;</code></pre>'
);
assert.equal(render('```\nplain\n```'), '<pre><code>plain</code></pre>');

assert.equal(
  render('| a | b |\n|:--|--:|\n| 1 | 2 |'),
  '<table><thead><tr><th style="text-align:left">a</th><th style="text-align:right">b</th></tr></thead>' +
    '<tbody><tr><td style="text-align:left">1</td><td style="text-align:right">2</td></tr></tbody></table>'
);

// the line number is what lets Preview toggle the checkbox in the real file
assert.equal(
  render('- [ ] todo'),
  '<ul><li class="task"><input type="checkbox" class="task" data-line="0"> todo</li></ul>'
);
assert.equal(
  render('- [x] done'),
  '<ul><li class="task"><input type="checkbox" class="task" data-line="0" checked> done</li></ul>'
);

assert.equal(
  render('[[Note|see here]]'),
  '<p><a href="#" class="wikilink" data-wikilink="Note" title="Note">see here</a></p>'
);
assert.equal(
  render('[[Note#part]]'),
  '<p><a href="#" class="wikilink" data-wikilink="Note#part" title="Note#part">Note</a></p>'
);

assert.equal(
  render('[docs](https://example.com)'),
  '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a></p>'
);
assert.equal(render('![alt](pic.png)'), '<p><img alt="alt" src="pic.png"></p>');

assert.equal(
  render('---\ntitle: note\n---\n# Hi'),
  '<details class="frontmatter"><summary>frontmatter</summary><pre>title: note</pre></details>' +
    '<h1>Hi</h1>'
);

assert.equal(render('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
assert.equal(render('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
assert.equal(render('- a\n  - b'), '<ul><li>a<ul><li>b</li></ul></li></ul>');
assert.equal(render('- item\n  continued'), '<ul><li>item continued</li></ul>');

assert.equal(render('> quoted'), '<blockquote><p>quoted</p></blockquote>');
assert.equal(render('a\n\n---'), '<p>a</p><hr>');
assert.equal(render('a\nb'), '<p>a<br>b</p>');

assert.equal(render(''), '');
assert.equal(render(null), '');

console.log('markdown tests passed');

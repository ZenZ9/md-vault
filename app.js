'use strict';

var TEXT_RE = /\.(md|markdown|txt)$/i;

var els = {
  tree: document.getElementById('tree'),
  newFolderBtn: document.getElementById('new-folder-btn'),
  targetLabel: document.getElementById('target-label'),
  sidebar: document.querySelector('.sidebar'),
  scrim: document.getElementById('scrim'),
  menuBtn: document.getElementById('menu-btn'),
  search: document.getElementById('search'),
  vaultName: document.getElementById('vault-name'),
  openBtn: document.getElementById('open-btn'),
  newBtn: document.getElementById('new-btn'),
  reopenBar: document.getElementById('reopen-bar'),
  reopenBtn: document.getElementById('reopen-btn'),
  fallbackInput: document.getElementById('fallback-input'),
  filePath: document.getElementById('file-path'),
  status: document.getElementById('status'),
  previewBtn: document.getElementById('toggle-preview'),
  panes: document.getElementById('panes'),
  editor: document.getElementById('editor'),
  preview: document.getElementById('preview'),
  completions: document.getElementById('completions'),
};

var state = {
  root: null,
  byName: new Map(),
  file: null,
  dirty: false,
  readOnly: false,
  collapsed: new Set(),
  query: '',
  target: '',
  saveTimer: null,
  renderTimer: null,
  savedHandle: null,
  completer: { open: false, items: [], index: 0, start: 0 },
};

var esc = globalThis.escapeHtml;

/* ---------- shared helpers ---------- */

function setStatus(text) {
  els.status.textContent = text || '';
}

function setDrawer(open) {
  els.sidebar.classList.toggle('open', !!open);
  els.scrim.hidden = !open;
}

function runEditorChange() {
  els.editor.dispatchEvent(new Event('input'));
}

function renderPreviewNow() {
  clearTimeout(state.renderTimer);
  els.preview.innerHTML = globalThis.renderMarkdown(els.editor.value);
  markBrokenLinks();
}

function scheduleRender() {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(renderPreviewNow, 120);
}

function markBrokenLinks() {
  var links = els.preview.querySelectorAll('a.wikilink');
  for (var i = 0; i < links.length; i++) {
    links[i].classList.toggle('broken', !resolveLink(links[i].getAttribute('data-wikilink')));
  }
}

function clearEditor() {
  state.file = null;
  state.dirty = false;
  els.editor.value = '';
  els.editor.disabled = true;
  els.preview.innerHTML = '';
  els.filePath.textContent = 'No file selected';
  hideCompletions();
  renderTree();
}

function walk(nodes, fn) {
  nodes.forEach(function (n) {
    fn(n);
    if (n.children) walk(n.children, fn);
  });
}

function flatFiles(nodes, out) {
  walk(nodes, function (n) {
    if (n.kind === 'file') out.push(n);
  });
  return out;
}

/* ---------- last vault (IndexedDB) ---------- */

function openDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open('md-vault', 1);
    req.onupgradeneeded = function () {
      req.result.createObjectStore('kv');
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

function idbGet(key) {
  return openDb()
    .then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    })
    .catch(function () { return null; });
}

function idbSet(key, value) {
  return openDb()
    .then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    })
    .catch(function () {});
}

async function restoreVault() {
  var handle = await idbGet('root');
  if (!handle || !handle.name || typeof handle.queryPermission !== 'function') return;

  state.savedHandle = handle;
  var perm = 'prompt';
  try {
    perm = await handle.queryPermission({ mode: 'readwrite' });
  } catch (e) {
    return;
  }
  if (perm === 'granted') {
    try {
      await loadVault(handle);
      return;
    } catch (e) {
      /* fall through to the manual reopen button */
    }
  }
  els.reopenBtn.textContent = handle.name;
  els.reopenBar.hidden = false;
}

async function reopenLast() {
  var handle = state.savedHandle;
  if (!handle) return;
  try {
    var perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return setStatus('permission denied');
    els.reopenBar.hidden = true;
    await loadVault(handle);
  } catch (err) {
    setStatus('cannot reopen: ' + err.message);
  }
}

/* ---------- vault scanning (File System Access API) ---------- */

async function scanDir(handle, path) {
  var children = [];
  for await (var entry of handle.values()) {
    if (entry.name.startsWith('.')) continue;
    if (entry.kind === 'directory') {
      if (entry.name === 'node_modules') continue;
      children.push({
        kind: 'dir',
        name: entry.name,
        path: path + entry.name + '/',
        handle: entry,
        children: await scanDir(entry, path + entry.name + '/'),
      });
    } else if (TEXT_RE.test(entry.name)) {
      children.push({
        kind: 'file',
        name: entry.name,
        path: path + entry.name,
        handle: entry,
      });
    }
  }
  sortNodes(children);
  return children;
}

function sortNodes(nodes) {
  nodes.sort(function (a, b) {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  nodes.forEach(function (n) {
    if (n.children) sortNodes(n.children);
  });
}

function indexNotes(nodes, map) {
  nodes.forEach(function (n) {
    if (n.kind === 'dir' && n.children) indexNotes(n.children, map);
    else if (n.kind === 'file') {
      var base = n.name.toLowerCase().replace(TEXT_RE, '');
      if (!map.has(base)) map.set(base, n);
    }
  });
  return map;
}

async function loadVault(handle) {
  state.readOnly = false;
  state.file = null;
  state.dirty = false;
  state.collapsed.clear();
  state.query = '';
  els.search.value = '';
  state.root = { kind: 'dir', name: handle.name, path: '', handle: handle, children: [] };
  state.byName = new Map();
  state.savedHandle = handle;
  els.vaultName.textContent = handle.name;
  els.newBtn.disabled = false;
  els.newFolderBtn.disabled = false;
  setTarget('');
  els.reopenBar.hidden = true;
  clearEditor();
  idbSet('root', handle);
  await rescan();
}

async function rescan() {
  state.root.children = await scanDir(state.root.handle, '');
  state.byName = indexNotes(state.root.children, new Map());
  if (state.file && !findPath(state.root.children, state.file.path)) clearEditor();
  renderTree();
}

function findPath(nodes, path) {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.path === path) return n;
    if (n.children) {
      var hit = findPath(n.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

function findFileLoose(path) {
  var target = String(path).toLowerCase();
  var hit = null;
  walk(state.root ? state.root.children : [], function (n) {
    if (!hit && n.kind === 'file' && n.path.toLowerCase() === target) hit = n;
  });
  return hit;
}

function findDir(path) {
  if (!path) return state.root;
  var node = findPath(state.root.children, path.endsWith('/') ? path : path + '/');
  return node && node.kind === 'dir' ? node : null;
}

function resolveLink(target) {
  var name = String(target || '').replace(/#.*$/, '').trim();
  if (!name) return null;
  var base = name.split('/').pop().toLowerCase().replace(TEXT_RE, '');
  return state.byName.get(base) || null;
}

/* ---------- fallback: <input webkitdirectory>, read-only ---------- */

function loadFromFileList(list) {
  var entries = [];
  Array.prototype.forEach.call(list, function (f) {
    var rel = f.webkitRelativePath || f.name;
    var parts = rel.split('/');
    var rootName = parts.shift();
    if (parts.some(function (p) { return p.startsWith('.'); })) return;
    if (!TEXT_RE.test(f.name)) return;
    entries.push({ parts: parts, file: f, rootName: rootName });
  });
  if (!entries.length) return setStatus('no markdown files in that folder');

  var rootName = entries[0].rootName || 'folder';
  state.readOnly = true;
  state.file = null;
  state.dirty = false;
  state.query = '';
  els.search.value = '';
  state.root = { kind: 'dir', name: rootName, path: '', handle: null, children: [] };

  entries.forEach(function (e) {
    var dir = state.root;
    for (var i = 0; i < e.parts.length - 1; i++) {
      var name = e.parts[i];
      var next = dir.children.find(function (c) { return c.kind === 'dir' && c.name === name; });
      if (!next) {
        next = { kind: 'dir', name: name, path: dir.path + name + '/', handle: null, children: [] };
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({
      kind: 'file',
      name: e.parts[e.parts.length - 1],
      path: e.parts.join('/'),
      handle: null,
      file: e.file,
    });
  });

  sortNodes(state.root.children);
  state.byName = indexNotes(state.root.children, new Map());
  els.vaultName.textContent = rootName + ' (read-only)';
  els.newBtn.disabled = true;
  els.newFolderBtn.disabled = true;
  setTarget('');
  clearEditor();
  setStatus('read-only: this browser cannot write files back');
}

/* ---------- tree ---------- */

function matchesQuery(node) {
  if (!state.query) return true;
  var q = state.query.toLowerCase();
  return node.name.toLowerCase().indexOf(q) !== -1 || node.path.toLowerCase().indexOf(q) !== -1;
}

function renderTree() {
  els.tree.textContent = '';
  if (!state.root) return hint('Open a folder of .md files to get started.');
  if (!state.root.children.length) return hint('Empty folder — use "+ Note" to create the first note.');

  if (state.query) {
    var hits = flatFiles(state.root.children, []).filter(matchesQuery).slice(0, 100);
    if (!hits.length) return hint('No file matches "' + state.query + '"');
    var flat = document.createElement('ul');
    flat.className = 'tree';
    hits.forEach(function (n) {
      flat.appendChild(fileRow(n, true));
    });
    els.tree.appendChild(flat);
    return;
  }

  var ul = document.createElement('ul');
  ul.className = 'tree';
  state.root.children.forEach(function (node) {
    ul.appendChild(treeItem(node));
  });
  els.tree.appendChild(ul);
}

function hint(text) {
  var p = document.createElement('p');
  p.className = 'hint';
  p.textContent = text;
  els.tree.appendChild(p);
}

function treeItem(node) {
  var li = document.createElement('li');

  if (node.kind === 'dir') {
    var open = !state.collapsed.has(node.path);
    var row = document.createElement('button');
    row.type = 'button';
    row.className =
      'row dir' + (open ? ' open' : '') + (state.target === node.path ? ' selected' : '');
    row.title = node.path || '/';

    var chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = open ? '▾' : '▸';
    chev.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFolder(node.path);
    });

    var label = document.createElement('span');
    label.className = 'name';
    label.textContent = node.name;

    row.appendChild(chev);
    row.appendChild(label);
    row.addEventListener('click', function () {
      // clicking a folder makes it the destination for new notes/folders
      if (state.collapsed.has(node.path)) state.collapsed.delete(node.path);
      setTarget(node.path);
    });
    li.appendChild(row);

    if (open) {
      var sub = document.createElement('ul');
      sub.className = 'tree';
      node.children.forEach(function (child) {
        sub.appendChild(treeItem(child));
      });
      li.appendChild(sub);
    }
    return li;
  }

  li.appendChild(fileRow(node, false));
  return li;
}

function fileRow(node, showDir) {
  var row = document.createElement('button');
  row.type = 'button';
  row.className = 'row file' + (state.file && state.file.path === node.path ? ' active' : '');
  row.title = node.path;
  var ext = (/\.([a-z0-9]+)$/i.exec(node.name) || [, ''])[1].toLowerCase();
  row.innerHTML =
    '<span class="ext">' + esc(ext) + '</span>' +
    '<span class="name">' + esc(node.name.replace(/\.[^.]+$/, '')) + '</span>' +
    (showDir && node.path.indexOf('/') !== -1
      ? '<span class="dirpath">' + esc(node.path.replace(/\/[^/]*$/, '')) + '</span>'
      : '');
  row.addEventListener('click', function () {
    openFile(node);
  });
  return row;
}

/* ---------- file io ---------- */

async function openFile(node) {
  if (state.file && state.file.path === node.path) return;
  await flushSave();

  try {
    var text;
    if (node.handle) {
      var file = await node.handle.getFile();
      text = await file.text();
    } else {
      text = await node.file.text();
    }
    state.file = node;
    state.dirty = false;
    els.editor.value = text;
    els.editor.disabled = false;
    els.filePath.textContent = node.path;
    setStatus(state.readOnly ? 'read-only' : '');
    renderPreviewNow();
    renderTree();
    hideCompletions();
    setDrawer(false); // on phones the file list is a drawer
  } catch (err) {
    setStatus('open failed: ' + err.message);
  }
}

async function save() {
  clearTimeout(state.saveTimer);
  if (!state.file || !state.dirty) return;
  if (state.readOnly || !state.file.handle) {
    setStatus('read-only: cannot save');
    return;
  }
  var target = state.file;
  var text = els.editor.value;
  try {
    setStatus('saving…');
    var writable = await target.handle.createWritable();
    await writable.write(text);
    await writable.close();
    if (state.file === target) {
      state.dirty = false;
      setStatus('saved');
      setTimeout(function () {
        if (!state.dirty && els.status.textContent === 'saved') setStatus('');
      }, 1200);
    }
  } catch (err) {
    setStatus('save failed: ' + err.message);
  }
}

async function flushSave() {
  clearTimeout(state.saveTimer);
  if (state.dirty) await save();
}

/* ---------- actions ---------- */

async function openFolder() {
  if (!('showDirectoryPicker' in window)) {
    setStatus('folder picker unavailable — using read-only fallback');
    els.fallbackInput.click();
    return;
  }
  try {
    var handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'md-vault' });
    await loadVault(handle);
  } catch (err) {
    if (err && err.name !== 'AbortError') setStatus(err.message);
  }
}

function toggleFolder(path) {
  if (state.collapsed.has(path)) state.collapsed.delete(path);
  else state.collapsed.add(path);
  renderTree();
}

function setTarget(path) {
  state.target = path || '';
  els.targetLabel.textContent = 'Target: /' + state.target;
  renderTree();
}

function targetDir() {
  if (!state.root) return null;
  var dir = state.target ? findDir(state.target) : state.root;
  if (dir && dir.handle) return { handle: dir.handle, path: dir.path };
  return state.root.handle ? { handle: state.root.handle, path: '' } : null;
}

function cleanName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '').trim();
}

async function newNote() {
  if (!state.root) return setStatus('open a folder first');
  if (state.readOnly || !state.root.handle) return setStatus('read-only: cannot create files');

  var dir = targetDir();
  if (!dir) return setStatus('cannot resolve the target folder');

  var raw = (window.prompt('New note in /' + dir.path, 'untitled') || '').trim();
  if (!raw) return;
  var name = cleanName(TEXT_RE.test(raw) ? raw : raw + '.md');
  if (!name) return setStatus('invalid name');

  try {
    var handle = await dir.handle.getFileHandle(name, { create: true });
    await rescan();
    await openFile({ kind: 'file', name: name, path: dir.path + name, handle: handle });
    els.editor.focus();
  } catch (err) {
    setStatus('create failed: ' + err.message);
  }
}

async function newFolder() {
  if (!state.root) return setStatus('open a folder first');
  if (state.readOnly || !state.root.handle) return setStatus('read-only: cannot create folders');

  var dir = targetDir();
  if (!dir) return setStatus('cannot resolve the target folder');

  var raw = (window.prompt('New folder in /' + dir.path, 'folder') || '').trim();
  if (!raw) return;
  var name = cleanName(raw);
  if (!name) return setStatus('invalid name');

  try {
    await dir.handle.getDirectoryHandle(name, { create: true });
    var path = dir.path + name + '/';
    state.collapsed.delete(path);
    await rescan();
    setTarget(path);
    setStatus('folder created: /' + path);
  } catch (err) {
    setStatus('create folder failed: ' + err.message);
  }
}

/* ---------- wikilink autocomplete ---------- */

function completionContext() {
  var el = els.editor;
  if (el.disabled) return null;
  var pos = el.selectionStart;
  if (pos !== el.selectionEnd) return null;
  var before = el.value.slice(0, pos);
  var open = before.lastIndexOf('[[');
  if (open === -1) return null;
  var between = before.slice(open + 2);
  if (between.length > 80 || /[\[\]|\n]/.test(between)) return null;
  return { start: open, query: between };
}

function updateCompletions() {
  var ctx = completionContext();
  if (!ctx) return hideCompletions();

  var q = ctx.query.trim().toLowerCase();
  var candidates = [];
  state.byName.forEach(function (node, base) {
    if (!q || base.indexOf(q) !== -1) candidates.push({ base: base, node: node });
  });
  if (!candidates.length) return hideCompletions();

  candidates.sort(function (a, b) {
    var aStarts = a.base.indexOf(q) === 0 ? 0 : 1;
    var bStarts = b.base.indexOf(q) === 0 ? 0 : 1;
    return aStarts - bStarts || a.base.localeCompare(b.base);
  });

  state.completer = { open: true, items: candidates.slice(0, 8), index: 0, start: ctx.start };
  renderCompletions();
}

function renderCompletions() {
  var c = state.completer;
  els.completions.textContent = '';
  if (!c.open) {
    els.completions.hidden = true;
    return;
  }
  c.items.forEach(function (item, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'comp-item' + (idx === c.index ? ' active' : '');
    btn.textContent = item.base;
    btn.title = item.node.path;
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault(); // keep the caret in the textarea
      acceptCompletion(idx);
    });
    els.completions.appendChild(btn);
  });
  els.completions.hidden = false;
}

function hideCompletions() {
  state.completer.open = false;
  els.completions.hidden = true;
  els.completions.textContent = '';
}

function acceptCompletion(idx) {
  var c = state.completer;
  if (!c.open) return;
  var item = c.items[idx == null ? c.index : idx];
  if (!item) return hideCompletions();

  var el = els.editor;
  var caret = el.selectionStart;
  var insert = '[[' + item.base + ']]';
  el.value = el.value.slice(0, c.start) + insert + el.value.slice(caret);
  var pos = c.start + insert.length;
  el.setSelectionRange(pos, pos);
  hideCompletions();
  runEditorChange();
  el.focus();
}

/* ---------- editor helpers ---------- */

function wrapSelection(marker) {
  var el = els.editor;
  var start = el.selectionStart;
  var end = el.selectionEnd;
  var sel = el.value.slice(start, end);
  el.value = el.value.slice(0, start) + marker + sel + marker + el.value.slice(end);
  var pos = start + marker.length + sel.length;
  if (sel) el.setSelectionRange(start + marker.length, pos);
  else el.setSelectionRange(pos, pos);
  runEditorChange();
}

function insertText(text) {
  var el = els.editor;
  var start = el.selectionStart;
  var end = el.selectionEnd;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.setSelectionRange(start + text.length, start + text.length);
  runEditorChange();
}

function continueList() {
  var el = els.editor;
  var pos = el.selectionStart;
  var lineStart = el.value.lastIndexOf('\n', pos - 1) + 1;
  var line = el.value.slice(lineStart, pos);
  var m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
  if (!m) return false;

  var indent = m[1];
  var marker = m[2];
  var body = m[3].trim();

  // empty item -> drop the marker instead of starting a new one
  if (!body) {
    el.value = el.value.slice(0, lineStart) + el.value.slice(pos);
    el.setSelectionRange(lineStart, lineStart);
    runEditorChange();
    return true;
  }

  if (/^\d/.test(marker)) {
    var digits = /^\d+/.exec(marker)[0];
    marker = String(parseInt(digits, 10) + 1) + marker.slice(digits.length);
  }

  var insert = '\n' + indent + marker + ' ';
  el.value = el.value.slice(0, pos) + insert + el.value.slice(el.selectionEnd);
  var caret = pos + insert.length;
  el.setSelectionRange(caret, caret);
  runEditorChange();
  return true;
}

function handleTab(shift) {
  var el = els.editor;
  if (!shift) return insertText('  ');
  var pos = el.selectionStart;
  var before = el.value.slice(Math.max(0, pos - 2), pos);
  var remove = before === '  ' ? 2 : before.endsWith(' ') ? 1 : 0;
  if (!remove) return;
  el.value = el.value.slice(0, pos - remove) + el.value.slice(el.selectionEnd);
  el.setSelectionRange(pos - remove, pos - remove);
  runEditorChange();
}

/* ---------- local markdown links ---------- */

function resolvePath(basePath, href) {
  var dir = basePath ? basePath.split('/').slice(0, -1) : [];
  String(href)
    .split('/')
    .forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') dir.pop();
      else dir.push(part);
    });
  return dir.join('/');
}

function resolveLocalLink(href) {
  var raw = href;
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {
    /* keep the raw string */
  }
  raw = raw.replace(/[?#].*$/, '');
  if (!raw) return null;

  var path = resolvePath(state.file ? state.file.path : '', raw);
  var exact = findFileLoose(path);
  if (exact) return exact;
  if (!TEXT_RE.test(path)) {
    var withExt = findFileLoose(path + '.md');
    if (withExt) return withExt;
  }
  return resolveLink(raw.split('/').pop());
}

function toggleTask(box) {
  var line = Number(box.getAttribute('data-line'));
  if (!isFinite(line)) return;
  var lines = els.editor.value.split('\n');
  if (lines[line] == null) return;
  lines[line] = lines[line].replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/,
    function (m, prefix, mark) {
      return prefix + (mark.toLowerCase() === 'x' ? '[ ]' : '[x]');
    }
  );
  els.editor.value = lines.join('\n');
  runEditorChange();
}

/* ---------- wiring ---------- */

els.openBtn.addEventListener('click', openFolder);
els.newBtn.addEventListener('click', newNote);
els.newFolderBtn.addEventListener('click', newFolder);
els.targetLabel.addEventListener('click', function () {
  setTarget(''); // back to the vault root
});
els.reopenBtn.addEventListener('click', reopenLast);

els.menuBtn.addEventListener('click', function () {
  setDrawer(!els.sidebar.classList.contains('open'));
});

els.scrim.addEventListener('click', function () {
  setDrawer(false);
});

els.search.addEventListener('input', function () {
  state.query = els.search.value.trim();
  renderTree();
});

els.search.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    els.search.value = '';
    state.query = '';
    renderTree();
  }
});

els.fallbackInput.addEventListener('change', function () {
  if (els.fallbackInput.files && els.fallbackInput.files.length) {
    loadFromFileList(els.fallbackInput.files);
  }
});

els.previewBtn.addEventListener('click', function () {
  var on = els.panes.classList.toggle('preview-on');
  els.previewBtn.classList.toggle('active', on);
  if (on) renderPreviewNow();
});

els.editor.addEventListener('input', function () {
  if (!state.file) return;
  state.dirty = true;
  setStatus(state.readOnly ? 'read-only' : 'unsaved');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(save, 500);
  scheduleRender();
  if (state.completer.open) updateCompletions();
});

els.editor.addEventListener('blur', function () {
  flushSave();
  hideCompletions();
});

els.editor.addEventListener('click', function () {
  if (state.completer.open) updateCompletions();
});

els.editor.addEventListener('keydown', function (e) {
  var c = state.completer;
  if (c.open) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      c.index = (c.index + 1) % c.items.length;
      return renderCompletions();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      c.index = (c.index - 1 + c.items.length) % c.items.length;
      return renderCompletions();
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      return acceptCompletion();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      return hideCompletions();
    }
  }

  var mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    return wrapSelection('**');
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    return wrapSelection('*');
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    return handleTab(e.shiftKey);
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    if (continueList()) e.preventDefault();
  }
});

els.preview.addEventListener('click', function (e) {
  var target = e.target;

  var box = target.closest && target.closest('input.task');
  if (box) {
    toggleTask(box);
    return;
  }

  var wiki = target.closest && target.closest('a.wikilink');
  if (wiki) {
    e.preventDefault();
    var name = wiki.getAttribute('data-wikilink') || '';
    var node = resolveLink(name);
    if (node) {
      openFile(node);
    } else {
      wiki.classList.add('broken');
      setStatus('no note matches [[' + name + ']]');
    }
    return;
  }

  var link = target.closest && target.closest('a[href]');
  if (!link) return;
  var href = link.getAttribute('href') || '';
  if (/^(https?:|mailto:|#|data:)/i.test(href)) return;
  var local = resolveLocalLink(href);
  if (local) {
    e.preventDefault();
    openFile(local);
  }
});

document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
  if (e.key === 'Escape') setDrawer(false);
});

window.addEventListener('beforeunload', function (e) {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').catch(function () {
      /* offline support is a bonus, never fatal */
    });
  });
}

renderTree();
restoreVault();

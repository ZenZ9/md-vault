/* Minimal dependency-free Markdown renderer.
   Everything is HTML-escaped first, so raw HTML in notes is shown as text. */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(s) {
    // pull inline code out first so its content is never parsed as markup
    var codes = [];
    var out = esc(s).replace(/`([^`]+)`/g, function (m, c) {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    // [[note]] / [[note|label]] — the app resolves these against the vault
    out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (m, target, label) {
      var name = target.trim();
      var text = (label == null ? name.replace(/#.*$/, '') : label.trim()) || name;
      return (
        '<a href="#" class="wikilink" data-wikilink="' + name + '" title="' + name + '">' + text + '</a>'
      );
    });

    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
      return '<img alt="' + alt + '" src="' + src + '">';
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, href) {
      return '<a href="' + href + '" target="_blank" rel="noreferrer">' + text + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    out = out.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
      return '<code>' + codes[Number(idx)] + '</code>';
    });
    return out;
  }

  function buildList(items) {
    var ordered = items[0].ordered;
    var out = ordered ? '<ol>' : '<ul>';
    var i = 0;
    while (i < items.length) {
      var item = items[i];
      var task = /^\[([ xX])\]\s+(.*)$/.exec(item.text);
      var inner = task
        ? '<input type="checkbox" class="task" data-line="' + item.line + '"' +
          (task[1].toLowerCase() === 'x' ? ' checked' : '') + '> ' + inline(task[2])
        : inline(item.text);
      var li = '<li' + (task ? ' class="task"' : '') + '>' + inner;
      i++;
      if (i < items.length && items[i].depth > item.depth) {
        var j = i;
        while (j < items.length && items[j].depth > item.depth) j++;
        li += buildList(items.slice(i, j));
        i = j;
      }
      out += li + '</li>';
    }
    return out + (ordered ? '</ol>' : '</ul>');
  }

  /* --- tables --- */

  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split('|').map(function (c) { return c.trim(); });
  }

  function isDelimiterRow(line) {
    var s = line.trim();
    if (s.indexOf('-') === -1) return false;
    return /^\|?(\s*:?-{1,}:?\s*\|)*\s*:?-{1,}:?\s*\|?$/.test(s);
  }

  function renderTable(header, aligns, rows) {
    var style = function (idx) {
      return aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '';
    };
    var html = '<table><thead><tr>';
    header.forEach(function (cell, idx) {
      html += '<th' + style(idx) + '>' + inline(cell) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      header.forEach(function (_, idx) {
        html += '<td' + style(idx) + '>' + inline(row[idx] || '') + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  function render(md) {
    var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    var html = '';
    var para = [];
    var start = 0;
    var m;

    // frontmatter: --- ... --- at the very top, hidden behind a <details>
    if (lines.length > 1 && /^---\s*$/.test(lines[0])) {
      for (var f = 1; f < lines.length; f++) {
        if (/^---\s*$/.test(lines[f])) {
          html +=
            '<details class="frontmatter"><summary>frontmatter</summary><pre>' +
            esc(lines.slice(1, f).join('\n')) +
            '</pre></details>';
          start = f + 1;
          break;
        }
      }
    }

    var i = start;

    function flush() {
      if (para.length) {
        html += '<p>' + para.map(inline).join('<br>') + '</p>';
        para = [];
      }
    }

    while (i < lines.length) {
      var line = lines[i];

      // fenced code block
      m = /^\s*```(.*)$/.exec(line);
      if (m) {
        flush();
        var lang = m[1].trim();
        var buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html +=
          '<pre>' +
          (lang ? '<span class="code-lang">' + esc(lang) + '</span>' : '') +
          '<code>' + esc(buf.join('\n')) + '</code></pre>';
        continue;
      }

      if (!line.trim()) {
        flush();
        i++;
        continue;
      }

      // ATX heading
      m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (m) {
        flush();
        var level = m[1].length;
        html += '<h' + level + '>' + inline(m[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flush();
        html += '<hr>';
        i++;
        continue;
      }

      // blockquote
      if (/^\s{0,3}>\s?/.test(line)) {
        flush();
        var quote = [];
        while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
          quote.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
        }
        html += '<blockquote>' + render(quote.join('\n')) + '</blockquote>';
        continue;
      }

      // table: header row followed by a delimiter row
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
        flush();
        var header = splitRow(line);
        var aligns = splitRow(lines[i + 1]).map(function (c) {
          var left = c.charAt(0) === ':';
          var right = c.charAt(c.length - 1) === ':';
          return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
        });
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        html += renderTable(header, aligns, rows);
        continue;
      }

      // list
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        flush();
        var items = [];
        while (i < lines.length) {
          var cur = lines[i];
          var lm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(cur);
          if (lm) {
            var indent = lm[1].replace(/\t/g, '  ').length;
            items.push({
              depth: Math.floor(indent / 2),
              ordered: /^\d/.test(lm[2]),
              text: lm[3],
              line: i,
            });
            i++;
          } else if (cur.trim() && /^\s{2,}/.test(cur) && items.length) {
            // continuation line belongs to the previous item
            items[items.length - 1].text += ' ' + cur.trim();
            i++;
          } else {
            break;
          }
        }
        html += buildList(items);
        continue;
      }

      para.push(line);
      i++;
    }

    flush();
    return html;
  }

  globalThis.renderMarkdown = render;
  globalThis.escapeHtml = esc;
})();

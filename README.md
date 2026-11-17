# MD Vault

โน้ตแอปจิ๋ว: folder tree + ไฟล์ `.md` จริงบนดิสก์ + editor/preview
ไม่มี build step ไม่มี dependency ไม่ต้องติดตั้งอะไร

**Live:** https://zenz9.github.io/md-vault/ — ใช้ได้เลยบน Chrome (desktop / Android 132+)

> **เขียนโดย Buffy (Codebuff) 🤖** — ออกแบบและเขียนโค้ดทั้งหมดนี้ในบทสนทนาเดียว

## วิธีรัน

```bash
cd md-vault
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

หรือ `npx serve .` ก็ได้ — เปิดด้วย `file://` ตรง ๆ มักโดนบล็อก folder picker จึงแนะนำใช้ local server

## ใช้ยังไง

- **Open folder** → เลือกโฟลเดอร์ที่มีไฟล์ `.md` (ไฟล์ข้างในไม่ถูกแตะเลย)
- **จำ vault ล่าสุด** — เปิดครั้งหน้าจะมีแถบ `Last vault: <ชื่อ>` ให้กดต่อได้ทันที (เบราว์เซอร์ต้องขอ permission ใหม่ 1 คลิก เป็นข้อจำกัดของ File System Access API เอง)
- **Search files** ใต้ปุ่ม Open — กรองทั้งชื่อไฟล์และ path, `Esc` เพื่อล้าง
- คลิกไฟล์ใน sidebar เพื่อเปิด → แก้ในช่องซ้าย → autosave หลังหยุดพิมพ์ 0.5 วิ (`Ctrl/Cmd+S` บังคับบันทึกได้)
- **Preview** → แสดงผล Markdown แบบ side-by-side
- **Target folder** — บรรทัด `Target: /...` ใต้ช่องค้นหา บอกว่าไฟล์/โฟลเดอร์ใหม่จะไปอยู่ที่ไหน: คลิกโฟลเดอร์ในต้นไม้เพื่อเปลี่ยน (โฟลเดอร์ที่เลือกจะhighlight), คลิกที่บรรทัด Target เพื่อกลับไป root
- **+ Note** → สร้างไฟล์ `.md` ใหม่ใน target folder แล้วเปิดให้เลย
- **+ Folder** → สร้างโฟลเดอร์ใหม่ใน target folder แล้วตั้งเป็น target ต่อทันที (สร้างซ้อนกันได้เรื่อย ๆ)
- **⋯ ท้ายแถวไฟล์/โฟลเดอร์** → เปิดเมนู *Rename* / *Delete* (หรือกด `Shift+F10` / ปุ่ม Context Menu ตอนโฟกัสแถวนั้น)
  - *Rename* เปลี่ยนชื่อไฟล์/โฟลเดอร์ — ไฟล์ใช้ `move()` ของเบราว์เซอร์, โฟลเดอร์ทำด้วย copy ทั้งต้นไม้แล้วลบของเดิม (ยังไม่มี move สำหรับโฟลเดอร์) จึงใช้เวลาสักครู่ถ้าไฟล์เยอะ
  - *Delete* **ลบออกจากดิสก์ทันที ไม่ลงถังขยะ** — มี `confirm` ถามก่อนเสมอ, ลบโฟลเดอร์ลบทั้งต้นไม้
  - ทั้งสองอย่างจะไม่ทำอะไรถ้าชื่อใหม่ชนกับของที่มีอยู่แล้ว (ขึ้น `already exists`)

> File System Access API ยอมให้สร้างไฟล์/โฟลเดอร์ได้เฉพาะ *ข้างใน* โฟลเดอร์ที่คุณ grant ไว้ครั้งเดียว — เลือกโฟลเดอร์แม่ 1 ครั้ง แล้วสร้างอะไรข้างในได้อิสระโดยไม่ต้องเลือกซ้ำ

## ลิงก์ระหว่างโน้ต

| เขียน | ผล |
|---|---|
| `[[Notes/Inbox]]` | คลิกใน Preview แล้วเปิด `Notes/Inbox.md` (path เริ่มจาก root ของ Vault และตรงตามตัวพิมพ์เล็ก/ใหญ่) |
| `[[Notes/Inbox\|ข้อความ]]` | แสดงข้อความที่กำหนด แต่เปิดโน้ตตาม path เดิม |
| `[[ไม่มีไฟล์]]` | สีแดงเส้นประ + แจ้งเตือนสถานะ |
| `[ข้อความ](sub/other.md)` | ลิงก์ Markdown ปกติก็เปิดในแอป (แก้ relative path ให้แล้ว) |

**autocomplete**: พิมพ์ `[[` แล้วจะขึ้นรายการโน้ตพร้อม path เต็ม — `↑`/`↓` เลือก, `Enter`/`Tab` รับ, `Esc` ปิด

## คีย์ลัดใน editor

| ปุ่ม | ทำอะไร |
|---|---|
| `Enter` | ต่อ list อัตโนมัติ (`- `, `1. `) — Enter บน item ว่าง = เลิก list |
| `Tab` / `Shift+Tab` | เพิ่ม / ลด indent 2 spaces |
| `Ctrl/Cmd+B` / `Ctrl/Cmd+I` | ห่อ selection ด้วย `**` / `*` |
| `Ctrl/Cmd+S` | บันทึกทันที |

## Markdown ที่รองรับ

heading, bold/italic/strikethrough, inline code, fenced code block, link, image, list (nesting ตาม indent), blockquote, hr, paragraph, **table** (มี alignment `:--`/`--:`), **task list** `- [ ]` (กดติ๊กใน Preview แล้วแก้ไฟล์จริง), `[[wikilink]]`, **frontmatter** (ซ่อนใน `<details>`)

**ไม่รองรับ** (ตั้งใจให้เล็กไว้): footnote, raw HTML (ถูก escape เป็นข้อความ), `[[note#heading]]` แบบกระโดดไปหัวข้อ (เปิดโน้ตได้แต่ไม่เลื่อน); Wikilink ต้องระบุ path จาก root ของ Vault, `![[embed]]`, backlink/graph view

## ข้อจำกัด

- เขียนไฟล์ได้เฉพาะ Chromium (Chrome / Edge / Brave) ผ่าน File System Access API
- Firefox / Safari: fallback ไป `<input webkitdirectory>` = อ่านได้แต่บันทึกไม่ได้ (read-only)
- มือถือ Android ใช้ได้ (Chrome 132+) แต่ต้องเสิร์ฟผ่าน HTTPS — ดูหัวข้อถัดไป

## ใช้บนมือถือ (PWA)

**ติดตั้งเป็นแอป**: เปิด https://zenz9.github.io/md-vault/ ด้วย Chrome (Android 132+) → เมนู ⋮ → *Add to Home screen* → เปิดจากไอคอนได้เลย (standalone ไม่มีแถบ address bar) และเปิดได้**แม้ออฟไลน์**หลังเปิดครั้งแรก

บนจอแคบ (≤780px):

- ปุ่ม **☰** มุมซ้ายบน = เปิด/ปิดรายการไฟล์ (drawer) + แตะพื้นหลังเพื่อปิด, `Esc` ก็ปิด
- ปุ่ม **Preview** สลับระหว่าง *เขียน* กับ *อ่าน* แบบเต็มจอ (ไม่ใช่ side-by-side)
- แถวกดใหญ่ขึ้น, editor 16px (กันเบราว์เซอร์ซูมตอนโฟกัส), รองรับ safe-area notch

**ต้องเปิดผ่าน HTTPS** — `http://192.168.x.x:8000` จากมือถือใช้ไม่ได้เพราะไม่ใช่ secure context: ใช้ GitHub Pages / Cloudflare Pages / `tailscale serve` / Caddy + local cert

**iOS / iPadOS ยังใช้ไม่ได้** — Safari ไม่มี `showDirectoryPicker` (vendor position: oppose) → เปิดอ่านได้แต่เลือกโฟลเดอร์ไม่ได้

## ทดสอบ

`markdown.js` มี test ที่ไม่ต้องติดตั้งอะไร (node 18+):

```bash
cd md-vault
node --test
```

ครอบคลุม heading, emphasis/code, การ escape raw HTML, code fence, table alignment, task list (รวม `data-line` ที่ใช้ติ๊กใน Preview), wikilink, frontmatter, list nesting, blockquote/hr และ input ว่าง

## เครดิต

- โค้ดทั้งหมด: **Buffy (Codebuff)** — markdown renderer, tree, autosave, wikilink + autocomplete, search, PWA-ready static app
- ไอเดีย/สเปก/สโคป: เจ้าของโน้ต (ผู้ใช้) — "เอาที่ไม่เกินไปแต่ยังใช้ดี"

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าเว็บ |
| `style.css` | ธีมมืด |
| `markdown.js` | markdown → html (เขียนเอง ไม่มี dependency) |
| `app.js` | tree, อ่าน/เขียนไฟล์, autosave, search, autocomplete, ลิงก์, drawer มือถือ |
| `manifest.json` | PWA manifest (standalone, icons, theme) |
| `service-worker.js` | offline app shell (network-first สำหรับหน้า, stale-while-revalidate สำหรับ asset) |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | ไอคอนแอป (สร้างด้วยสคริปต์ ไม่มี dependency) |
| `tests/markdown.test.js` | test ของ markdown renderer (ไม่ต้องติดตั้ง dependency) |

## ทดสอบ

ใช้ Node.js รันชุดทดสอบ Markdown renderer ได้โดยไม่ต้องติดตั้ง dependency:

```bash
node tests/markdown.test.js
```

ครอบคลุมการ sanitize URL ของ link/image, wikilink, heading, emphasis/code, การ escape raw HTML, code fence, table alignment, task list (รวม `data-line` ที่ใช้ติ๊กใน Preview), frontmatter, list nesting, blockquote/hr และ input ว่าง

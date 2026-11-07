# MD Vault

โน้ตแอปจิ๋ว: folder tree + ไฟล์ `.md` จริงบนดิสก์ + editor/preview
ไม่มี build step ไม่มี dependency ไม่ต้องติดตั้งอะไร

**Live:** https://zenn9.github.io/md-vault/ — ใช้ได้เลยบน Chrome (desktop / Android 132+)

> **เขียนโดย Buffy (Codebuff) 🤖** — ออกแบบและเขียนโค้ดทั้งหมดนี้ในบทสนทนาเดียว

## วิธีรัน

```bash
cd Coding/md-vault
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
- **+** → สร้างโน้ตใหม่ในโฟลเดอร์เดียวกับไฟล์ที่เปิดอยู่

## ลิงก์ระหว่างโน้ต

| เขียน | ผล |
|---|---|
| `[[ชื่อโน้ต]]` | คลิกใน Preview แล้วเปิดโน้ตนั้น (จับคู่ด้วยชื่อไฟล์ ไม่สนตัวพิมพ์/โฟลเดอร์) |
| `[[ชื่อโน้ต\|ข้อความ]]` | แสดงข้อความที่กำหนด แต่เปิดโน้ตเดียวกัน |
| `[[ไม่มีไฟล์]]` | สีแดงเส้นประ + แจ้งเตือนสถานะ |
| `[ข้อความ](sub/other.md)` | ลิงก์ Markdown ปกติก็เปิดในแอป (แก้ relative path ให้แล้ว) |

**autocomplete**: พิมพ์ `[[` แล้วจะขึ้นรายการโน้ต — `↑`/`↓` เลือก, `Enter`/`Tab` รับ, `Esc` ปิด

## คีย์ลัดใน editor

| ปุ่ม | ทำอะไร |
|---|---|
| `Enter` | ต่อ list อัตโนมัติ (`- `, `1. `) — Enter บน item ว่าง = เลิก list |
| `Tab` / `Shift+Tab` | เพิ่ม / ลด indent 2 spaces |
| `Ctrl/Cmd+B` / `Ctrl/Cmd+I` | ห่อ selection ด้วย `**` / `*` |
| `Ctrl/Cmd+S` | บันทึกทันที |

## Markdown ที่รองรับ

heading, bold/italic/strikethrough, inline code, fenced code block, link, image, list (nesting ตาม indent), blockquote, hr, paragraph, **table** (มี alignment `:--`/`--:`), **task list** `- [ ]` (กดติ๊กใน Preview แล้วแก้ไฟล์จริง), `[[wikilink]]`, **frontmatter** (ซ่อนใน `<details>`)

**ไม่รองรับ** (ตั้งใจให้เล็กไว้): footnote, raw HTML (ถูก escape เป็นข้อความ), `[[note#heading]]` แบบกระโดดไปหัวข้อ (เปิดโน้ตได้แต่ไม่เลื่อน), `![[embed]]`, backlink/graph view

## ข้อจำกัด

- เขียนไฟล์ได้เฉพาะ Chromium (Chrome / Edge / Brave) ผ่าน File System Access API
- Firefox / Safari: fallback ไป `<input webkitdirectory>` = อ่านได้แต่บันทึกไม่ได้ (read-only)
-มือถือ Android ใช้ได้ (Chrome 132+) แต่ต้องเสิร์ฟผ่าน HTTPS — ดูหัวข้อถัดไป

## ใช้บนมือถือ

File System Access API รองรับบน **Chrome Android 132+**, Samsung Internet 29+ และ Android WebView 132+ (ตั้งแต่ ม.ค. 2025) → แอปนี้ใช้บน Android ได้เลย **โดยไม่ต้องแก้โค้ดแอป** แต่มีเงื่อนไข:

1. ต้องเปิดผ่าน **HTTPS** (secure context) — `http://192.168.x.x:8000` จากมือถือ **ใช้ไม่ได้** ต้องเป็น https
2. **iOS / iPadOS ยังไม่รองรับ** — Safari ไม่มี `showDirectoryPicker` (vendor position: oppose) → ได้แค่โหมดอ่าน

วิธีเสิร์ฟให้มือถือใช้ได้: Cloudflare Pages / GitHub Pages / Netlify (แค่ 4 ไฟล์ static), `tailscale serve`, หรือ Caddy + local cert

## เครดิต

- โค้ดทั้งหมด: **Buffy (Codebuff)** — markdown renderer, tree, autosave, wikilink + autocomplete, search, PWA-ready static app
- ไอเดีย/สเปก/สโคป: เจ้าของโน้ต (ผู้ใช้) — "เอาที่ไม่เกินไปแต่ยังใช้ดี"

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าเว็บ |
| `style.css` | ธีมมืด |
| `markdown.js` | markdown → html (เขียนเอง ไม่มี dependency) |
| `app.js` | tree, อ่าน/เขียนไฟล์, autosave, search, autocomplete, ลิงก์ |

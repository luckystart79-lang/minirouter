---
name: telegram-bridge
description: Send files, screenshots, web page captures, run system commands, and notify the user via Telegram. Use when the user asks you to send a file, take a screenshot, capture a web page, run a shell command outside your sandbox, execute Python, or send a notification/message to them on Telegram. ALWAYS use this bridge to deliver results back to the user.
---

# Telegram Bridge API

## CRITICAL RULE
**The user is controlling you remotely via Telegram. They CANNOT see your terminal output.**
**You MUST use this bridge API to send ALL results (files, images, text) back to the user.**
**After creating, finding, or generating ANY file, you MUST call `/api/send-file` to deliver it.**
**Never just save a file locally and tell the user where it is — they can't access your filesystem!**

The bridge runs at `http://127.0.0.1:3847`.

## When to use (MANDATORY)

| User says... | You MUST do |
|---|---|
| "chụp hình / screenshot" | Take screenshot → call `/api/send-file` or `/api/screenshot` |
| "gửi file X cho tao" | Call `/api/send-file` with the path |
| "xem giao diện / check UI" | Call `/api/web-screenshot` with the URL |
| "chạy lệnh X" | Call `/api/run-command` |
| "chạy python" | Call `/api/run-python` |
| Any result the user needs to see | Call `/api/notify` or `/api/send-file` |

## Workflow example

User: "chụp trang PO cho tao xem"

Step 1: Take screenshot (however you can)
Step 2: **IMMEDIATELY** send it to Telegram:
```bash
curl -s -X POST http://127.0.0.1:3847/api/send-file \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"C:\\\\path\\\\to\\\\screenshot.png\", \"caption\": \"PO page screenshot\"}"
```

If you have a URL instead of a local file:
```bash
curl -s -X POST http://127.0.0.1:3847/api/web-screenshot \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"http://localhost:3000/po\", \"caption\": \"PO page\"}"
```

## Endpoints

### Send a file to the user (images, documents, anything)
```bash
curl -s -X POST http://127.0.0.1:3847/api/send-file \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"C:\\\\path\\\\to\\\\file.png\", \"caption\": \"Description\"}"
```

### Screenshot the desktop
```bash
curl -s -X POST http://127.0.0.1:3847/api/screenshot \
  -H "Content-Type: application/json" \
  -d "{\"caption\": \"Current desktop\"}"
```

### Screenshot a web page (auto opens browser, captures, sends)
```bash
curl -s -X POST http://127.0.0.1:3847/api/web-screenshot \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"http://localhost:3000\", \"width\": 1280, \"height\": 800, \"caption\": \"Homepage\"}"
```

### Run a shell command
```bash
curl -s -X POST http://127.0.0.1:3847/api/run-command \
  -H "Content-Type: application/json" \
  -d "{\"command\": \"dir C:\\\\Users\", \"cwd\": \"C:\\\\\", \"silent\": false}"
```
Set `"silent": true` to get output in response only (not sent to Telegram).

### Run Python code
```bash
curl -s -X POST http://127.0.0.1:3847/api/run-python \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"import os; print(os.listdir('.'))\", \"cwd\": \"C:\\\\project\"}"
```

### Send a notification/message
```bash
curl -s -X POST http://127.0.0.1:3847/api/notify \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"✅ Task completed successfully!\"}"
```

### Send text as downloadable file
```bash
curl -s -X POST http://127.0.0.1:3847/api/send-text \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"line1\\nline2\", \"filename\": \"report.txt\"}"
```

## Response format
Success: `{"ok": true, "message": "File sent to Telegram"}`
Error: `{"error": "File not found"}`

## REMEMBER
- **ALWAYS send results to Telegram** — the user cannot see your local files
- Use double backslashes in JSON paths: `C:\\\\Users\\\\file.txt`
- Max file size: 50MB
- Web screenshots use Chrome/Edge headless
- After ANY file operation, call `/api/send-file` to deliver it

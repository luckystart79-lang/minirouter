# 🚀 Remote Agent — Lộ trình phát triển

> **Mục tiêu**: Nâng cấp agent.js từ một script Telegram bot đơn giản thành một AI Agent framework chuyên nghiệp, có kiến trúc plugin, hỗ trợ multi-device, và khả năng tự động hóa cao.

---

## 🟢 Mức 1 — Quick Wins (ưu tiên cao nhất)

### 1.1 Auto-reconnect thông minh
- **Trạng thái**: ✅ DONE
- Exponential backoff khi mất kết nối Telegram
- Health ping định kỳ để phát hiện kết nối chết sớm
- Tự reconnect chủ động thay vì chờ lỗi polling

### 1.2 Streaming output cho task dài
- **Trạng thái**: ✅ DONE
- Stream từng chunk output lên Telegram (edit message liên tục)
- Hiển thị real-time trên điện thoại, không phải đợi task chạy xong
- Throttle edit message để không bị rate-limit Telegram API

### 1.3 File upload từ Telegram → PC
- **Trạng thái**: ✅ DONE
- Gửi file (ảnh, .py, .json, .zip...) vào Telegram → bot tải xuống workspace hiện tại
- Hỗ trợ cả document và photo
- Thông báo đường dẫn file đã lưu sau khi download xong

### 1.4 Multi-session (chạy song song)
- **Trạng thái**: ✅ DONE
- Hàng đợi task với ID riêng biệt
- Cho phép chạy song song 2-3 task cùng lúc
- `/stop <id>` để hủy task cụ thể
- `/tasks` để xem danh sách task đang chạy

---

## 🟡 Mức 2 — Chuyên nghiệp hóa

### 2.1 Skill System (Plugin Architecture)
- **Trạng thái**: ✅ DONE
- Tách chức năng thành các skill độc lập trong thư mục `skills/`
- Mỗi skill tự đăng ký command + help text
- Thêm chức năng mới = tạo file skill mới, không sửa agent.js
- Cấu trúc:
  ```
  skills/
    screenshot.js      — /screen, /web
    file-manager.js    — /file, /get, /ls, /cat
    shell-runner.js    — /run, /py
    ai-cli.js          — gemini/codex/claude bridge
    crawler.js         — /crawl <url>
  ```

### 2.2 Conversation Memory (Context)
- **Trạng thái**: ✅ DONE
- Lưu lịch sử hội thoại vào SQLite/JSON
- Truy xuất lại kết quả lệnh trước đó
- Tìm kiếm trong lịch sử: `/history search <keyword>`

### 2.3 Scheduled Tasks (Cron)
- **Trạng thái**: ✅ DONE
- `/schedule "npm test" every 30m` — chạy lệnh theo lịch
- `/schedule list` — xem danh sách schedule
- `/schedule remove <id>` — xóa schedule
- Gửi kết quả lên Telegram sau mỗi lần chạy

### 2.4 Web Dashboard mini
- **Trạng thái**: ✅ DONE
- Host trang web trên Bridge API (`localhost:3847`)
- Hiển thị: lịch sử lệnh, task đang chạy, log real-time (WebSocket)
- Nút bấm UI thay vì gõ lệnh

---

## 🔴 Mức 3 — Đẳng cấp (dự án dài hơi)

### 3.1 Multi-device Agent Network
- **Trạng thái**: 📋 TODO
- Cài agent trên nhiều máy, cùng 1 bot Telegram điều khiển
- Prefix chọn máy: `/home run ...`, `/vps run ...`
- Các máy tự đăng ký qua Bridge API trung tâm
- Heartbeat + online/offline status

### 3.2 AI Autonomous Mode
- **Trạng thái**: 📋 TODO
- `/auto <mục tiêu>` — mô tả mục tiêu, bot tự lập kế hoạch
- Chạy từng bước, tự kiểm tra lỗi và retry
- Gửi báo cáo tiến độ theo giai đoạn
- Có thể dừng/can thiệp giữa chừng

### 3.3 OAuth + Multi-user
- **Trạng thái**: 📋 TODO
- Nhiều người dùng (team) cùng sử dụng bot
- Mỗi người có workspace + permission riêng
- Admin full quyền, member chỉ được phép trong scope được gán

---

## 📊 Tổng kết tiến độ

| Mức | Feature | Trạng thái |
|-----|---------|-----------|
| 🟢 1 | 1.1 Auto-reconnect thông minh | ✅ DONE |
| 🟢 1 | 1.2 Streaming output | ✅ DONE |
| 🟢 1 | 1.3 File upload Telegram → PC | ✅ DONE |
| 🟢 1 | 1.4 Multi-session | ✅ DONE |
| 🟡 2 | 2.1 Skill System | ✅ DONE |
| 🟡 2 | 2.2 Conversation Memory | ✅ DONE |
| 🟡 2 | 2.3 Scheduled Tasks | ✅ DONE |
| 🟡 2 | 2.4 Web Dashboard mini | ✅ DONE |
| 🔴 3 | 3.1 Multi-device Network | 📋 TODO |
| 🔴 3 | 3.2 AI Autonomous Mode | 📋 TODO |
| 🔴 3 | 3.3 OAuth + Multi-user | 📋 TODO |

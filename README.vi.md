# Zest

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="screenshots/menu_bar_dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="screenshots/menu_bar.png" />
    <img alt="Zest Banner" src="screenshots/menu_bar.png" height="600" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg?style=flat" alt="Platform macOS" />
  <img src="https://img.shields.io/badge/language-Swift-orange.svg?style=flat" alt="Language Swift" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" alt="License MIT" />
  <img src="https://img.shields.io/badge/version-0.1.0%20beta-green.svg?style=flat" alt="Version" />
  <a href="README.md"><img src="https://img.shields.io/badge/lang-Português-green.svg?style=flat" alt="Portuguese" /></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/lang-English-blue.svg?style=flat" alt="English" /></a>
  <a href="README.zh.md"><img src="https://img.shields.io/badge/lang-zh--CN-green.svg?style=flat" alt="Chinese" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/lang-Français-blue.svg?style=flat" alt="French" /></a>
</p>

<p align="center">
  <strong>Trung tâm điều khiển cho các trợ lý lập trình AI trên macOS.</strong>
</p>

Zest là ứng dụng macOS để quản lý **CLIProxyAPI** - máy chủ proxy cục bộ cung cấp sức mạnh cho các agent lập trình AI. Zest giúp bạn quản lý nhiều tài khoản AI, theo dõi hạn mức sử dụng và cấu hình các công cụ CLI tại một nơi.

> Dự án này là bản fork được chỉnh sửa từ [Quotio](https://github.com/nguyenphutrong/quotio) gốc.

## Tính năng

- **Hỗ trợ Đa nhà cung cấp**: Kết nối tài khoản từ Gemini, Claude, OpenAI Codex, Qwen, Vertex AI, iFlow, Antigravity, Kiro, Trae, và GitHub Copilot qua OAuth hoặc API key.
- **Chế độ Quota độc lập**: Xem quota và tài khoản mà không cần chạy proxy server - hoàn hảo để kiểm tra nhanh.
- **Cấu hình Agent Một chạm**: Tự động phát hiện và cấu hình các công cụ như Claude Code, OpenCode, Gemini CLI.
- **Dashboard Thời gian thực**: Giám sát lưu lượng, token sử dụng và tỷ lệ thành công.
- **Quản lý Hạn mức**: Theo dõi quota từng tài khoản với chiến lược chuyển đổi tự động (Round Robin / Fill First).
- **Quản lý API Key**: Tạo và quản lý các khóa API cho proxy.
- **Menu Bar**: Truy cập nhanh trạng thái, tổng quan quota và biểu tượng provider tùy chỉnh từ thanh menu.
- **Thông báo**: Cảnh báo khi hạn mức thấp, tài khoản đang nghỉ, hoặc lỗi dịch vụ.
- **Tự động Cập nhật**: Tích hợp Sparkle updater để cập nhật liền mạch.
- **Đa ngôn ngữ**: Hỗ trợ tiếng Anh, tiếng Bồ Đào Nha-BR, tiếng Việt, tiếng Pháp và tiếng Trung giản thể.

## Hệ sinh thái hỗ trợ

### Nhà cung cấp AI
| Provider | Phương thức xác thực |
|----------|----------------------|
| Google Gemini | OAuth |
| Anthropic Claude | OAuth |
| OpenAI Codex | OAuth |
| Qwen Code | OAuth |
| Vertex AI | Service Account JSON |
| iFlow | OAuth |
| Antigravity | OAuth |
| Kiro | OAuth |
| GitHub Copilot | OAuth |

### Theo dõi Quota IDE (Chỉ giám sát)
| IDE | Mô tả |
|-----|-------|
| Cursor | Tự động phát hiện khi cài đặt và đăng nhập |
| Trae | Tự động phát hiện khi cài đặt và đăng nhập |

> **Lưu ý**: Các IDE này chỉ dùng để theo dõi quota. Không thể sử dụng làm provider cho proxy.

### Agent tương thích
Zest có thể tự động cấu hình các công cụ sau:
- Claude Code
- Codex CLI
- Gemini CLI
- Amp CLI
- OpenCode
- Factory Droid

## Cài đặt

### Yêu cầu
- macOS 15.0 (Sequoia) trở lên
- Kết nối internet để xác thực OAuth

### Build từ source

1. **Clone repo:**
   ```bash
   git clone https://github.com/heliab125/zest.git
   cd zest
   ```

2. **Mở trong Xcode:**
   ```bash
   open Quotio.xcodeproj
   ```

3. **Build và chạy:**
   - Chọn scheme "Quotio"
   - Nhấn `Cmd + R`

> Ứng dụng sẽ tự động tải binary `CLIProxyAPI` trong lần chạy đầu tiên.

## Hướng dẫn sử dụng

### 1. Khởi động Server
Mở Zest và nhấn **Start** trên dashboard để khởi động proxy server.

### 2. Kết nối Tài khoản
Vào tab **Providers** → Chọn provider → Xác thực qua OAuth hoặc import credentials.

### 3. Cấu hình Agent
Vào tab **Agents** → Chọn agent đã cài → Nhấn **Configure** → Chọn Automatic hoặc Manual.

### 4. Giám sát
- **Dashboard**: Tình trạng chung và lưu lượng
- **Quota**: Chi tiết sử dụng từng tài khoản
- **Logs**: Nhật ký request/response để debug

## Cài đặt

- **Port**: Đổi cổng proxy
- **Chiến lược định tuyến**: Round Robin hoặc Fill First
- **Auto-start**: Tự động khởi động proxy khi mở app
- **Notifications**: Bật/tắt thông báo

## Hình ảnh

### Bảng điều khiển
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/dashboard_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/dashboard.png" />
  <img alt="Bảng điều khiển" src="screenshots/dashboard.png" />
</picture>

### Nhà cung cấp
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/provider_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/provider.png" />
  <img alt="Nhà cung cấp" src="screenshots/provider.png" />
</picture>

### Cài đặt Agent
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/agent_setup_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/agent_setup.png" />
  <img alt="Cài đặt Agent" src="screenshots/agent_setup.png" />
</picture>

### Giám sát Hạn mức
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/quota_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/quota.png" />
  <img alt="Giám sát Hạn mức" src="screenshots/quota.png" />
</picture>

## Đóng góp

1. Fork dự án
2. Tạo nhánh (`git checkout -b feature/tinh-nang-moi`)
3. Commit (`git commit -m 'Thêm tính năng mới'`)
4. Push (`git push origin feature/tinh-nang-moi`)
5. Mở Pull Request

## Ghi công

Dự án này là bản fork được chỉnh sửa từ [Quotio](https://github.com/nguyenphutrong/quotio) gốc, được tạo bởi [nguyenphutrong](https://github.com/nguyenphutrong).

**Chỉnh sửa bởi:** [heliab125](https://github.com/heliab125)

## Giấy phép

MIT License. Xem file `LICENSE` để biết thêm.

# MS To-do Sync Demo

Demo ứng dụng đồng bộ Microsoft To Do sử dụng Microsoft Graph API, xây dựng với React + TypeScript + Vite.

## Tính năng

- Đăng nhập bằng tài khoản Microsoft (MSAL v5 popup flow)
- Xem danh sách task lists và tasks từ Microsoft To Do
- Đồng bộ real-time với delta sync (chỉ fetch thay đổi)
- Tạo, chỉnh sửa, hoàn thành, xoá task
- Xem raw task data (JSON) trực tiếp trên UI

## Yêu cầu

- Node.js >= 18
- Tài khoản Microsoft (cá nhân hoặc work/school)
- Azure App Registration với quyền `Tasks.ReadWrite` (Microsoft Graph)

## Cài đặt & Chạy

### 1. Clone repo

```bash
git clone git@github.com:kiendd/MS-To-do-Sync-Demo.git
cd MS-To-do-Sync-Demo
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Cấu hình biến môi trường

Tạo file `.env.local` ở thư mục gốc:

```env
VITE_MSAL_CLIENT_ID=<Azure App Client ID>
```

Để lấy Client ID:
1. Vào [Azure Portal](https://portal.azure.com) → **App registrations** → New registration
2. Redirect URI: `http://localhost:5173` (type: **Single-page application**)
3. API permissions: thêm `Tasks.ReadWrite` (Microsoft Graph, Delegated)
4. Copy **Application (client) ID** vào `.env.local`

### 4. Chạy dev server

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev server (HMR) |
| `npm run build` | Build production |
| `npm run preview` | Preview bản build |
| `npm run lint` | Kiểm tra lint |

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **MSAL Browser v5** — Microsoft authentication
- **TanStack Query v5** — server state & caching
- **Zustand** — client state (delta links, sync status)
- **Tailwind CSS v4** + **shadcn/ui**
- **Sonner** — toast notifications

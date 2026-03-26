# MS To-do Sync Demo

## What This Is

Web app quản lý task dạng to-do tích hợp hai chiều với Microsoft To-do. Người dùng đăng nhập bằng tài khoản Microsoft, quản lý task trực tiếp trên app, và mọi thay đổi đều được đồng bộ real-time với Microsoft To-do — bao gồm cả task được tạo từ việc flag email trong Outlook.

## Core Value

Sync hai chiều hoạt động đúng: thay đổi ở app hoặc MS To-do đều phản ánh tức thì ở cả hai phía.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Đăng nhập bằng Microsoft account qua OAuth2 (Microsoft Identity Platform)
- [ ] Hiển thị và quản lý danh sách task theo List (giống cấu trúc MS To-do)
- [ ] CRUD tasks: tạo, sửa, xóa, đánh dấu hoàn thành
- [ ] Sync hai chiều với Microsoft To-do qua Microsoft Graph API
- [ ] Hiển thị task từ Outlook flagged emails gộp chung vào danh sách task thường
- [ ] UI web responsive, có thể dùng thật hàng ngày

### Out of Scope

- Mobile app native — demo dưới dạng web app là đủ
- Due date / nhắc nhở (notifications) — không được chọn, có thể bổ sung sau
- Multi-user / chia sẻ task — đây là app cá nhân
- Offline mode — cần kết nối để sync

## Context

- Sử dụng **Microsoft Graph API** để tương tác với MS To-do (endpoint `/me/todo/lists` và `/me/todo/lists/{id}/tasks`)
- Flagged emails từ Outlook tạo ra tasks trong list "Flagged Email" đặc biệt trên MS To-do — cần xử lý list này giống như list thường
- OAuth2 flow: Authorization Code với PKCE (phù hợp cho SPA/web app không có backend bí mật)
- Cần đăng ký Azure AD App để lấy client_id và cấu hình redirect URI

## Constraints

- **API**: Microsoft Graph API — bắt buộc dùng để truy cập MS To-do
- **Auth**: OAuth2 Authorization Code + PKCE — không dùng client secret trong browser
- **Scope**: Prototype có thể dùng thật, không cần production-grade (không cần CI/CD, monitoring...)
- **Demo**: Cần chạy được trên local, không bắt buộc deploy lên cloud

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-way sync thay vì one-way | Người dùng muốn dùng cả app lẫn MS To-do trực tiếp | — Pending |
| OAuth2 PKCE cho web app | Không có backend server riêng, PKCE an toàn cho SPA | — Pending |
| Flagged emails gộp vào task thường | Đơn giản hóa UX, không cần UI riêng cho email tasks | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after initialization*

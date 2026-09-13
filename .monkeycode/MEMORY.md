# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Entries

[Project Knowledge Summary]
- Date: 2026-09-12
- Context: Agent 为用户搭建 dostime 个人日记站时发现
- Category: Operations & Deployment
- Instructions:
  - 用户在 Cloudflare 有旧站点 dosday.pages.dev（用户提及的地址，未经本人确认），另有 R2 桶 dosfox-dpdns-org、email、mail2、microfeed 等资源，操作时不得触碰这些既有资源
  - 主站点：dostime.pages.dev（Cloudflare Pages 经典版项目），管理后台 /admin.html，管理密码已交付用户（如遗忘可通过 wrangler pages secret put ADMIN_PASSWORD 重置）
  - 架构：Pages + Functions，D1 数据库 dostime-db（id: 8ede6c54-b380-4f39-a920-5e284cb7b522，posts 表），R2 桶 dostime-images（图片经 /api/images/[key] 函数代理访问），邮件通知走 Resend（免费版发件人 onboarding@resend.dev，只能发给注册邮箱 yarnshow@qq.com）
  - 部署方式：wrangler pages deploy（工作目录 /workspace，配置在 wrangler.toml）；wrangler 4.x 首次创建经典 Pages 项目必须加 --force 绕过对 Workers 的 delegation，项目已存在后无需 --force
  - 部署分支必须是 main（项目 production-branch 为 main）
  - Secrets：ADMIN_PASSWORD、RESEND_API_KEY、NOTIFY_EMAIL（均为 Pages secret，不进代码库）
  - 本沙箱无法直接访问 *.pages.dev 站点（出网白名单限制，api.cloudflare.com 和 api.github.com 可通），验证站点需用 check-host.net 拨测 API
  - 本沙箱 git 凭据助手对 github.com 不可用（返回 500），推送 GitHub 需用户提供 Personal Access Token

[Project Knowledge Summary]
- Date: 2026-09-12
- Context: 用户提供的敏感凭据使用约定
- Category: Environment Configuration
- Instructions:
  - 会话级凭据统一存放在 /tmp/opencode/dostime.env（不进 git、不进工作区），使用前 source

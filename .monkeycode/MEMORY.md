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
  - 架构：Pages + Functions，D1 数据库 dostime-db（id: 8ede6c54-b380-4f39-a920-5e284cb7b522，posts/scheduled_emails/tasks 三表），R2 桶 dostime-images（图片经 /api/images/[key] 函数代理访问），邮件通知走 Resend（免费版发件人 onboarding@resend.dev，只能发给注册邮箱 yarnshow@qq.com）
  - 定时引擎：独立 Worker dostime-cron（cron-worker/ 目录，wrangler deploy 部署，workers.dev 域名 dostime-cron.doswowo.workers.dev），cron 每 5 分钟扫描 scheduled_emails 到期项与 tasks 过期项发邮件；secrets 为 RESEND_API_KEY/NOTIFY_EMAIL/CRON_SECRET；手动触发 GET /run 带 X-Cron-Key 头（密钥存 /tmp/opencode/cron_secret.txt，会话级临时）
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

[Project Knowledge Summary]
- Date: 2026-09-13
- Context: 邮件双通道改造（CF Email Routing 主通道 + Resend 兜底）上线验证通过时发现
- Category: Operations & Deployment
- Instructions:
  - 邮件架构：CF Email Routing 为主（发件人 noreply@dosday.dpdns.org），Resend 自动降级兜底；dosday.dpdns.org zone 的 Email Routing 已开启（status=ready，MX/DKIM/SPF 自动配置），勿在 Dashboard 关闭
  - 关键坑：wrangler.toml 中 send_email=[{name="SEND_EMAIL"}] 必须放在任何 [[section]] 之前的顶层位置，写在 [[d1_databases]] 段之后会被 TOML 解析吞掉、绑定静默失效（部署不报错但发信必败），排查手段是查 Worker settings 的 bindings 列表
  - Worker /notify 端点：日记发表即时通知由 Pages Functions 调 Worker 的 POST /notify（X-Cron-Key 头鉴权）；GET /test?key= 是邮件通道测试端点，结果（via/cfError）写入 D1 表 mail_channel_log
  - CF send_email 的收件人必须是账户内已验证的 destination address（当前 yarnshow@qq.com 已验证）；换收件邮箱需先在 Email Routing → Destination addresses 验证
  - 用户 Global API Key（配 doswowo@gmail.com）曾用于本次配置，会话后建议用户在 Dashboard Roll/撤销；凭据存 /tmp/opencode/cf_global.env

[Project Knowledge Summary]
- Date: 2026-09-13
- Context: 执行"删除旧 dosday、域名交给 dostime"迁移任务时发现
- Category: Operations & Deployment
- Instructions:
  - 现主站为 Cloudflare Pages 项目 dosday（代码=dostime 仓库），域名 dosday.pages.dev 与自定义域 dosday.dpdns.org 同站；管理后台 /admin.html，密码 123456abs
  - 旧 dosday 项目（Supabase SPA，Vite+PWA）已于 2026-09-13 删除；其数据源是 Supabase 项目 lfnxuqcvuvheyhdbzclq.supabase.co（notes/scheduled_emails/recurring_tasks 表，RLS 保护），22 条日记已迁入 D1 posts（title 全空→存''，时间转北京时间格式），2 条测试定时邮件迁入但 enabled=0，1 条测试任务迁入 completed=1；Supabase 云端数据未删除，用户可自行关闭该项目
  - 迁移踩坑：删 Pages 项目前必须先删自定义域（否则 8000028 报错）；wrangler 4.131 直接 pages deploy 不再自动建项目，需先 wrangler pages project create
  - dostime Pages 项目已于 2026-09-13 按用户要求删除（dostime.pages.dev 已释放）；唯一日记站为 dosday 项目，两个域名同站
  - dosday.dpdns.org zone 的 Email Routing（MX/DKIM/SPF）独立于 Pages 项目，删项目不受影响；zone 内 CNAME dosday.dpdns.org→dosday.pages.dev 与 MX 共存正常
  - 沙箱可访问 dosday.dpdns.org（第三方域名，未被出网白名单挡），验证站点可直接 curl 该域；*.pages.dev/*.workers.dev 仍被挡
  - Pages secrets（新项目 dosday 已配齐）：ADMIN_PASSWORD、NOTIFY_EMAIL、RESEND_API_KEY、CRON_SECRET

[Project Knowledge Summary]
- Date: 2026-09-14
- Context: 任务提醒功能重做上线验证时发现
- Category: Operations & Deployment
- Instructions:
  - tasks 表新模型：title + cycle_days(1-3650) + next_date（监测日，到达或超期每天发）+ remind_time_1/2（每天两时段，各发一封）+ enabled + last_slot1/2_date（当天去重标记）；完成本期=complete_date 今天、next_date=今天+cycle_days、清空 last_slot
  - 部署 token：旧 cfut_ token 已失效（Authorization header 格式错误），新建 token 存 /tmp/opencode/deploy_token.env（Workers Scripts/D1/Pages Routes/Memberships/User Details 权限，2027-09-13 到期）；wrangler 非交互必须用 CLOUDFLARE_API_TOKEN，Global Key 只能走 curl REST
  - wrangler pages deploy 必须显式加 --project-name dosday --branch main --commit-dirty=true，否则非交互环境下报错或进项目选择
  - Worker /run 除 X-Cron-Key 头外也支持 ?key= query 参数；Pages 新增登录保护代理 GET /api/cron-run（fetch worker /run 透传结果），沙箱调它即可观察 cron 逻辑返回（emails/tasks 计数）
  - 时间换算教训：北京时间=UTC+8，date -u 显示的是 UTC，设计"几分钟后"测试时段时先加 8 小时；D1 datetime('now','localtime') 存的是 UTC
  - /tmp/opencode/gh.env 的 GH_PAT 值尾部带 \"，提取后需 tr -d '"\\' 再用
  - GitHub 已推送 b2beb41；Git 自动部署开启（push 即上线），手动部署与自动部署并存

[Project Knowledge Summary]
- Date: 2026-09-14
- Context: 任务完成日期模型 + 定时邮件双周期上线时发现
- Category: Operations & Deployment
- Instructions:
  - tasks 表字段：complete_date 可编辑（用户完成时更新），next_date 服务端自动算（=complete_date+cycle_days，不收外部输入），remind_time_1 必填/remind_time_2 选填（留空=每天一次）
  - scheduled_emails 双周期：新增 frequency2/weekday2/monthday2/month2/send_time2/next_send_at2 列，周期2 选填、独立计时独立顺延；worker processScheduledEmails 两组分别判断发送；前端 scSyncFields 同步两组显隐、sc-time2 无周期2时 disabled
  - 全站时间已统一北京时间：D1 四表 created_at 默认值 datetime('now','+8 hours')；API INSERT 显式传 bjNowStr()；scheduled_emails 的 next_send_at(2) 保持 UTC ISO 供调度对比，前端展示用 toLocaleString Asia/Shanghai 转 BJ
  - 用户偏好：表单预览直接显示结果（如「下次任务时间：2026-10-12 08:00 / 20:00」），不要显示公式说明文字

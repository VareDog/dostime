# Dostime · 时光手记

个人日记网站，部署在 Cloudflare Pages（免费套餐），支持在线写日记、上传图片、发表后自动将图文发送到指定邮箱。

- 网站：https://dosday.dpdns.org
- 管理后台：https://dosday.dpdns.org/admin.html
- 代码仓库：https://github.com/VareDog/dostime

## 更新记录

### 2026-09-14

- **任务提醒重做**：任务模型改为「任务内容 + 周期天数（任意 1-3650 天）+ 下次日期 + 每天两个提醒时段」；监测下次日期，到达或超过后每天按时段各发一封提醒邮件（当天同时段只发一次），点「完成本期」后自动顺延一个周期（下次日期 = 今天 + 周期天数）
- **任务后台改版**：后台任务页签支持新建（时段1 默认 08:00、时段2 默认 20:00）、编辑回显、完成本期（显示顺延结果）、停用/启用、删除；列表显示周期、下次日期、两个时段与状态（监测中 / 今天到期 / 已超期 N 天 / 已停用）

### 2026-09-13

- **站点迁移完成**：旧 dostime 项目与旧 dosday 项目（Supabase 版）均已删除，统一为 dosday 项目；域名 dosday.pages.dev 与 dosday.dpdns.org 指向同一站点
- **数据迁移**：旧 Supabase 数据库中的 22 条日记全量迁入 Cloudflare D1（原时间戳转换为北京时间保留）；迁移前旧日记在 dostime.pages.dev 时代的 3 条一并保留，共 25 条
- **邮件通道升级**：启用 Cloudflare Email Routing 为主发信通道（发件人 DosDay <noreply@dosday.dpdns.org>），Resend 降级为自动兜底；发件显示名与主题前缀统一为 DosDay
- **邮件图片内嵌**：日记通知邮件中的图片改为直接嵌入邮件本体（CID 方式），解决 QQ 邮箱对新域名外链图片的过滤问题
- **修复日记详情页**：Pages 将 /post.html 规范化为 /post 导致详情页一直“加载中”，已修复
- **修复上传报错不显眼**：登录失效时上传图片会明确提示“登录已失效，请刷新页面重新登录”
- **启用 Git 自动部署**：Cloudflare 连接 GitHub 仓库（VareDog/dostime main 分支），每次推送代码自动构建上线；手动部署方式保留兼容
- **新增评论功能**：日记详情页支持访客评论（姓名 + 内容），数据存 D1 新表 comments
- **页面品牌统一**：页面标题、logo、页脚全部改为 DosDay
- **新增评论通知**：有新评论时自动把日记内容、评论人（姓名/电话/时间/内容）发到你的邮箱；新增评论电话字段
- **评论通知修复**：Pages Functions 的 waitUntil 异步发送被静默吞掉导致收不到邮件，改为同步等待并回传发送结果
- **日记更新通知**：编辑保存日记同样发送邮件（主题【DosDay】日记更新：xxx），修正保存时误报"邮件发送失败：未知原因"


## 架构

| 组件 | 服务 | 用途 |
|------|------|------|
| 前端页面 | Cloudflare Pages | 日记列表 / 详情 / 管理后台 |
| 后端接口 | Pages Functions（`functions/` 目录） | 日记增删改查、图片上传、登录认证、定时邮件与任务管理 |
| 数据库 | D1 `dostime-db` | posts（日记）、scheduled_emails（定时邮件）、tasks（任务） |
| 图片存储 | R2 `dostime-images` | 存上传的图片，经 `/api/images/[key]` 访问 |
| 邮件通知 | Cloudflare Email Routing（主）+ Resend（兜底） | 日记通知、定时邮件、任务提醒；发件人 noreply@dosday.dpdns.org，CF 通道失败时自动降级 Resend |
| 定时引擎 | Worker `dostime-cron` | 每 5 分钟检查到期定时邮件和过期任务并自动发邮件 |

## 三大功能

1. **日记**：标题可不填，只写内容即可；支持图片；发表后完整图文自动发到你的邮箱
2. **定时邮件**（后台"定时邮件"页签）：预设邮件内容，按 每天 / 每周（选周几）/ 每月（选几号）/ 每年（选月日）+ 指定时刻（北京时间）自动发送；可随时停用 / 启用 / 删除
3. **任务提醒**（后台"任务提醒"页签）：任务设截止日期和周期（单次 / 每天 / 每周 / 每月 / 每年）；到期日和过期后**每天发邮件提醒**，直到你点完成；周期任务点"完成本期"后自动顺延到下一期

## 定时引擎说明

`cron-worker/` 是独立部署的 Cloudflare Worker（dostime-cron），cron 触发器每 5 分钟运行一次：

- 扫描 `scheduled_emails` 中到期的任务 → 发送邮件 → 推进下次发送时间
- 扫描 `tasks` 中过期未完成的任务 → 发送提醒 → 当天去重（一天最多一封）

手动触发测试（需 CRON_SECRET）：

```bash
curl -H "X-Cron-Key: 你的CRON_SECRET" https://dostime-cron.doswowo.workers.dev/run
```


## 密钥与配置（Cloudflare Dashboard 中管理）

路径：dash.cloudflare.com → Workers & Pages → dostime → Settings → Variables and Secrets（环境选 **Production**）

| 名称 | 作用 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 管理后台登录密码 | 永不过期，可随时自定义 |
| `NOTIFY_EMAIL` | 收日记通知的邮箱 | 目前为 yarnshow@qq.com |
| `RESEND_API_KEY` | Resend 邮件服务的密钥（兜底通道） | 在 resend.com 的 API Keys 页面创建；CF 通道正常时用不到 |

> 重要：任何密钥/变量修改后，必须**重新部署**才能生效（见下文）。
> Preview 环境的变量对本站无效，改密码请认准 Production。

## 修改 / 重置后台密码（完整步骤）

1. 登录 dash.cloudflare.com
2. 左侧 **Workers & Pages** → 点开 **dostime**
3. **Settings** → **Variables and Secrets**
4. 确认环境为 **Production**
5. `ADMIN_PASSWORD` 行 → **Edit** → 输入新密码 → **Save**（首尾不要带空格，建议纯字母数字）
6. 切换到 **Deployments** 标签 → 最新部署右侧 **⋯** → **Retry deployment**
7. 约 1 分钟后状态变 Success，用新密码登录后台，旧密码自动失效

忘记密码就是同一套流程：设一个新值 → 重试部署 → 新密码登录。密码不存在找回，只存在覆盖。

## 更换收件邮箱 / 更换邮件密钥

与改密码同一页面、同一流程：

- 换收件邮箱：编辑 `NOTIFY_EMAIL` 的值 → 重试部署。新邮箱需先在 Cloudflare（Account Home → Email → Email Routing → Destination addresses）完成验证，否则 CF 通道会发送失败
- 换 Resend 密钥：先到 resend.com 创建新 API Key，再编辑 `RESEND_API_KEY` → 重试部署

## 免费额度参考（个人使用绰绰有余）

- Pages：无限带宽，每月 500 次构建
- D1：5GB 存储，每天 500 万行读取
- R2：10GB 存储，出口流量免费
- Cloudflare 邮件发送：包含在 Email Routing 内，个人使用无固定上限；前提是域名的 Email Routing 保持开启（dosday.dpdns.org 已开启，勿在 Dashboard 关闭）
- Resend（兜底）：每月 3000 封（发件人为 onboarding@resend.dev，只能发给注册 Resend 的邮箱）
- Workers：每天 10 万次请求

## 代码结构

```
├── wrangler.toml          # 项目配置（D1/R2 绑定）
├── schema.sql             # 数据库建表语句
├── public/                # 前端页面（静态文件）
│   ├── index.html         # 日记列表
│   ├── post.html          # 日记详情
│   ├── admin.html         # 管理后台
│   ├── app.js / admin.js  # 前端逻辑
│   └── style.css
└── functions/             # 后端 API（Pages Functions）
    ├── _lib/auth.js       # 登录令牌签发与校验
    └── api/
        ├── login.js       # POST 登录
        ├── whoami.js      # 查询登录状态
        ├── logout.js      # 退出登录
        ├── upload.js      # 图片上传到 R2
        ├── images/[key].js # 读取图片
        └── posts/
            ├── index.js   # 日记列表 / 发表（含邮件通知）
            └── [id].js    # 日记详情 / 编辑 / 删除
```

## 命令行方式（进阶，可选）

本机装好 Node.js 后，在仓库目录执行：

```bash
# 安装 wrangler（只需一次）
npm install -g wrangler

# 设置 Cloudflare API Token（Dashboard → My Profile → API Tokens 创建，需 Pages/D1/R2 编辑权限）
export CLOUDFLARE_API_TOKEN=你的Token

# 修改密码（按提示粘贴新值）
wrangler pages secret put ADMIN_PASSWORD --project-name dostime

# 重新部署
wrangler pages deploy
```

## 注意事项

- dostime.pages.dev 已于 2026-09-13 随项目迁移删除释放，本站最终域名为 dosday.pages.dev 与 dosday.dpdns.org（同一项目）；旧 Supabase 数据已全量迁入 D1，确认无误后可在 supabase.com 关闭旧项目
- 免费层无备份 SLA，重要日记可在后台导出文字另行保存
- 若收到 Resend 发件人（onboarding@resend.dev）的邮件，说明 Cloudflare 通道当时发送失败、自动降级了兜底通道，属于正常现象；Resend 邮件可能进垃圾箱，首次请检查并标记为非垃圾

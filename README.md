# Dostime · 时光手记

个人日记网站，部署在 Cloudflare Pages（免费套餐），支持在线写日记、上传图片、发表后自动将图文发送到指定邮箱。

- 网站：https://dostime.pages.dev
- 管理后台：https://dostime.pages.dev/admin.html
- 代码仓库：https://github.com/VareDog/dostime

## 架构

| 组件 | 服务 | 用途 |
|------|------|------|
| 前端页面 | Cloudflare Pages | 日记列表 / 详情 / 管理后台 |
| 后端接口 | Pages Functions（`functions/` 目录） | 日记增删改查、图片上传、登录认证 |
| 数据库 | D1 `dostime-db`（posts 表） | 存日记标题、正文、图片列表 |
| 图片存储 | R2 `dostime-images` | 存上传的图片，经 `/api/images/[key]` 访问 |
| 邮件通知 | Resend 免费版 | 每次发表日记后，图文发送到收件邮箱 |

## 密钥与配置（Cloudflare Dashboard 中管理）

路径：dash.cloudflare.com → Workers & Pages → dostime → Settings → Variables and Secrets（环境选 **Production**）

| 名称 | 作用 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 管理后台登录密码 | 永不过期，可随时自定义 |
| `NOTIFY_EMAIL` | 收日记通知的邮箱 | 目前为 yarnshow@qq.com |
| `RESEND_API_KEY` | Resend 邮件服务的密钥 | 在 resend.com 的 API Keys 页面创建 |

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

- 换收件邮箱：编辑 `NOTIFY_EMAIL` 的值 → 重试部署
- 换 Resend 密钥：先到 resend.com 创建新 API Key，再编辑 `RESEND_API_KEY` → 重试部署

## 免费额度参考（个人使用绰绰有余）

- Pages：无限带宽，每月 500 次构建
- D1：5GB 存储，每天 500 万行读取
- R2：10GB 存储，出口流量免费
- Resend：每月 3000 封邮件（发件人为 onboarding@resend.dev，只能发给注册 Resend 的邮箱；绑定自己的域名后可发给任意邮箱）
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

- dosday.pages.dev 是另一个独立站点，与本站互不影响，请勿误改
- 免费层无备份 SLA，重要日记可在后台导出文字另行保存
- Resend 免费版邮件可能进垃圾箱，首次收不到请检查垃圾邮件并标记为非垃圾

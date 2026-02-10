# 更新日志

所有项目的显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且该项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 计划功能
- [ ] 支持邮件模板功能
- [ ] 支持附件发送
- [ ] 支持 HTML 邮件内容
- [ ] 邮件发送历史记录
- [ ] 定时邮件发送功能
- [ ] 多邮箱账号支持

---

## [1.0.0] - 2026-02-10

### 新增
- ✨ 初始版本发布
- 📧 支持通过 QQ 命令发送邮件
  - `#email send <收件人> <主题> <内容>` - 发送邮件
  - `#email test` - 发送测试邮件
  - `#email help` - 显示帮助信息
- 🔧 支持 SMTP 服务器配置
  - 支持 QQ 邮箱、163 邮箱、Gmail 等主流邮箱
  - 支持 SSL/TLS 加密连接
  - 支持自定义发件人名称和邮件标题前缀
- 🌐 提供 WebUI 配置面板
  - 可视化 SMTP 配置界面
  - 测试邮件发送功能
  - 实时配置保存
- 📤 支持群发邮件
  - 可同时发送给多个收件人（逗号分隔）
- 🔌 提供完整的 RESTful API 接口
  - `GET /config` - 获取配置
  - `POST /config` - 保存配置
  - `POST /send` - 发送邮件
  - `POST /test` - 发送测试邮件
  - `GET /status` - 获取插件状态

### 技术特性
- 🔥 基于 NapCat 插件框架开发
- 📦 使用 TypeScript + Vite 构建
- ⚡ 支持热重载开发模式
- 🎨 使用 React + Tailwind CSS 开发 WebUI
- 📨 使用 Nodemailer 实现邮件发送

---

## 版本说明

- **主版本号**：当进行不兼容的 API 修改时
- **次版本号**：当以向后兼容的方式添加功能时
- **修订号**：当进行向后兼容的问题修复时

---

**维护者**: [MY-Final](https://github.com/MY-Final)  
**项目主页**: https://github.com/MY-Final/napcat-plugin-email

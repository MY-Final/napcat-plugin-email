# 贡献指南

感谢您对 NapCat 邮箱服务插件的兴趣！我们欢迎所有形式的贡献。

## 🚀 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请通过 [GitHub Issues](https://github.com/MY-Final/napcat-plugin-email/issues) 提交。

提交问题时请包含：
- 问题的清晰描述
- 复现步骤
- 期望行为和实际行为
- 截图（如适用）
- 环境信息：
  - NapCat 版本
  - 插件版本
  - Node.js 版本
  - 操作系统

### 提交代码

1. **Fork 仓库**
   ```bash
   git clone https://github.com/MY-Final/napcat-plugin-email.git
   cd napcat-plugin-email
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **开发**
   ```bash
   # 开发模式（热重载）
   pnpm run dev
   
   # 或构建 WebUI
   pnpm run dev:webui
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 前往 GitHub 仓库页面
   - 点击 "Compare & pull request"
   - 填写 PR 描述，说明改动内容

## 📋 代码规范

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式（不影响功能）
- `refactor:` 代码重构
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

示例：
```bash
git commit -m "feat: 添加邮件模板功能"
git commit -m "fix: 修复 SMTP 连接超时问题"
git commit -m "docs: 更新 README 中的配置说明"
```

### 代码风格

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 保持代码简洁清晰
- 添加必要的注释

## 🧪 测试

在提交 PR 前，请确保：

1. 代码可以正常构建
   ```bash
   pnpm run build
   ```

2. 类型检查通过
   ```bash
   pnpm run typecheck
   ```

3. 在本地测试功能正常

## 📦 发布流程

项目维护者将按照以下流程发布新版本：

1. 更新 `CHANGELOG.md`
2. 更新 `package.json` 中的版本号
3. 创建 Git tag
4. 推送到 GitHub
5. GitHub Actions 将自动构建并创建 Release

## 💡 开发建议

### 项目结构

```
src/
├── index.ts              # 插件入口
├── config.ts             # 配置定义
├── types.ts              # 类型定义
├── core/
│   └── state.ts          # 状态管理
├── handlers/
│   ├── message-handler.ts # 消息处理
│   └── email-handler.ts   # 邮件命令处理
├── services/
│   ├── api-service.ts    # API 路由
│   └── email-service.ts  # 邮件服务
└── webui/                # WebUI 前端
```

### 添加新功能

1. 如果是新的命令，在 `handlers/email-handler.ts` 中添加
2. 如果是新的 API，在 `services/api-service.ts` 中添加
3. 如果是新的配置项，在 `types.ts`、`config.ts` 和 `state.ts` 中更新

## ❓ 常见问题

**Q: 如何调试插件？**

A: 确保 NapCat 已安装 `napcat-plugin-debug` 插件，然后运行：
```bash
pnpm run dev
```

**Q: WebUI 如何开发？**

A: 运行前端开发服务器：
```bash
pnpm run dev:webui
```

**Q: 构建失败怎么办？**

A: 检查：
1. 是否已安装所有依赖 (`pnpm install`)
2. TypeScript 类型是否正确 (`pnpm run typecheck`)
3. 代码是否有语法错误

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/MY-Final/napcat-plugin-email/issues)
- **项目主页**: https://github.com/MY-Final/napcat-plugin-email

## 📜 许可证

通过提交代码，您同意您的贡献将在 MIT 许可证下发布。

---

再次感谢您的贡献！🎉

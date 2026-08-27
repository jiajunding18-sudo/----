# 机器视觉 Learning OS

面向个人长期学习的机器视觉学习系统。当前仓库处于 **Phase 1A：项目初始化与基础工程环境**，只包含可运行工程骨架；正式 Dashboard、Roadmap、Knowledge、Projects、Study Log、搜索和进度系统尚未实现。

## 环境

- Node.js 24.19.0
- npm 11.17.0

项目使用 npm，并且只提交 `package-lock.json`。安装依赖前请确认 `node --version` 与 `npm --version` 符合 `package.json` 中的 engines 约束。

## 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run check:full
```

生产构建使用 Next.js static export，输出位于 `out/`。静态产物必须通过 HTTP 服务器访问，不能直接使用 `file://` 打开。

项目长期规则与产品规划见 `AGENTS.md`、`PRODUCT_SPEC.md`、`ROADMAP.md` 和 `ARCHITECTURE.md`。

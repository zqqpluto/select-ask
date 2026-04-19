/// <reference types="vite/client" />

// Select Ask 是完全本地化的插件，不需要后端相关的环境变量
interface ImportMetaEnv {
  // 当前没有需要配置的环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
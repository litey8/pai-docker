// 配置文件管理 —— 高频读取的系统配置走文件，不占 DB
//
// 存储内容：
//   appName      - 项目名称（后台可动态修改）
//   tokenSecret  - token 签名密钥（首次启动自动生成 32 字节随机值）
//
// 文件位置：DATA_DIR/config.json（与 SQLite 同目录，跟随数据卷持久化）
// 读取策略：启动时一次性加载到内存，读操作零 IO；写操作同步回写文件
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 配置文件目录：优先环境变量，否则项目根 data/
const CONFIG_DIR = process.env.DATA_DIR
  || join(__dirname, '..', '..', 'data')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

// 默认项目名称
const DEFAULT_APP_NAME = '排课系统'

// 内存缓存：启动后所有读操作直接走内存
let cachedConfig = null

// 生成 32 字节随机十六进制字符串作为 token 签名密钥
function generateTokenSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

// 构造默认配置（首次启动用）
function createDefaultConfig() {
  return {
    appName: DEFAULT_APP_NAME,
    tokenSecret: generateTokenSecret(),
  }
}

// 启动时加载配置：文件不存在则生成默认配置并持久化
export function loadConfig() {
  if (cachedConfig) return cachedConfig
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      // 兼容性校验：确保必要字段存在
      cachedConfig = {
        appName: typeof parsed.appName === 'string' && parsed.appName.trim()
          ? parsed.appName
          : DEFAULT_APP_NAME,
        tokenSecret: typeof parsed.tokenSecret === 'string' && parsed.tokenSecret
          ? parsed.tokenSecret
          : generateTokenSecret(),
      }
      // 若文件缺失必要字段，回写修复后的配置
      if (!parsed.tokenSecret || !parsed.appName) {
        writeFileSync(CONFIG_PATH, JSON.stringify(cachedConfig, null, 2), 'utf-8')
      }
    } else {
      // 首次启动：生成默认配置
      cachedConfig = createDefaultConfig()
      writeFileSync(CONFIG_PATH, JSON.stringify(cachedConfig, null, 2), 'utf-8')
    }
  } catch (e) {
    // 文件损坏等异常：兜底用内存默认配置，但不回写（避免覆盖损坏前的数据）
    console.error('[config] 加载配置文件失败，使用默认值:', e?.message || String(e))
    cachedConfig = createDefaultConfig()
  }
  return cachedConfig
}

// 同步回写配置到文件
function persist() {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(cachedConfig, null, 2), 'utf-8')
  } catch (e) {
    console.error('[config] 回写配置文件失败:', e?.message || String(e))
    throw new Error('配置文件写入失败')
  }
}

// 读取项目名称
export function getAppName() {
  const cfg = loadConfig()
  return cfg.appName
}

// 修改项目名称：更新内存并回写文件
export function setAppName(name) {
  const cfg = loadConfig()
  const value = String(name || '').trim().slice(0, 50) || DEFAULT_APP_NAME
  cfg.appName = value
  persist()
  return value
}

// 读取 token 签名密钥
export function getTokenSecret() {
  const cfg = loadConfig()
  return cfg.tokenSecret
}

// 暴露配置文件路径（供调试/运维查看）
export function getConfigPath() {
  return CONFIG_PATH
}

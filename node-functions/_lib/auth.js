// 鉴权工具 —— 基于 HMAC-SHA256 的带主体 token 签发与验证 + RBAC 权限模型
// token 格式: base64url(payload_json) + "." + hex(HMAC-SHA256(secret, payload_b64))
//   payload = { uid, username, role, realName, ts }
//
// 鉴权模型（admins 表 + RBAC）：
// - 管理员账号存于 admins 表（TEXT id，前缀 adm_），PBKDF2 哈希
// - admins 表为空时进入"引导创建超管"流程
// - 三级角色：superadmin（全部）/ admin（业务全权）/ teacher（受限）
// - token 携带主体标识，requireAuth 解析后注入 context.admin，供审计与权限校验

import {
  countAdmins,
  getAdminByUsername,
  createSuperAdmin,
} from './store.js'
import { getTokenSecret as getTokenSecretFromConfig } from './config-file.js'

// re-export，供 api 层直接从 auth.js 引入
export { createSuperAdmin }

// ========== 角色 / 权限模型 ==========
// 模块：students/courses/enrollments/transfers/schedules/attendance/announcement
//       reports/admins/audit/settings
// 操作：view/create/update/delete
// 权限串格式 "module:action"，superadmin 用 "*" 通配
export const ROLE_PERMISSIONS = {
  superadmin: '*',
  admin: [
    'students:view', 'students:create', 'students:update', 'students:delete',
    'courses:view', 'courses:create', 'courses:update', 'courses:delete',
    'enrollments:view', 'enrollments:create', 'enrollments:update', 'enrollments:delete',
    'transfers:view', 'transfers:create',
    'schedules:view', 'schedules:create', 'schedules:update', 'schedules:delete',
    'attendance:view', 'attendance:update',
    'announcement:view', 'announcement:update',
    'reports:view',
  ],
  teacher: [
    'schedules:view', 'attendance:view', 'attendance:update',
    'enrollments:view', 'students:view', 'courses:view', 'reports:view',
  ],
}

// 判断角色是否拥有指定权限
export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  if (perms === '*') return true
  return perms.includes(permission)
}

// ========== 工具函数 ==========
function bufToHex(buf) {
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function bufToB64Url(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToStr(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function hmacSign(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bufToHex(sig)
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const maxLen = Math.max(aBytes.length, bBytes.length)
  let diff = 0
  for (let i = 0; i < maxLen; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0
    const bv = i < bBytes.length ? bBytes[i] : 0
    diff |= av ^ bv
  }
  diff |= aBytes.length ^ bBytes.length
  return diff === 0
}

// ========== 密码哈希（PBKDF2-HMAC-SHA256） ==========
const PBKDF2_ITERATIONS = 100000
export async function hashPassword(password) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  const saltHex = bufToHex(salt)
  const hashHex = bufToHex(bits)
  return `${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`
}

export async function verifyPasswordHash(password, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const iterations = Number(parts[0])
  const salt = hexToBytes(parts[1])
  const expected = parts[2]
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return constantTimeEqual(bufToHex(bits), expected)
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// ========== Token 签发与校验 ==========
export function getTokenSecret() {
  return getTokenSecretFromConfig()
}

// 签发 token：携带主体 payload（uid/username/role/realName + 时间戳）
export async function signToken(secret, payload = {}) {
  const fullPayload = {
    uid: payload.uid || '',
    username: payload.username || '',
    role: payload.role || '',
    realName: payload.realName || '',
    ts: Date.now(),
  }
  const payloadStr = JSON.stringify(fullPayload)
  const enc = new TextEncoder()
  const payloadB64 = bufToB64Url(enc.encode(payloadStr))
  const sig = await hmacSign(secret, payloadB64)
  return `${payloadB64}.${sig}`
}

// 验证 token：返回 payload 对象（合法）或 null（非法/过期）
export async function verifyToken(token, secret, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts
  const expected = await hmacSign(secret, payloadB64)
  if (!constantTimeEqual(sig, expected)) return null
  let payload
  try {
    payload = JSON.parse(b64UrlToStr(payloadB64))
  } catch {
    return null
  }
  if (!payload || typeof payload.ts !== 'number') return null
  if (Date.now() - payload.ts > maxAgeMs) return null
  if (payload.ts > Date.now() + 60_000) return null
  return payload
}

export function extractToken(request) {
  const auth = request.headers.get('Authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return ''
}

// 判断是否处于"引导创建超管"阶段（admins 表为空）
export async function isBootstrapMode() {
  return (await countAdmins()) === 0
}

// 登录校验：username + password
// 返回 { ok, message?, bootstrap?, admin? }
export async function authenticate(username, inputPassword) {
  const adminCount = await countAdmins()
  if (adminCount === 0) {
    return { ok: false, message: '系统尚未初始化，请先完成超管账号创建引导', bootstrap: true }
  }
  if (!username) {
    return { ok: false, message: '请输入用户名' }
  }
  const admin = await getAdminByUsername(username)
  if (!admin) {
    return { ok: false, message: '用户名或密码错误' }
  }
  if (admin.status === 'disabled') {
    return { ok: false, message: '该账号已被禁用，请联系管理员' }
  }
  if (await verifyPasswordHash(inputPassword, admin.password_hash)) {
    return { ok: true, admin }
  }
  return { ok: false, message: '用户名或密码错误' }
}

// 鉴权中间件：校验通过注入 context.admin，失败返回 401 Response
// context.admin = { id, username, role, realName, payload }
export async function requireAuth(context) {
  try {
    const secret = getTokenSecret()
    const token = extractToken(context.request)
    const payload = await verifyToken(token, secret)
    if (!payload) {
      return new Response(
        JSON.stringify({ code: 401, message: '未登录或登录已过期，请重新登录', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      )
    }
    // 注入操作者信息（payload 已含主体，无需每次查库）
    context.admin = {
      id: payload.uid,
      username: payload.username,
      role: payload.role,
      realName: payload.realName,
      payload,
    }
    return null
  } catch (e) {
    console.error('[requireAuth] 鉴权异常:', e?.message || String(e))
    return new Response(
      JSON.stringify({ code: 1, message: '鉴权服务暂不可用，请稍后重试', data: null }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    )
  }
}

// 权限校验中间件：requireAuth 通过后再校验角色权限，失败返回 403
// 用法：const fail = await requirePermission(context, 'admins:create')
export async function requirePermission(context, permission) {
  const authFail = await requireAuth(context)
  if (authFail) return authFail
  const admin = context.admin
  if (!admin || !hasPermission(admin.role, permission)) {
    return new Response(
      JSON.stringify({ code: 403, message: '权限不足，无法执行此操作', data: null }),
      { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    )
  }
  return null
}

// 从请求中提取客户端 IP（审计用）
export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') || ''
}

/*
apiCache 简单内存缓存模块
@功能 为 API 响应提供内存级缓存，避免短时间内重复请求外部服务
@参数 DEFAULT_TTL 默认缓存过期时间（毫秒）
*/

const DEFAULT_TTL = 3 * 60 * 1000; /* 3 分钟 */

interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/*
get 获取缓存数据
@param key 缓存键
@return 缓存数据或 null（过期/不存在）
*/
export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/*
set 设置缓存数据
@param key 缓存键
@param data 缓存数据
@param ttl 过期时间（毫秒），默认 3 分钟
*/
export function set<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  store.set(key, { data, expireAt: Date.now() + ttl });
}

/*
del 删除缓存
@param key 缓存键
*/
export function del(key: string): void {
  store.delete(key);
}

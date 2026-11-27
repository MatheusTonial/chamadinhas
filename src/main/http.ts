import type { HttpResponse, SendPayload } from '../shared/types'

const controllers = new Map<string, AbortController>()

function buildBody(p: SendPayload, headers: Headers): BodyInit | undefined {
  if (p.method === 'GET' || p.method === 'HEAD') return undefined
  const { mode, raw, fields } = p.body
  const active = fields.filter((f) => f.enabled && f.key)
  switch (mode) {
    case 'json':
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      return raw
    case 'text':
      if (!headers.has('content-type')) headers.set('content-type', 'text/plain')
      return raw
    case 'urlencoded': {
      const sp = new URLSearchParams()
      active.forEach((f) => sp.append(f.key, f.value))
      if (!headers.has('content-type'))
        headers.set('content-type', 'application/x-www-form-urlencoded')
      return sp.toString()
    }
    case 'formdata': {
      const fd = new FormData()
      active.forEach((f) => fd.append(f.key, f.value))
      headers.delete('content-type') // boundary é definido pelo fetch
      return fd
    }
    default:
      return undefined
  }
}

export async function sendRequest(p: SendPayload): Promise<HttpResponse> {
  const controller = new AbortController()
  controllers.set(p.requestId, controller)
  const timer = setTimeout(() => controller.abort('timeout'), p.timeoutMs)
  const start = performance.now()
  try {
    let url = p.url.trim()
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url
    const headers = new Headers()
    for (const [k, v] of p.headers) {
      try {
        headers.append(k, v)
      } catch {
        throw new Error(`Header inválido: "${k}"`)
      }
    }
    const body = buildBody(p, headers)
    const res = await fetch(url, {
      method: p.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'follow'
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const timeMs = Math.round(performance.now() - start)
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      timeMs,
      sizeBytes: buf.length,
      headers: [...res.headers.entries()],
      body: buf.toString('utf-8')
    }
  } catch (e: unknown) {
    const timeMs = Math.round(performance.now() - start)
    let msg = e instanceof Error ? e.message : String(e)
    if (controller.signal.aborted) {
      msg = controller.signal.reason === 'timeout' ? 'Tempo limite excedido' : 'Requisição cancelada'
    } else if (e instanceof Error && e.cause instanceof Error) {
      msg = `${e.message}: ${e.cause.message}`
    }
    return { ok: false, status: 0, statusText: '', timeMs, sizeBytes: 0, headers: [], body: '', error: msg }
  } finally {
    clearTimeout(timer)
    controllers.delete(p.requestId)
  }
}

export function cancelRequest(requestId: string): void {
  controllers.get(requestId)?.abort('cancel')
}

# Plugin View Protocol — Full Reference

## View Modes

- **Local directory** (`"view": "./view"`) — loads `view/index.html` in a sandboxed `srcDoc` iframe with `postMessage` bridge
- **URL** (`"view": "https://example.com/app/"`) — loads URL in a separate BrowserWindow. No sandbox, no `postMessage` bridge — useful for embedding external web apps

## Message Protocol

### View → Host: Call Service Method

```json
{ "type": "plugin-call", "id": 1, "method": "myMethod", "params": {} }
```

### Host → View: Init (on load)

```json
{ "type": "plugin-init", "filePath": "/path/to/file", "theme": { "color": "#333", "backgroundColor": "#fff" } }
```

### Host → View: Service Result

```json
{ "type": "plugin-result", "id": 1, "result": {} }
```

### Host → View: Tree Update (head views only)

Sent automatically whenever the todolist tree changes:
```json
{ "type": "plugin-tree-update", "tree": [...] }
```

### View → Host: Request Tree (head views only)

```json
{ "type": "plugin-request-tree" }
```

Host responds with a `plugin-tree-update` message containing the current tree.

## Complete View Template

```html
<script>
  let callId = 0
  const pending = {}
  let currentFilePath = ''

  function callPlugin(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++callId
      const timer = setTimeout(() => { delete pending[id]; reject(new Error('timeout')) }, 2000)
      pending[id] = {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) }
      }
      window.parent.postMessage({ type: 'plugin-call', id, method, params }, '*')
    })
  }

  window.addEventListener('message', (event) => {
    const msg = event.data
    if (msg?.type === 'plugin-init') {
      currentFilePath = msg.filePath || ''
      if (msg.theme) document.body.style.color = msg.theme.color
      return
    }
    if (msg?.type === 'plugin-result' && pending[msg.id]) {
      const { resolve, reject } = pending[msg.id]
      delete pending[msg.id]
      msg.error ? reject(new Error(msg.error)) : resolve(msg.result)
    }
    if (msg?.type === 'plugin-tree-update') {
      // Handle tree data update (head views)
    }
  })
</script>
```

## Head View: Client-Side Tree Analysis Pattern

Head views receive `plugin-tree-update` on every tree change. For lightweight analysis (counting, filtering), do it **directly in the view** to avoid the `callPlugin` round-trip latency:

```html
<script>
  function analyzeTree(tree) {
    if (!Array.isArray(tree)) return null
    const stats = { totalPending: 0, focusCount: 0 }
    const traverse = (nodes) => {
      for (const node of nodes) {
        const item = node?.todo
        if (!item) { if (node?.children?.length) traverse(node.children); continue }
        if (!item.done) {
          stats.totalPending++
          if (item.focus) stats.focusCount++
        }
        if (node.children?.length) traverse(node.children)
      }
    }
    traverse(tree)
    return stats
  }

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'plugin-tree-update') {
      const result = analyzeTree(event.data.tree || [])
      render(result)  // Update DOM directly
    }
  })
</script>
```

Keep the service for heavy operations (file I/O, cross-file queries, clipboard). Use client-side analysis when the view only needs to read tree data and render.

## Language Detection

The `plugin-init` message may include a `lang` field reflecting the app's current locale. Fall back to `navigator.language`:

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'plugin-init') {
    const detected = (event.data.lang || navigator.language || 'en').toLowerCase()
    if (detected.startsWith('zh-tw') || detected.startsWith('zh-hant')) lang = 'zh-TW'
    else if (detected.startsWith('zh')) lang = 'zh'
    else if (detected.startsWith('ja')) lang = 'ja'
    // ... other languages
    else lang = 'en'
  }
})
```

For multi-language head views, embed an i18n object keyed by locale and use this detected `lang` to select translations.

## Dark Mode Detection

Beyond applying `theme.color` and `theme.backgroundColor`, you can detect dark mode from the background color to apply CSS class switches:

```javascript
if (msg.theme?.backgroundColor) {
  const bg = msg.theme.backgroundColor
  const isDark = typeof bg === 'string' && (
    bg.includes('rgb')
      ? parseInt(bg.split(',')[0].replace(/\D/g, '')) < 128
      : bg.startsWith('#') && parseInt(bg.slice(1, 3), 16) < 128
  )
  if (isDark) document.body.classList.add('dark')
}
```

Then use `.dark .tag-red { ... }` in CSS for dark-mode-specific styles instead of inline color overrides.

## Pitfalls

### Timeout on callPlugin

The `callPlugin` function uses `postMessage`. If the host isn't ready when the message is sent (e.g., `plugin-init` hasn't fired, or service hasn't initialized), the `plugin-result` response never arrives — the Promise hangs forever and silently blocks all downstream logic.

Always add a timeout (2 seconds recommended).

### localStorage as Fallback

Because `callPlugin` can fail silently, don't rely solely on the service for view-side data. Write to `localStorage` immediately as a synchronous backup:

```javascript
function saveData(val) {
  localStorage.setItem('my_key', val)               // instant, reliable
  callPlugin('save', { value: val }).catch(() => {}) // async, best-effort
}

async function loadData() {
  try {
    const res = await callPlugin('load', {})
    if (res?.result?.value) return res.result.value
  } catch {}
  return localStorage.getItem('my_key')
}
```

### Double-Unwrap Results

The service returns `{ ok, result }`, and `pluginCallService` wraps it again. View code needs double unwrap:

```javascript
const inner = res?.result || res
const data = inner?.result || inner
```

### Head View Auto-Height

Set `html, body { height: auto; overflow: hidden }` so the host iframe can measure `body.offsetHeight` correctly via `MutationObserver`.

### Theme Adaptation

Read `theme.color` and `theme.backgroundColor` from the `plugin-init` message and apply to your view elements for dark/light mode support.

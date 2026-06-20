---
name: todolist-knowledge
description: Todolist desktop app knowledge — .todo file format, plugin system, plugin API, view protocol, and plugin contributes. Use this skill whenever working with .todo files, building or debugging Todolist plugins, implementing plugin views or head views, or working with the Todolist plugin API and contributes system (context menus, events, views). Also use when users mention todolist format, todo tree structure, plugin service methods, or plugin iframe communication.
---

# Todolist Knowledge

Reference for working with the Todolist desktop app (Electron). This skill covers three domains — read the relevant reference file when you need full details.

## Reference Files

| File | When to Read |
|------|-------------|
| `references/todo-format.md` | Working with `.todo` files — full type definitions, field details, tag system, examples, common operations |
| `references/plugin-api.md` | Building plugin services — full API method table, pluginContributes spec (contextMenus, events, views.head, views.topbar, views.topfix), installation |
| `references/plugin-view.md` | Building plugin views — message protocol, complete HTML template, client-side tree analysis pattern, i18n/lang detection, dark mode detection, pitfalls (timeout, double-unwrap, auto-height, theme) |

## Quick Reference

### .todo File Format

A `.todo` file is JSON with one root key. Everything lives under `todotree`:

```javascript
// Reading
const store = JSON.parse(fileText).todotree
const tree = store?.tree ?? []

// Writing
JSON.stringify({ todotree: store })
```

Do NOT put `tree`, `tags`, `title` at the outermost JSON level.

Core structure:
- `todotree.tree`: Array of `{ key, children, todo }` nodes (unlimited nesting)
- `todotree.tags`: Tag definitions `{ label, color, level, fontColor, timeline? }`
- `todotree.timelines`: Ordered todo id array for the horizontal strip
- `todotree.expandKeys`, `todotree.add_mode`: Required (use `[]` and `'bottom'` as defaults)

Each `todo` item has: `id` (number, unique), `content` (string), `done` (boolean), `level` (`'default'|'secondary'|'success'|'warning'|'danger'`). Optional: `date` (Unix seconds comma-separated), `start`/`end` (milliseconds), `tags` (string[] referencing `todotree.tags` keys), `link`, `fileLink`, `focus`, `keep`, `tip`.

Prefer child nodes over `tip` for supplemental content — `tip` is hidden in UI until enabled.

For full type definitions, examples, and helper functions, read `references/todo-format.md`.

### App Config (`~/.todoListNative.json`)

The desktop app stores global configuration in `~/.todoListNative.json`. Read via `getConfig()`, write via `saveConfig(partialConfig)` (shallow merge).

```json
{
  "currentDir": "/Users/xxx/my-todos",
  "currentKey": "/Users/xxx/my-todos/work.todo",
  "currentName": "work",
  "recent": [{ "path": "/path/to/file.todo", "name": "file" }],
  "expandedKeys": ["/Users/xxx/my-todos/2026"],
  "hideAside": false,
  "asidePos": 261,
  "winSize": [1251, 810],
  "lang": "zh-cn",
  "theme": "dark",
  "debug": true,
  "token": "cloud-sync-token",
  "backgroundImage": "https://example.com/bg.jpg",
  "backgroundOp": "8",
  "backgroundSize": "cover",
  "backupSize": "9.5",
  "workPendTimeMax": "9.5",
  "noticeKey": "20260617",
  "dailyInfo": { "date": "06-18", "start": 1781748208423 },
  "frameUrl": "https://...",
  "aiCommand": "clix chat \"$cmd\"",
  "bottomHtmlTool": "...",
  "enableFloatingBall": true,
  "chatVisible": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `currentDir` | `string` | Active workspace folder path. Defaults to `~/.todoListNative` if empty |
| `currentKey` | `string` | Full path of the currently open `.todo` file |
| `currentName` | `string` | Display name of the current file (filename without extension) |
| `recent` | `Array<{path, name}>` | Recently opened files/folders, max 20, newest first |
| `expandedKeys` | `string[]` | Expanded folder paths in the sidebar tree |
| `hideAside` | `boolean` | Whether the sidebar is collapsed |
| `asidePos` | `number` | Sidebar width in pixels |
| `winSize` | `[number, number]` | Window `[width, height]` — persisted on resize, restored on launch |
| `lang` | `string` | UI language (`'zh-cn'`, `'en'`, etc.) |
| `theme` | `string` | `'dark'` or `'light'` — defaults to dark if absent |
| `debug` | `boolean` | Enables the DevTools menu item in the tray context menu |
| `token` | `string\|null` | Cloud sync auth token (set via `SetToken`, cleared via `ClearToken`) |
| `backgroundImage` | `string` | URL of the custom background image |
| `backgroundOp` | `string` | Background opacity (`"0"`–`"10"`, as string) |
| `backgroundSize` | `string` | CSS `background-size` for the background image (e.g. `"cover"`, `"contain"`, `"100% auto"`) — defaults to `cover` in CSS |
| `backupSize` | `string` | Max backup size in MB (as string, e.g. `"9.5"`) |
| `workPendTimeMax` | `string` | Max work duration in hours before overtime alert (as string, e.g. `"9.5"`) |
| `dailyInfo` | `{date, start}` | Today's work session — `date` is `"MM-DD"`, `start` is Unix ms timestamp |
| `noticeKey` | `string` | Last-read changelog date key (e.g. `"20260617"`) — suppresses re-display |
| `frameUrl` | `string` | Custom iframe URL for the GPT/AI panel |
| `aiCommand` | `string` | Shell command template for AI chat — `$cmd` is replaced with user input |
| `bottomHtmlTool` | `string` | Custom HTML tool injected at the bottom area |
| `enableFloatingBall` | `boolean` | Show floating action ball (native only) |
| `chatVisible` | `boolean` | Whether the AI chat panel is open |

Related paths:
- `~/.todoListNative/` — default workspace dir, plugin storage root
- `~/.todoListNative.bak` — backup file
- `~/.todoListNative_daily.json` — daily work-time log (separate from config)

### Plugin System

Plugins extend the Todolist desktop app with a frontend view (HTML iframe) and/or a backend service (Node.js). Installed to `~/.todoListNative/plugins/`.

```
my-plugin/
  package.json        # name, version, view, main, viewSize, pluginContributes
  view/index.html     # Frontend (optional)
  service/index.js    # Backend (optional)
```

Key `package.json` fields:

```json
{
  "name": "@aicupa/plugin-my-plugin",
  "version": "1.0.0",
  "view": "./view",
  "main": "./service",
  "viewjs": "./inject.js",
  "viewSize": { "width": 800, "height": 600 },
  "pluginContributes": {
    "contextMenus": [{ "title": "Action", "title_zh": "操作", "command": "methodName" }],
    "events": { "paste": { "check": "checkMethod", "handler": "handleMethod" } },
    "views": { "head": true }
  }
}
```

- `viewjs` (optional): Path to a JS file that will be injected into the app's `document.head` as a `<script>` tag when plugins load. Runs in the main app context (not iframe).

Service pattern (use JSDoc for type hints):

```javascript
/**
 * @param {import('@aicupa/api').PluginApi} api
 */
module.exports = (api) => ({
  async myMethod(params) {
    const tree = await api.getTree(params.filePath)
    return { ok: true, result: tree }
  }
})
```

Key APIs: `api.getTree()`, `api.reload()`, `api.store()`, `api.readFile()`, `api.writeFile()`, `api.fetch()`, `api.fs`, `api.os`, `api.path`, `api.crypto`, `api.clipboard.writeText()/.readText()`, `api.base64.encode()/.decode()`, `api.mapTree()`, `api.setBackground()`.

Return format: `{ ok: true, result: ... }` or `{ ok: false, error: "..." }`.

For full API table, pluginContributes spec, and installation details, read `references/plugin-api.md`.

### Plugin View Communication

Local views (`"view": "./view"`) communicate via `postMessage` in a sandboxed iframe. URL views (`"view": "https://..."`) open in a separate BrowserWindow with no bridge.

Message types:
- `plugin-call` (view→host): Call service method `{ type, id, method, params }`
- `plugin-result` (host→view): Response `{ type, id, result }`
- `plugin-init` (host→view): Init with `{ filePath, theme: { color, backgroundColor } }`
- `plugin-tree-update` (host→view): Tree data push (head/topbar/topfix views)
- `plugin-request-tree` (view→host): Request current tree (head/topbar/topfix views)

View types:
- `views.head` — full-width block iframe above the progress bar
- `views.topbar` — inline iframe in the PageTitle area (top-right, alongside navigator). Non-mobile/non-simple-mode only.
- `views.topfix` — full-width block iframe between filters and tree content

All types share the same protocol. Choose `topbar` for compact indicators, `head` for above-progress content, `topfix` for content between filters and tree.

Head/topbar view tips:
- Views receive `plugin-tree-update` automatically on every tree change — use this for client-side analysis instead of calling the service when only read access is needed
- `plugin-init` may include `lang` — use it (with `navigator.language` fallback) for i18n
- Detect dark mode from `theme.backgroundColor` luminance to apply `.dark` CSS class

Critical pitfalls:
1. **Timeout**: Always add a 2s timeout to `callPlugin` — without it, promises hang forever if host isn't ready
2. **Double-unwrap**: Service returns `{ ok, result }`, `pluginCallService` wraps again. Use: `const inner = res?.result || res; const data = inner?.result || inner`
3. **Head view height**: Set `html, body { height: auto; overflow: hidden }` for auto-height to work
4. **Theme**: Apply `theme.color` / `theme.backgroundColor` from `plugin-init` for dark/light mode

For the complete HTML template, client-side analysis pattern, and detailed pitfall explanations, read `references/plugin-view.md`.

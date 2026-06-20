# Plugin API — Full Reference

## Service Pattern

The `api` object is injected into the service factory. Use JSDoc `@param {import('@aicupa/api').PluginApi}` for type hints:

```javascript
/**
 * @param {import('@aicupa/api').PluginApi} api
 */
module.exports = (api) => {
  return {
    async myMethod(params) {
      const tree = await api.getTree(params.filePath)
      return { ok: true, result: tree }
    }
  }
}
```

## API Methods

| API | Description |
|-----|-------------|
| `api.reload(filePath?)` | Refresh the todolist view |
| `api.getTree(filePath?)` | Get the todolist JSON tree data |
| `api.store(key, value, filePath?)` | Save data to the todolist store |
| `api.relaunch()` | Restart the Electron app |
| `api.setTitle(title, filePath?)` | Set the window title |
| `api.getConfig()` | Get app configuration |
| `api.readFile(path)` | Read a file (returns string) |
| `api.writeFile(path, content)` | Write content to a file |
| `api.readdir(dir)` | List files in a directory |
| `api.mkdir(dir)` | Create a directory (recursive) |
| `api.remove(path)` | Remove a file or directory |
| `api.pathJoin(...args)` | Join path segments |
| `api.mapTree(tree, fn)` | Recursively map over a tree structure |
| `api.getArray(val)` | Safely convert a value to an array |
| `api.base64.encode(str)` | Encode string to base64 |
| `api.base64.decode(str)` | Decode base64 to string |
| `api.clipboard.writeText(text)` | Write text to clipboard |
| `api.clipboard.readText()` | Read text from clipboard |
| `api.fs` | Node.js `fs` module — direct access to file system APIs |
| `api.os` | Node.js `os` module — `homedir()`, `platform()`, etc. |
| `api.path` | Node.js `path` module — `join()`, `resolve()`, `dirname()`, etc. |
| `api.crypto` | Node.js `crypto` module — `createHash()`, `randomUUID()`, etc. |
| `api.fetch(url, options?)` | HTTP request via Node.js native fetch. Options: `{ method?, headers?, body?, timeout? }`. Returns `{ ok, status, statusText, headers, body }` |
| `api.setBackground({ backgroundImage?, backgroundOp?, backgroundSize? })` | Set the app background image, opacity, and/or CSS background-size. Saves to config and updates all windows immediately |
| `api.isWindows` | `true` if running on Windows |

## Return Format

Service methods should return:
- Success: `{ ok: true, result: ... }`
- Failure: `{ ok: false, error: "message" }`

## pluginContributes — Full Reference

### contextMenus

Register items in the tree node right-click menu:

```json
"contextMenus": [
  { "title": "Cut", "title_zh": "剪切", "command": "cutNode" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Menu item label (English) |
| `title_zh` | No | Chinese label, falls back to `title` |
| `command` | Yes | Service method name. Receives `{ node, filePath }` |

The `node` parameter contains `{ key, children, todo: { id, content, done, level, ... } }`.

### events.paste

Intercept paste actions on tree nodes:

```json
"events": {
  "paste": { "check": "getCutBuffer", "handler": "pasteNode" }
}
```

| Field | Description |
|-------|-------------|
| `check` | Service method to check if plugin has pending data. Return `{ ok: true, result: { node: ... } }` if active, `{ ok: true, result: { node: null } }` if not |
| `handler` | Service method to perform paste. Receives `{ targetNode, filePath }`. Tree reloads automatically after success |

### views.head

Render plugin view at the top of the todolist, above the progress bar:

```json
"views": { "head": true }
```

The view is loaded as an inline iframe with auto-height. It receives tree data on every update and supports the full `plugin-call` / `plugin-result` protocol.

Head view lifecycle:
1. Host sends `plugin-init` with `filePath`, `theme`, and optionally `lang`
2. View should send `plugin-request-tree` to get initial tree data
3. Host sends `plugin-tree-update` with current tree, and again on every subsequent change

Head view `viewSize` is optional — the iframe auto-sizes to `body.offsetHeight`. If provided, `viewSize.width` is ignored (head views stretch full width) and `viewSize.height` sets the initial/max height.

Complete head view `package.json` example:

```json
{
  "name": "@aicupa/plugin-my-indicator",
  "version": "1.0.0",
  "main": "./service",
  "view": "./view",
  "viewSize": { "width": 600, "height": 40 },
  "pluginContributes": { "views": { "head": true } }
}
```

For head views that only analyze and display tree data, the service can be minimal (or empty) — do analysis client-side in the view using `plugin-tree-update` data. See `plugin-view.md` → "Client-Side Tree Analysis Pattern".

### views.topbar

Render plugin view inline in the page title bar (top-right area, alongside the navigator):

```json
"views": { "topbar": true }
```

Topbar views use the same protocol as head views (`plugin-init`, `plugin-tree-update`, `plugin-call`/`plugin-result`). The difference is rendering position and layout:
- **head**: full-width block iframe above the progress bar
- **topbar**: inline iframe in the PageTitle area, auto-sized to content width and height

Topbar views are hidden (but still mounted and receiving events) while the todolist is loading. Only shown on non-mobile, non-simple-mode views.

Complete topbar view `package.json` example:

```json
{
  "name": "@aicupa/plugin-my-indicator",
  "version": "1.0.0",
  "main": "./service",
  "view": "./view",
  "pluginContributes": { "views": { "topbar": true } }
}
```

### views.topfix

Render plugin view in a fixed position between the filter area and the tree content:

```json
"views": { "topfix": true }
```

Topfix views use the same protocol as head/topbar views. The difference is position:
- **head**: full-width block iframe above the progress bar
- **topbar**: inline iframe in the PageTitle area
- **topfix**: full-width block iframe between filters and tree content

Topfix views are hidden (but still mounted and receiving events) while the todolist is loading.

Complete topfix view `package.json` example:

```json
{
  "name": "@aicupa/plugin-task-line",
  "version": "1.0.0",
  "main": "./service",
  "view": "./view",
  "pluginContributes": { "views": { "topfix": true } }
}
```

## viewjs — Inject Script

The `viewjs` field in `package.json` points to a JS file that gets injected into the app's `document.head` as a `<script>` tag when plugins load. Unlike views (iframe-sandboxed), `viewjs` runs in the main app context.

```json
{
  "name": "@aicupa/plugin-my-plugin",
  "viewjs": "./inject.js"
}
```

The injected `<script>` has `data-plugin="pluginName"` attribute for identification.

## Installation & Storage

- **npm**: Plugins with `@aicupa/plugin-` prefix can be searched/installed from the Plugin Marketplace
- **Local**: Plugin icon → Plugin Market → Install from local → select directory
- **Storage**: `~/.todoListNative/plugins/` (plugins), `~/.todoListNative/plugins.json` (registry)
- **Type hints**: Use JSDoc `@param {import('@aicupa/api').PluginApi} api` for IDE type inference — `@aicupa/api` is a types-only package (install via npm for development)

# .todo File Format — Full Reference

## Store Structure (IStoreTodoTree)

All fields live under the `todotree` root key.

```typescript
{
  // Required
  tree: ITodoTree[]
  expandKeys: (string | number)[]
  add_mode: 'top' | 'bottom'
  timelines: number[]            // Ordered todo ids for timeline strip; can be []

  // Optional — display & editor
  virtual?: boolean
  showLine?: boolean
  playFontSize?: number
  appFontSize?: number
  showEndTime?: boolean
  simpleMode?: boolean
  title?: string
  desc?: string
  lang?: string
  version?: string
  keymap?: string
  restDays?: number[]             // 0–6 = Sun–Sat

  // Optional — automation / integration
  autoSort?: boolean
  webhook?: string
  scriptPath?: string
  scriptCmdId?: string
  cloudSyncId?: number
  shareId?: string
  aiCommand?: string
  openCommand?: string

  // Optional — tag catalog
  tags?: {
    [key: number]: {
      label: string
      color: string
      level: number
      fontColor: string
      timeline?: boolean           // If true, todos with this tag appear on the Timeline / milestone page
    }
  }
}
```

## Tree Node (ITodoTree)

```typescript
{
  key: string | number           // Unique identifier (required)
  children: ITodoTree[]           // Child nodes (required, can be [])
  todo: ITodoItem                 // Todo data (required)
}
```

Supports unlimited nesting depth.

## Todo Item (ITodoItem)

```typescript
{
  // Basic (required)
  id: number                      // Unique identifier
  content: string                  // Todo text
  done: boolean                    // Completed?
  level: 'secondary' | 'default' | 'success' | 'warning' | 'danger'

  // Links
  link?: string                   // External URL (http/https)
  fileLink?: string               // Local file path

  // Status flags
  pendingDelete?: boolean
  focus?: boolean                 // In focus state
  keep?: boolean                  // Kept when clearing done items

  // Time
  date?: string                   // "startTimestamp,endTimestamp" (Unix seconds)
  start?: number                  // Start timestamp (milliseconds)
  end?: number                    // End timestamp (milliseconds)

  // Others
  tip?: string                    // Markdown; hidden until user enables tips — prefer child nodes
  tags?: string[]                 // Tag ID array referencing todotree.tags keys
}
```

## Level (Priority)

| Level | Display |
|-------|---------|
| `default` | Normal |
| `secondary` | Gray |
| `success` | Green |
| `warning` | Yellow |
| `danger` | Red |

## Date and Time

- `date`: Comma-separated Unix timestamps in **seconds** — `"1704067200,1704153600"`
- `start` / `end`: Precise timestamps in **milliseconds**
- If both exist, `date` is for date range display, `start`/`end` for precise time recording

## Tag System

Tags are defined in `todotree.tags` and referenced by string key in `todo.tags`:

```json
{
  "todotree": {
    "tags": {
      "1": { "label": "Important", "color": "#ff4d4f", "level": 1, "fontColor": "#ffffff", "timeline": true },
      "2": { "label": "Work", "color": "#1890ff", "level": 2, "fontColor": "#ffffff" }
    },
    "tree": [{ "key": 1, "children": [], "todo": { "id": 1, "content": "Task", "done": false, "level": "default", "tags": ["1", "2"] } }],
    "timelines": []
  }
}
```

- `tags[key].timeline`: When `true`, todos with this tag appear on the Timeline/milestone page
- `todotree.timelines`: Separate field — ordered array of todo `id` values for the horizontal strip above the main tree (not the same as tag timeline)

## Tip vs Child Nodes

Prefer child nodes for supplemental content. `tip` is hidden in the UI until enabled — use only when the user explicitly wants a Markdown annotation on a single item.

## Complete Example

```json
{
  "todotree": {
    "tree": [
      {
        "key": 1,
        "children": [
          {
            "key": 2,
            "children": [],
            "todo": { "id": 2, "content": "Subtask: Documentation", "done": false, "level": "default", "date": "1704067200,1704153600", "tags": ["1"] }
          }
        ],
        "todo": { "id": 1, "content": "Main task: Development", "done": false, "level": "warning", "link": "https://github.com/project", "start": 1704067200000, "tags": ["1", "2"] }
      }
    ],
    "expandKeys": [1],
    "add_mode": "bottom",
    "title": "My Todo List",
    "timelines": [],
    "tags": {
      "1": { "label": "Important", "color": "#ff4d4f", "level": 1, "fontColor": "#ffffff", "timeline": true },
      "2": { "label": "Work", "color": "#1890ff", "level": 2, "fontColor": "#ffffff" }
    }
  }
}
```

## Common Operations

```javascript
// Load store from file
const store = JSON.parse(fileText).todotree
const tree = store?.tree ?? []

// Traverse tree
function traverseTree(tree, callback) {
  for (const node of tree) {
    callback(node)
    if (node.children?.length) traverseTree(node.children, callback)
  }
}

// Find node by key
function findNode(tree, key) {
  for (const node of tree) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

// Parse date range
function parseTimeRange(dateString) {
  if (!dateString) return null
  const [start, end] = dateString.split(',').map(Number)
  return [start, end] // [seconds, seconds]
}
```

## Important Notes

1. Required fields inside `todotree`: `tree` and `timelines` (use `[]` if empty)
2. Each todo `id` must be unique within the file
3. `date` uses second-level timestamps; `start`/`end` use milliseconds
4. Values in `todo.tags` must exist as keys in `todotree.tags`
5. Files use `.todo` extension but are JSON format

# 作家 Plugin System Specification

**Version:** 1.0.0  
**Author:** Dom  
**Date:** 2026-03-04  
**Status:** Draft

---

## Executive Summary

This document specifies a Python-based plugin system for 作家 that enables per-novel custom functionality through user-provided scripts. The system allows authors to extend their novels with custom export formats, automated content generation, integration with external tools, and workflow automation without modifying the core application.

**Key Design Principles:**
- **Per-novel isolation:** Plugins are scoped to individual novels
- **Safe by default:** Sandboxed execution with explicit permission model
- **Developer-friendly:** Simple API, clear hooks, easy debugging
- **Zero-config discovery:** Auto-detect plugins in `meta/plugins/` directory
- **Backwards compatible:** Novels without plugins work identically

---

## 1. Architecture Overview

### 1.1 System Integration

```
┌─────────────────────────────────────────────────┐
│           ä½å®¶ Electron App                │
│  ┌───────────────────────────────────────────┐  │
│  │         Renderer Process (UI)             │  │
│  └───────────────┬───────────────────────────┘  │
│                  │ IPC                           │
│  ┌───────────────▼───────────────────────────┐  │
│  │         Main Process (Node.js)            │  │
│  └───────────────┬───────────────────────────┘  │
│                  │ HTTP/IPC                      │
└──────────────────┼───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│      Helper Process (Node.js/Python Bridge)      │
│  ┌────────────────────────────────────────────┐  │
│  │       Python Plugin Runtime (FastAPI)      │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Plugin Manager                      │  │  │
│  │  │  - Discovery & Loading               │  │  │
│  │  │  - Lifecycle Management              │  │  │
│  │  │  - Sandboxing & Permissions          │  │  │
│  │  └────────┬─────────────────────────────┘  │  │
│  │           │                                 │  │
│  │  ┌────────▼──────┐  ┌──────────────────┐  │  │
│  │  │ Plugin A      │  │ Plugin B          │  │  │
│  │  │ (per-novel-1) │  │ (per-novel-1)     │  │  │
│  │  └───────────────┘  └──────────────────┘  │  │
│  │                                             │  │
│  │  ┌────────────────┐                        │  │
│  │  │ Plugin C       │                        │  │
│  │  │ (per-novel-2)  │                        │  │
│  │  └────────────────┘                        │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 1.2 Novel Directory Structure

```
~/.zuojia/<novel-name>/
├── manuscript/
│   ├── chapter-01.md
│   └── chapter-02.md
├── wiki/
│   ├── characters-alice.md
│   └── locations-castle.md
├── meta/
│   ├── index.json
│   ├── backups/
│   └── plugins/                    # ← Plugin directory
│       ├── __init__.py             # Optional: marks as Python package
│       ├── custom_export/          # ← Individual plugin
│       │   ├── plugin.py           # Required: entry point
│       │   ├── manifest.json       # Required: metadata
│       │   ├── config.json         # Optional: user config
│       │   └── README.md           # Optional: documentation
│       └── word_tracker/
│           ├── plugin.py
│           ├── manifest.json
│           └── data.db             # Optional: plugin storage
└── .git/
```

---

## 2. Plugin Structure

### 2.1 Manifest Schema (`manifest.json`)

Every plugin requires a `manifest.json` file:

```json
{
  "id": "custom_export",
  "name": "Custom Export Format",
  "version": "1.0.0",
  "description": "Export manuscript to custom ePub format",
  "author": "Dom",
  "zuojia_version": ">=0.1.0",
  
  "permissions": [
    "read:manuscript",
    "read:wiki",
    "write:export",
    "network:https://api.example.com"
  ],
  
  "hooks": {
    "on_export": "export_handler",
    "on_chapter_save": "chapter_saved"
  },
  
  "config_schema": {
    "type": "object",
    "properties": {
      "output_format": {
        "type": "string",
        "enum": ["epub", "mobi", "azw3"],
        "default": "epub"
      },
      "include_toc": {
        "type": "boolean",
        "default": true
      }
    }
  },
  
  "dependencies": [
    "ebooklib>=0.18",
    "pillow>=10.0.0"
  ]
}
```

### 2.2 Plugin Entry Point (`plugin.py`)

Minimal plugin structure:

```python
from zuojia_plugin_api import Plugin, PluginContext

class CustomExport(Plugin):
    """Custom export plugin implementation."""
    
    def __init__(self, context: PluginContext):
        super().__init__(context)
        self.config = context.config
        self.logger = context.logger
    
    async def on_load(self):
        """Called when plugin is loaded."""
        self.logger.info("Custom export plugin loaded")
    
    async def export_handler(self, event):
        """Hook: triggered on export action."""
        manuscript = await self.api.get_manuscript()
        output_path = event.get("output_path")
        
        # Custom export logic
        result = await self.create_epub(manuscript, output_path)
        
        return {
            "success": True,
            "output_file": result.path,
            "format": "epub"
        }
    
    async def chapter_saved(self, event):
        """Hook: triggered on chapter save."""
        chapter_id = event.get("chapter_id")
        self.logger.debug(f"Chapter saved: {chapter_id}")
    
    async def create_epub(self, manuscript, output_path):
        """Custom implementation."""
        # ... ePub generation logic
        pass

# Required: plugin factory function
def create_plugin(context: PluginContext) -> Plugin:
    return CustomExport(context)
```

---

## 3. Plugin API

### 3.1 PluginContext

Injected into every plugin at initialization:

```python
class PluginContext:
    """Context provided to plugins at initialization."""
    
    # Core properties
    novel_path: str              # Path to novel directory
    plugin_id: str               # Plugin ID from manifest
    plugin_dir: str              # Path to plugin directory
    config: dict                 # User config from config.json
    logger: logging.Logger       # Namespaced logger
    
    # API access
    api: NovelAPI                # Read/write novel data
    storage: PluginStorage       # Plugin-specific storage
    
    # Metadata
    ä½å®¶_version: str       # ä½å®¶ version
    permissions: list[str]       # Granted permissions
```

### 3.2 NovelAPI

Read/write access to novel data (permission-gated):

```python
class NovelAPI:
    """API for accessing novel data."""
    
    # Manuscript operations (requires read:manuscript)
    async def get_manuscript(self) -> Manuscript:
        """Get full manuscript with all chapters."""
        
    async def get_chapter(self, chapter_id: str) -> Chapter:
        """Get single chapter content."""
        
    async def list_chapters(self) -> list[ChapterMeta]:
        """List all chapters with metadata."""
    
    async def get_chapter_content(self, filename: str) -> str:
        """Get raw chapter markdown content."""
    
    # Wiki operations (requires read:wiki)
    async def get_wiki_page(self, slug: str) -> WikiPage:
        """Get wiki page by slug."""
        
    async def list_wiki_pages(self) -> list[WikiPageMeta]:
        """List all wiki pages."""
    
    async def search_wiki(self, query: str) -> list[WikiPage]:
        """Search wiki pages."""
    
    # Write operations (requires write:manuscript)
    async def update_chapter(self, chapter_id: str, content: str):
        """Update chapter content (creates git snapshot)."""
    
    # Export operations (requires write:export)
    async def create_export(self, format: str, options: dict) -> ExportResult:
        """Trigger novel export."""
    
    # Metadata operations (requires read:meta)
    async def get_word_count(self, scope: str = "manuscript") -> int:
        """Get word count (manuscript/chapter/today)."""
        
    async def get_index(self) -> dict:
        """Get novel index metadata."""
```

### 3.3 Available Hooks

Plugins can register handlers for lifecycle events:

| Hook | Trigger | Event Data | Return Type |
|------|---------|------------|-------------|
| `on_load` | Plugin initialization | None | `None` |
| `on_unload` | Plugin shutdown | None | `None` |
| `on_chapter_save` | Chapter autosave/manual save | `{chapter_id, content, word_count}` | `None` |
| `on_chapter_open` | Chapter opened in editor | `{chapter_id}` | `None` |
| `on_export` | Export initiated | `{format, output_path, options}` | `{success, output_file, metadata}` |
| `on_git_commit` | Git commit created | `{commit_hash, message, files}` | `None` |
| `on_wiki_create` | Wiki page created | `{slug, title, content}` | `None` |
| `on_wiki_update` | Wiki page updated | `{slug, old_content, new_content}` | `None` |
| `on_daily_rollover` | Calendar day changes | `{date, words_today}` | `None` |

### 3.4 PluginStorage

Sandboxed key-value storage per plugin:

```python
class PluginStorage:
    """Plugin-specific persistent storage."""
    
    async def get(self, key: str, default=None) -> Any:
        """Get value by key."""
        
    async def set(self, key: str, value: Any):
        """Set value (JSON-serializable)."""
        
    async def delete(self, key: str):
        """Delete key."""
        
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        
    async def keys(self) -> list[str]:
        """List all keys."""
        
    async def clear(self):
        """Clear all plugin storage."""
```

---

## 4. Permission System

### 4.1 Permission Model

Plugins must explicitly request permissions in `manifest.json`. Users approve on first load.

**Available Permissions:**

| Permission | Scope | Description |
|------------|-------|-------------|
| `read:manuscript` | Novel data | Read chapter content |
| `read:wiki` | Novel data | Read wiki pages |
| `read:meta` | Novel data | Read novel metadata (index, stats) |
| `write:manuscript` | Novel data | Modify chapter content |
| `write:wiki` | Novel data | Create/update wiki pages |
| `write:export` | File system | Write to export directory |
| `write:plugin_data` | File system (sandboxed) | Write to plugin data directory |
| `network:<domain>` | Network | HTTP requests to specific domain |
| `network:*` | Network | Unrestricted network access (requires warning) |
| `subprocess` | System | Execute shell commands (requires warning) |
| `filesystem:<path>` | File system | Read/write to specific path |

### 4.2 Permission Grant Flow

1. User opens novel with new/updated plugin
2. ä½å®¶ detects changed permissions
3. UI displays permission request dialog:
   ```
   Plugin "Custom Export" requests:
   ✓ Read manuscript content
   ✓ Write to export directory
   ⚠ Network access to api.example.com
   
   [Approve] [Deny] [Review Details]
   ```
4. User approves/denies
5. Plugin loads with granted permissions only

### 4.3 Sandboxing

Plugins run in restricted Python environment:

- **Filesystem:** Limited to novel directory + plugin data dir
- **Network:** Restricted to approved domains
- **Subprocess:** Blocked by default (requires explicit permission)
- **Import restrictions:** Standard library + approved packages only
- **Resource limits:** CPU/memory quotas per plugin

---

## 5. Plugin Lifecycle

### 5.1 Discovery & Loading

1. **Discovery:** On novel open, scan `meta/plugins/` for subdirectories containing `manifest.json`
2. **Validation:** Parse manifest, check version compatibility
3. **Dependency check:** Verify Python dependencies installed
4. **Permission check:** Request user approval if needed
5. **Isolation:** Create plugin context with sandboxed environment
6. **Initialization:** Call `create_plugin(context)` factory function
7. **Load hooks:** Call `on_load()` lifecycle hook

### 5.2 Runtime Execution

```python
# Plugin manager orchestrates hook calls
@hook_trigger("on_chapter_save")
async def handle_chapter_save(chapter_id: str, content: str):
    event = {
        "chapter_id": chapter_id,
        "content": content,
        "word_count": count_words(content),
        "timestamp": datetime.now().isoformat()
    }
    
    # Execute all registered handlers for this hook
    for plugin in active_plugins:
        if "on_chapter_save" in plugin.hooks:
            try:
                await plugin.call_hook("on_chapter_save", event)
            except Exception as e:
                logger.error(f"Plugin {plugin.id} failed: {e}")
                # Continue executing other plugins
```

### 5.3 Unloading

1. Call `on_unload()` lifecycle hook
2. Flush plugin storage
3. Cancel any pending async tasks
4. Release resources
5. Remove from active plugins registry

---

## 6. Configuration System

### 6.1 Plugin Config (`config.json`)

User-editable configuration per plugin:

```json
{
  "output_format": "epub",
  "include_toc": true,
  "compression_level": 6,
  "custom_css": "styles/novel.css"
}
```

Schema validated against `config_schema` from `manifest.json`.

### 6.2 Global Plugin Settings

Stored in `meta/plugin-settings.json`:

```json
{
  "enabled_plugins": ["custom_export", "word_tracker"],
  "disabled_plugins": ["old_plugin"],
  "plugin_permissions": {
    "custom_export": {
      "granted": ["read:manuscript", "write:export", "network:https://api.example.com"],
      "denied": [],
      "approved_at": "2026-03-04T10:30:00Z"
    }
  }
}
```

### 6.3 UI Integration

**Settings Panel:**
```
Novel Settings > Plugins

 ✓ Custom Export Format              [Configure] [Disable]
   Export to ePub/MOBI/AZW3
   Version 1.0.0 | Updated: 2 days ago

 ✓ Word Tracker                       [Configure] [Disable]
   Track daily writing goals
   Version 2.1.0 | Updated: 1 week ago

 + Install Plugin from Directory
 + Browse Plugin Marketplace (future)
```

---

## 7. Use Cases & Examples

### 7.1 Example: Custom Export Plugin

**Use case:** Export novel to custom ePub format with specific styling.

```python
# meta/plugins/custom_export/plugin.py

from ä½å®¶_plugin_api import Plugin, PluginContext
from ebooklib import epub

class CustomExportPlugin(Plugin):
    async def on_export(self, event):
        if event.get("format") != "custom_epub":
            return  # Not our format
        
        manuscript = await self.api.get_manuscript()
        book = epub.EpubBook()
        
        # Add metadata
        book.set_title(manuscript.title)
        book.set_language('en')
        
        # Add chapters
        for i, chapter in enumerate(manuscript.chapters):
            epub_chapter = epub.EpubHtml(
                title=chapter.title,
                file_name=f'chapter_{i}.xhtml',
                content=self.markdown_to_html(chapter.content)
            )
            book.add_item(epub_chapter)
        
        # Write file
        output_path = event.get("output_path")
        epub.write_epub(output_path, book)
        
        return {
            "success": True,
            "output_file": output_path,
            "format": "epub"
        }
    
    def markdown_to_html(self, markdown: str) -> str:
        # Custom markdown conversion
        pass
```

### 7.2 Example: Daily Writing Goal Tracker

**Use case:** Track daily word count and send reminder notifications.

```python
# meta/plugins/word_tracker/plugin.py

from ä½å®¶_plugin_api import Plugin
from datetime import datetime

class WordTrackerPlugin(Plugin):
    async def on_load(self):
        # Load today's progress
        self.daily_goal = self.config.get("daily_goal", 1000)
        self.words_today = await self.storage.get("words_today", 0)
        self.last_date = await self.storage.get("last_date", "")
        
        # Check for day rollover
        today = datetime.now().date().isoformat()
        if today != self.last_date:
            self.words_today = 0
            await self.storage.set("last_date", today)
    
    async def on_chapter_save(self, event):
        # Update word count
        words_added = event.get("words_added", 0)
        self.words_today += words_added
        await self.storage.set("words_today", self.words_today)
        
        # Check goal achievement
        if self.words_today >= self.daily_goal:
            self.logger.info(f"🎉 Daily goal reached! {self.words_today} words")
        else:
            remaining = self.daily_goal - self.words_today
            self.logger.debug(f"{remaining} words remaining for today's goal")
    
    async def on_daily_rollover(self, event):
        # Reset counter
        self.words_today = 0
        await self.storage.set("words_today", 0)
```

### 7.3 Example: Character Name Consistency Checker

**Use case:** Validate character name spelling across manuscript and wiki.

```python
# meta/plugins/name_checker/plugin.py

from ä½å®¶_plugin_api import Plugin
import re

class NameCheckerPlugin(Plugin):
    async def on_load(self):
        # Build character name index from wiki
        self.characters = {}
        wiki_pages = await self.api.list_wiki_pages()
        
        for page in wiki_pages:
            if page.slug.startswith("characters-"):
                content = await self.api.get_wiki_page(page.slug)
                self.characters[content.title] = page.slug
    
    async def on_chapter_save(self, event):
        content = event.get("content")
        warnings = []
        
        # Find potential character names (capitalized words)
        words = re.findall(r'\b[A-Z][a-z]+\b', content)
        
        for word in set(words):
            # Check for similar but not exact matches
            for char_name in self.characters:
                similarity = self.name_similarity(word, char_name)
                if 0.7 < similarity < 1.0:
                    warnings.append({
                        "word": word,
                        "suggestion": char_name,
                        "wiki_slug": self.characters[char_name]
                    })
        
        if warnings:
            self.logger.warning(f"Potential name inconsistencies: {warnings}")
    
    def name_similarity(self, a: str, b: str) -> float:
        # Simple Levenshtein distance
        pass
```

---

## 8. Security Considerations

### 8.1 Threat Model

**Threats:**
1. Malicious plugin reads/exfiltrates manuscript content
2. Plugin corrupts novel files
3. Plugin consumes excessive resources
4. Plugin executes arbitrary code on host system
5. Supply chain attack via compromised dependencies

**Mitigations:**
1. Explicit permission system with user consent
2. Write operations create automatic backups
3. Resource quotas per plugin (CPU/memory/disk)
4. Sandboxed execution environment
5. Dependency pinning and optional signature verification

### 8.2 Sandboxing Implementation

```python
# Restricted globals for plugin execution
SAFE_BUILTINS = {
    'print', 'len', 'range', 'enumerate', 'zip',
    'str', 'int', 'float', 'bool', 'list', 'dict', 'set',
    'Exception', 'ValueError', 'TypeError'
}

# Import restrictions
ALLOWED_STDLIB = {
    'json', 'datetime', 'math', 'random', 'typing',
    're', 'collections', 'itertools'
}

ALLOWED_PACKAGES = {
    'requests', 'pillow', 'markdown', 'ebooklib'
}

# Execute plugin in restricted environment
def execute_plugin(plugin_code: str, context: PluginContext):
    restricted_globals = {
        '__builtins__': {k: __builtins__[k] for k in SAFE_BUILTINS}
    }
    restricted_locals = {'context': context}
    
    exec(plugin_code, restricted_globals, restricted_locals)
    return restricted_locals.get('create_plugin')
```

### 8.3 Resource Limits

```python
# Configuration in plugin-settings.json
{
  "resource_limits": {
    "max_memory_mb": 100,
    "max_cpu_percent": 25,
    "max_execution_time_ms": 5000,
    "max_storage_mb": 50,
    "max_network_requests_per_hour": 100
  }
}
```

Enforced via `resource` module and async timeouts.

---

## 9. Development Workflow

### 9.1 Creating a Plugin

1. **Initialize directory:**
   ```bash
   mkdir -p ~/.zuojia/my-novel/meta/plugins/my_plugin
   cd ~/.zuojia/my-novel/meta/plugins/my_plugin
   ```

2. **Create manifest:**
   ```bash
   cat > manifest.json <<EOF
   {
     "id": "my_plugin",
     "name": "My Plugin",
     "version": "0.1.0",
     "description": "Does something useful",
     "author": "Your Name",
     "ä½å®¶_version": ">=0.1.0",
     "permissions": ["read:manuscript"],
     "hooks": {
       "on_chapter_save": "handle_save"
     }
   }
   EOF
   ```

3. **Create plugin.py:**
   ```python
   from ä½å®¶_plugin_api import Plugin, PluginContext
   
   class MyPlugin(Plugin):
       async def handle_save(self, event):
           self.logger.info("Chapter saved!")
   
   def create_plugin(context):
       return MyPlugin(context)
   ```

4. **Test:** Open novel in ä½å®¶, plugin auto-loads

### 9.2 Debugging

**Enable debug logging:**
```json
// In meta/plugin-settings.json
{
  "debug_mode": true,
  "log_level": "DEBUG",
  "log_to_file": true
}
```

**Logs location:**
```
~/.zuojia/my-novel/meta/plugins/my_plugin/logs/
├── plugin.log          # Plugin-specific logs
└── errors.log          # Error traces
```

**Hot reload:**
Plugins support hot reload during development:
```
Novel Settings > Plugins > [Reload All Plugins]
```

### 9.3 Testing

Use standard pytest framework:

```python
# meta/plugins/my_plugin/test_plugin.py

import pytest
from unittest.mock import AsyncMock
from plugin import MyPlugin

@pytest.fixture
def mock_context():
    context = AsyncMock()
    context.config = {"enabled": True}
    context.logger = logging.getLogger("test")
    return context

@pytest.mark.asyncio
async def test_handle_save(mock_context):
    plugin = MyPlugin(mock_context)
    
    event = {"chapter_id": "ch01", "content": "Hello"}
    await plugin.handle_save(event)
    
    assert plugin.logger.info.called
```

---

## 10. Implementation Roadmap

### Phase 1: Core Infrastructure (v0.1.0)
- [ ] Plugin discovery and manifest parsing
- [ ] Basic permission system
- [ ] PluginContext and NovelAPI implementation
- [ ] Hook registration and execution framework
- [ ] Simple sandboxing (filesystem restrictions)
- [ ] Basic error handling and logging

**Timeline:** 2 weeks  
**Success criteria:** Can load plugin with `on_chapter_save` hook

### Phase 2: Full API & Permissions (v0.2.0)
- [ ] Complete NovelAPI implementation
- [ ] PluginStorage implementation
- [ ] Full permission model with UI approval flow
- [ ] Resource quotas (CPU/memory/time limits)
- [ ] Enhanced sandboxing (import restrictions)

**Timeline:** 3 weeks  
**Success criteria:** Export plugin example works end-to-end

### Phase 3: Developer Experience (v0.3.0)
- [ ] Plugin template/scaffolding tool
- [ ] Hot reload support
- [ ] Enhanced debugging (breakpoints, inspector)
- [ ] Plugin testing utilities
- [ ] Documentation generator

**Timeline:** 2 weeks  
**Success criteria:** Can create and debug plugin in <30 minutes

### Phase 4: Polish & Security (v1.0.0)
- [ ] Advanced sandboxing (seccomp/AppArmor profiles)
- [ ] Dependency signature verification
- [ ] Plugin marketplace preparation
- [ ] Performance optimization
- [ ] Comprehensive error recovery

**Timeline:** 3 weeks  
**Success criteria:** Production-ready security model

---

## 11. API Reference

### 11.1 Data Models

```python
@dataclass
class Chapter:
    id: str
    filename: str
    title: str
    content: str
    word_count: int
    created_at: datetime
    updated_at: datetime

@dataclass
class Manuscript:
    chapters: list[Chapter]
    word_count: int
    title: str

@dataclass
class WikiPage:
    slug: str
    title: str
    content: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime

@dataclass
class ExportResult:
    success: bool
    output_path: str
    format: str
    size_bytes: int
    error: Optional[str]
```

### 11.2 Error Handling

Plugins should use standard exceptions:

```python
from ä½å®¶_plugin_api.exceptions import (
    PluginError,          # Base exception
    PermissionError,      # Missing required permission
    ConfigError,          # Invalid configuration
    StorageError,         # Storage operation failed
    APIError,             # API call failed
    ResourceLimitError    # Resource quota exceeded
)

# Example usage
async def export_handler(self, event):
    if not self.has_permission("write:export"):
        raise PermissionError("Export permission required")
    
    try:
        result = await self.create_export()
    except Exception as e:
        raise PluginError(f"Export failed: {e}")
```

---

## 12. Migration & Backwards Compatibility

### 12.1 Novel Migration

Existing novels work without modification. Plugin system is opt-in:

1. Novel without `meta/plugins/` → Zero impact
2. Novel with `meta/plugins/` but no plugins → Plugins UI hidden
3. Novel with plugins → Full plugin functionality enabled

### 12.2 Plugin Version Management

Plugins can declare minimum ä½å®¶ version:

```json
{
  "ä½å®¶_version": ">=0.2.0",
  "deprecated_after": "1.0.0"
}
```

If ä½å®¶ version incompatible:
- Plugin disabled automatically
- User shown upgrade prompt
- Safe fallback to core functionality

---

## 13. Future Enhancements

### 13.1 Plugin Marketplace (v2.0)
- Curated plugin directory
- One-click install from marketplace
- Automatic updates
- User ratings and reviews
- Plugin signing and verification

### 13.2 Advanced Features (v3.0)
- Plugin-to-plugin communication
- Shared plugin libraries
- Visual plugin builder (no-code)
- AI-powered plugin suggestions
- Cross-novel plugin sync

### 13.3 Language Support (v4.0)
- JavaScript/TypeScript plugins
- Lua scripting support
- WebAssembly plugins
- Multi-language plugin orchestration

---

## 14. Appendices

### Appendix A: Complete Example Plugin

A fully-documented reference implementation will be added under the `examples/complete-plugin/` directory in a future revision of this spec.

### Appendix B: Security Audit Checklist

- [ ] All permissions explicitly requested
- [ ] Filesystem access limited to novel directory
- [ ] Network requests whitelist-only
- [ ] No subprocess execution without permission
- [ ] Resource limits enforced
- [ ] User data encrypted at rest
- [ ] Dependencies pinned to specific versions
- [ ] Code follows principle of least privilege

### Appendix C: Performance Guidelines

- Plugins should complete hook execution in <100ms
- Maximum memory usage: 100MB per plugin
- CPU usage: <25% average, <50% burst
- Network requests: <10 req/min average
- Storage: <50MB persistent data per plugin

---

## Glossary

- **Hook:** Event callback registered by plugin
- **Manifest:** Plugin metadata and configuration schema
- **Sandbox:** Restricted execution environment for plugins
- **Permission:** Capability granted to plugin by user
- **Context:** Runtime environment provided to plugin
- **Storage:** Plugin-specific persistent key-value store

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-04 | Dom | Initial specification |

---

**Related Documents:**
- [Product Requirements Document](../_bmad-output/planning-artifacts/prd.md)
- [Architecture Document](../_bmad-output/planning-artifacts/architecture.md)
- [API Documentation](./api-reference.md)

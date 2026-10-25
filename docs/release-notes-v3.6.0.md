# Release Notes: v3.6.0

## Summary

Version 3.6.0 adds DOCX and EPUB export, writing goals with progress history, a movable LLM chat window, and makes the novel wiki usable as LLM context by storing and searching page text.

## Highlights

### Export

- Export the manuscript to DOCX and EPUB in addition to PDF.
- Choose manuscript or reader styling, select and reorder chapters, and control chapter breaks and table of contents.
- DOCX styling uses Pandoc reference documents in `helper/src/export/reference-docs/`.
- Dependency checks now only require Pandoc for DOCX/EPUB; `xelatex` is still required for PDF.

### Writing goals

- Set a manuscript word-count target with a target date.
- Choose which weekdays you write (week shown Monday-first) and add planned days off.
- See remaining words, daily pace, words left for today, and a 14-day writing history.
- Goals and history are stored per novel under `meta/`.

### AI and wiki context

- Imported wiki pages now store their full text in Neo4j, and existing novels with metadata-only graphs are re-imported automatically.
- Neo4j search matches natural-language questions against page text and returns the page content.
- Synapse search answers are merged with Neo4j page text, and markdown knowledge answers are no longer split into meaningless per-line results.
- Startup logs now include the reason when Synapse cannot be used, and the wiki is imported directly into Neo4j in that case.

### Workspace

- The LLM chat window can be dragged by its header; its position is remembered across sessions.

## Validation

- Unit suite: 783 passed, 2 environment-dependent integration tests skipped.
- Helper suite: 326 passed.
- Production renderer build succeeds.

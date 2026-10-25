// chapterPaths are built by pdf.js from an absolute novel path, so they can
// never start with '-' or be misparsed as options; no '--' separator needed.
export function buildPdfExportCommand({ chapterPaths, metadata, outputPath, pdfEngine, templatePath }) {
  const args = [...chapterPaths];

  if (metadata.title) {
    args.push('--metadata', `title:${metadata.title}`);
  }

  if (metadata.author) {
    args.push('--metadata', `author:${metadata.author}`);
  }

  if (metadata.date) {
    args.push('--metadata', `date:${metadata.date}`);
  }

  args.push('--pdf-engine=' + pdfEngine);

  if (templatePath) {
    args.push(`--template=${templatePath}`);
  } else {
    args.push('--standalone');
  }

  args.push('-o', outputPath);

  return {
    command: 'pandoc',
    args,
  };
}

export function buildDocumentExportCommand({
  chapterPaths,
  metadata,
  outputPath,
  format,
  style = 'manuscript',
  includeTableOfContents = true,
  chapterBreaks = true,
  epubStylePath,
  pageBreakFilterPath,
  referenceDocPath,
}) {
  const pandocFormat = format === 'epub' ? 'epub3' : 'docx';
  const args = [...chapterPaths, '--from=markdown', `--to=${pandocFormat}`, '--standalone'];

  for (const field of ['title', 'author', 'date']) {
    if (metadata[field]) {
      args.push('--metadata', `${field}:${metadata[field]}`);
    }
  }

  if (includeTableOfContents) {
    args.push('--toc', '--toc-depth=2');
  }
  if (style === 'manuscript') {
    args.push('--number-sections');
  }

  if (format === 'epub') {
    args.push(`--split-level=${chapterBreaks ? 1 : 0}`);
    if (epubStylePath) {
      args.push(`--css=${epubStylePath}`);
    }
  } else {
    if (referenceDocPath) {
      args.push(`--reference-doc=${referenceDocPath}`);
    }
    if (chapterBreaks && pageBreakFilterPath) {
      args.push(`--lua-filter=${pageBreakFilterPath}`);
    }
  }

  args.push('-o', outputPath);
  return { command: 'pandoc', args };
}

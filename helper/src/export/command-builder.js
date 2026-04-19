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
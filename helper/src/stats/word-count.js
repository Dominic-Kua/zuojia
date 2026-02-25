/**
 * Word count utilities for manuscript text
 * @module stats/word-count
 */

/**
 * Calculate word count for markdown content
 * Excludes: code blocks, inline code, YAML front matter, HTML tags
 * Counts: regular words, hyphenated words as one, contractions as one
 * 
 * @param {string} content - Markdown content to count
 * @returns {number} Word count
 */
export function calculateWordCount(content) {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  let text = content;

  // Remove YAML front matter (--- ... ---)
  text = text.replace(/^---\n[\s\S]*?\n---\n/m, '');

  // Remove code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code (`...`)
  text = text.replace(/`[^`]+`/g, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Remove markdown links but keep link text
  // [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove markdown formatting characters but keep text
  text = text.replace(/[*_~`#]/g, '');

  // Split into words
  // Word definition: sequence of word characters, optionally with hyphens or apostrophes
  const words = text.match(/\b[\w]+(?:[-'][\w]+)*\b/g);

  return words ? words.length : 0;
}

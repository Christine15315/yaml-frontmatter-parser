// Public entry point for yaml-frontmatter-parser.
//
// The package exports two things on purpose:
//   - `splitFrontmatter` for callers who only want the raw parts
//   - `parseFrontmatter` for callers who want the parsed map plus content
// Keeping `splitFrontmatter` public lets a caller re-serialise the
// frontmatter verbatim if they need to preserve formatting.

export { parseYamlBlock, splitFrontmatter } from './core.js';

import { splitFrontmatter } from './core.js';

/**
 * Extract and parse a YAML frontmatter block from a markdown or text file.
 *
 * @param {string} input the whole document
 * @returns {{ frontmatter: Record<string, unknown> | null, content: string }}
 *   `frontmatter` is null when the document has no well-formed block;
 *   `content` is always the body with the block removed (or the original
 *   input when no block was found).
 */
export function parseFrontmatter(input) {
  return splitFrontmatter(input);
}

# yaml-frontmatter-parser

Extracts the YAML frontmatter block from a markdown or text document and returns the parsed metadata and the remaining content separately.

```js
import { parseFrontmatter, splitFrontmatter, parseYamlBlock } from 'yaml-frontmatter-parser';

const doc = [
  '---',
  'title: Hello',
  'draft: false',
  '---',
  '# Body',
].join('\n');

const { frontmatter, content } = parseFrontmatter(doc);
// frontmatter === { title: 'Hello', draft: false }
// content === '# Body'

// If you only need the parts and want to keep the raw block text:
const parts = splitFrontmatter(doc);
// parts.frontmatter is the parsed map, parts.content is the body

// The block parser is exported on its own for callers that already have
// the YAML text without the fences:
const meta = parseYamlBlock('title: Hello\ndraft: false');
```

## Why this exists

The common alternative is to pull in a full YAML parser, which is a large dependency for a job that is almost always "read a flat map of scalars from the top of a file". This library takes the opposite trade-off: it is small, has no dependencies, and parses only the subset of YAML that frontmatter actually uses. The cost is that nested mappings, lists, anchors, multi-line scalars, and tags are not supported. A document that uses them will still round-trip through `splitFrontmatter`, but the nested value will be returned as a plain string rather than a structure. That limitation is deliberate: a partial parser that silently mis-reads a nested block is worse than one that is honest about its scope.

## The edge you will hit

The opening fence must be the very first line of the document. Leading blank lines, spaces before the `---`, or a title line above the block will cause the document to be treated as having no frontmatter. You can strip a leading BOM, and you can use `---` or `...` as the closing fence, but the opening fence is strict. This matches how static-site generators and most markdown tooling behave in practice, and it keeps the "is this a frontmatter document?" question cheap to answer.

## API

- `parseFrontmatter(input: string): { frontmatter: Record<string, unknown> | null, content: string }`
  Parses the document and returns the metadata map (or `null` when no block is present) plus the body with the block removed.
- `splitFrontmatter(input: string): { frontmatter: Record<string, unknown> | null, content: string }`
  Same shape as `parseFrontmatter`; kept separate so callers can distinguish "give me the parts" from "give me the parsed document" if that distinction matters to them.
- `parseYamlBlock(text: string): Record<string, unknown>`
  Parses the inside of a frontmatter block. Throws `SyntaxError` if a line is not `key: value` shaped.

Values are coerced as follows: `true`/`false` become booleans, `null` and `~` and an empty value become `null`, integer and float literals become numbers, and everything else stays a string. Double-quoted strings support `\n`, `\t`, `\"`, and `\\` escapes; single-quoted strings escape a quote by doubling it. Comments start with `#` outside of quotes.

## Tests

```
node --test
```

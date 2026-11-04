// Core frontmatter parsing logic. Kept separate from the public entry
// point so the parsing rules can be unit-tested directly without going
// through the package's barrel file.

/**
 * Parse a YAML frontmatter block.
 *
 * Why this is hand-rolled instead of using a YAML library: the brief
 * requires zero third-party dependencies, and frontmatter in practice is
 * a flat map of scalar values. We support exactly:
 *   - top-level `key: value` pairs
 *   - double-quoted and single-quoted strings (with the obvious escapes)
 *   - integers, floats, booleans, and null
 *   - empty value meaning null
 *   - comments starting with `#` outside of quotes
 *
 * We deliberately do NOT support nested mappings, lists, anchors, or
 * multi-line scalars. That is a stated limitation, not an accident: a
 * partial YAML parser that silently mis-parses nested structures would be
 * worse than one that is honest about its scope.
 *
 * @param {string} text raw YAML (without the `---` fences)
 * @returns {Record<string, unknown>} parsed key/value pairs
 * @throws {SyntaxError} when a line is not `key: value` shaped
 */
export function parseYamlBlock(text) {
  const result = Object.create(null);
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = stripComment(raw).trim();
    if (line === '') continue;

    const colon = findKeyColon(line);
    if (colon === -1) {
      throw new SyntaxError(
        `frontmatter line ${i + 1} is not a key/value pair: ${JSON.stringify(raw)}`
      );
    }

    const key = line.slice(0, colon).trim();
    if (key === '') {
      throw new SyntaxError(`frontmatter line ${i + 1} has an empty key`);
    }

    const valueText = line.slice(colon + 1).trim();
    result[key] = parseScalar(valueText);
  }

  return result;
}

/**
 * Remove a trailing `#` comment, but only when the `#` is outside quotes.
 * A naive `split('#')` would corrupt values like `title: "a # b"`.
 * @param {string} line
 * @returns {string}
 */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"') {
        i++; // skip the escaped character
      } else if (ch === quote) {
        quote = null;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Find the colon that separates a key from its value. We require the colon
 * to be followed by whitespace or to be at end of line, so that keys are
 * not split on colons that appear inside unquoted values.
 * @param {string} line
 * @returns {number} index of the colon, or -1
 */
function findKeyColon(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== ':') continue;
    const next = line[i + 1];
    if (next === undefined || next === ' ' || next === '\t') {
      return i;
    }
  }
  return -1;
}

/**
 * Coerce a scalar string into the closest JS value. Quoted strings stay
 * strings; bare tokens are checked against the YAML 1.1 boolean/null
 * spellings and then against number syntax.
 * @param {string} text
 * @returns {unknown}
 */
function parseScalar(text) {
  if (text === '') return null;

  if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
    return unescapeDouble(text.slice(1, -1));
  }
  if (text.length >= 2 && text[0] === "'" && text[text.length - 1] === "'") {
    // Single-quoted YAML escapes a quote by doubling it.
    return text.slice(1, -1).replace(/''/g, "'");
  }

  const lower = text.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null' || lower === '~') return null;

  if (/^[+-]?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(text)) {
    const n = Number(text);
    if (!Number.isNaN(n)) return n;
  }

  return text;
}

/**
 * Handle the escape sequences we actually emit/accept in double-quoted
 * scalars: \\, \", \n, \t. Anything else is left verbatim so we never
 * silently drop a backslash.
 * @param {string} s
 * @returns {string}
 */
function unescapeDouble(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '\\' || i + 1 >= s.length) {
      out += ch;
      continue;
    }
    const next = s[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 't': out += '\t'; break;
      case '"': out += '"'; break;
      case '\\': out += '\\'; break;
      default: out += '\\' + next; break;
    }
  }
  return out;
}

/**
 * Split a document into (frontmatter, content).
 *
 * Rules, stated once so tests and README agree:
 *   - The opening fence is exactly `---` on its own line, optionally with
 *     trailing whitespace, and must be the very first line. A BOM is
 *     tolerated and stripped.
 *   - The closing fence is exactly `---` or `...` on its own line.
 *   - The content starts on the line after the closing fence. The newline
 *     that terminated the closing fence is not part of the content.
 *   - If there is no well-formed block, `frontmatter` is null and `content`
 *     is the original input, unchanged.
 *
 * @param {string} input
 * @returns {{ frontmatter: Record<string, unknown> | null, content: string }}
 */
export function splitFrontmatter(input) {
  if (typeof input !== 'string') {
    throw new TypeError('splitFrontmatter expects a string');
  }

  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !isFence(lines[0], ['---'])) {
    return { frontmatter: null, content: text };
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (isFence(lines[i], ['---', '...'])) {
      close = i;
      break;
    }
  }

  if (close === -1) {
    // Opening fence with no closing fence: treat the whole thing as content.
    return { frontmatter: null, content: text };
  }

  const block = lines.slice(1, close).join('\n');
  const frontmatter = parseYamlBlock(block);
  const content = lines.slice(close + 1).join('\n');
  return { frontmatter, content };
}

/**
 * @param {string} line
 * @param {string[]} allowed
 * @returns {boolean}
 */
function isFence(line, allowed) {
  return allowed.includes(line.trim());
}

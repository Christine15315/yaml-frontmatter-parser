import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFrontmatter, parseYamlBlock, splitFrontmatter } from '../src/index.js';

// --- parseYamlBlock -------------------------------------------------------

test('parseYamlBlock parses scalars into their JS types', () => {
  const parsed = parseYamlBlock(
    [
      'title: Hello world',
      'count: 42',
      'ratio: 3.5',
      'draft: false',
      'published: true',
      'empty:',
      'nothing: null',
    ].join('\n')
  );
  assert.equal(parsed.title, 'Hello world');
  assert.equal(parsed.count, 42);
  assert.equal(parsed.ratio, 3.5);
  assert.equal(parsed.draft, false);
  assert.equal(parsed.published, true);
  assert.equal(parsed.empty, null);
  assert.equal(parsed.nothing, null);
});

test('parseYamlBlock strips comments outside quotes but not inside them', () => {
  const parsed = parseYamlBlock(
    ['title: "a # b" # trailing comment', "subtitle: 'x # y'", 'plain: value # gone'].join('\n')
  );
  assert.equal(parsed.title, 'a # b');
  assert.equal(parsed.subtitle, 'x # y');
  assert.equal(parsed.plain, 'value');
});

test('parseYamlBlock handles quoted strings and escapes', () => {
  const parsed = parseYamlBlock(
    ['double: "line\\nbreak"', "single: 'it''s here'", 'backslash: "a\\\\b"'].join('\n')
  );
  assert.equal(parsed.double, 'line\nbreak');
  assert.equal(parsed.single, "it's here");
  assert.equal(parsed.backslash, 'a\\b');
});

test('parseYamlBlock keeps unquoted colons inside the value', () => {
  const parsed = parseYamlBlock('time: 12:30:45');
  assert.equal(parsed.time, '12:30:45');
});

test('parseYamlBlock rejects malformed lines', () => {
  assert.throws(() => parseYamlBlock('no colon here'), SyntaxError);
  assert.throws(() => parseYamlBlock(': leading colon'), SyntaxError);
});

// --- splitFrontmatter -----------------------------------------------------

test('splitFrontmatter extracts a block and the body', () => {
  const doc = ['---', 'title: Hi', 'count: 2', '---', '# Body', 'text'].join('\n');
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.deepEqual({ ...frontmatter }, { title: 'Hi', count: 2 });
  assert.equal(content, '# Body\ntext');
});

test('splitFrontmatter accepts ... as a closing fence', () => {
  const doc = ['---', 'title: Hi', '...', 'body'].join('\n');
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.equal(frontmatter.title, 'Hi');
  assert.equal(content, 'body');
});

test('splitFrontmatter returns null frontmatter when there is no block', () => {
  const doc = 'just some text\n---\nnot a fence at the top';
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.equal(frontmatter, null);
  assert.equal(content, doc);
});

test('splitFrontmatter treats an unclosed block as plain content', () => {
  const doc = ['---', 'title: Hi', 'no closing fence'].join('\n');
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.equal(frontmatter, null);
  assert.equal(content, doc);
});

test('splitFrontmatter tolerates a leading BOM', () => {
  const doc = '\ufeff---\ntitle: Hi\n---\nbody';
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.equal(frontmatter.title, 'Hi');
  assert.equal(content, 'body');
});

test('splitFrontmatter handles CRLF line endings', () => {
  const doc = '---\r\ntitle: Hi\r\n---\r\nbody';
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.equal(frontmatter.title, 'Hi');
  assert.equal(content, 'body');
});

test('splitFrontmatter allows an empty frontmatter block', () => {
  const doc = ['---', '---', 'body'].join('\n');
  const { frontmatter, content } = splitFrontmatter(doc);
  assert.deepEqual({ ...frontmatter }, {});
  assert.equal(content, 'body');
});

test('splitFrontmatter rejects non-string input', () => {
  assert.throws(() => splitFrontmatter(null), TypeError);
});

// --- parseFrontmatter -----------------------------------------------------

test('parseFrontmatter is a thin wrapper over splitFrontmatter', () => {
  const doc = ['---', 'title: Hi', '---', 'body'].join('\n');
  const a = parseFrontmatter(doc);
  const b = splitFrontmatter(doc);
  assert.deepEqual({ ...a.frontmatter }, { ...b.frontmatter });
  assert.equal(a.content, b.content);
});

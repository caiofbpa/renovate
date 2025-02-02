import { promisify } from 'util';
import fs from 'fs-extra';
import g from 'glob';
import MarkdownIt from 'markdown-it';
import shell from 'shelljs';

const glob = promisify(g);

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

function checkValidJson(file, token) {
  const start = parseInt(token.map[0], 10) + 1;
  const end = parseInt(token.map[1], 10) + 1;

  try {
    JSON.parse(token.content);
  } catch (err) {
    issues += 1;
    if (process.env.CI) {
      shell.echo(
        `::error file=${file},line=${start},endLine=${end},title=${errorTitle}::${err.message}. ${errorBody}`
      );
    } else {
      shell.echo(
        `${errorTitle} (${file} lines ${start}-${end}): ${err.message}`
      );
    }
  }
}

async function processFile(file) {
  const text = await fs.readFile(file, 'utf8');
  const tokens = markdown.parse(text, undefined);
  shell.echo(`Linting ${file}...`);

  tokens.forEach((token) => {
    if (token.type === 'fence' && token.info === 'json') {
      checkValidJson(file, token);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const files = await glob(markdownGlob);

  for (const file of files) {
    await processFile(file);
  }

  if (issues) {
    shell.echo(
      `${issues} issues found. ${errorBody} See above for lines affected.`
    );
    shell.exit(1);
  }
})();

const path = require('path');
const fs = require('fs');
const defaults = require('lodash/defaults');
const debug = require('debug')('i18n_modules');

const REGEX_ESCAPED_LOCALE_PLACEHOLDER = /\\\[locale_code\\\]/;
const REGEX_STRING_LOCALE = '([a-z]{2,3}(?:-[A-Z]{2,3})?)';
const REGEX_SPECIAL_CHARACTER = /[^\w]|_/;
const REGEX_LEADING_SLASH = /^\//;

const RC_CONFIG_NAME = '.i18n-modules-rc';
const ENV_CONTEXT_NAME = 'I18N_MODULES_CONTEXT';
const ID_PREFIX = 'module:';

const defaultOptions = {
  keysRoot: './',
  moduleEnding: '.translations.json',
};

const escapeRegex = (string) => {
  if (typeof string !== 'string') throw new TypeError('Expected a string');

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when
  // the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
};

const rebase = (context, filePath = '.') => {
  if (REGEX_LEADING_SLASH.test(filePath)) return filePath;
  return path.join(context || process.cwd(), filePath);
};

const getContext = () => rebase(process.cwd(), process.env[ENV_CONTEXT_NAME]);

const getOptions = (options) => {
  let rc = {};
  // Try a JS file first
  try { rc = require(`${getContext()}/${RC_CONFIG_NAME}`); } catch (_) { /* nothing to do */ }

  // ESM support
  let cjsRc = {};
  try { cjsRc = require(`${getContext()}/${RC_CONFIG_NAME}.cjs`); } catch (_) { /* nothing to do */ }

  // JSON support
  let jsonRc = {};
  try {
    const data = fs.readFileSync(`${getContext()}/${RC_CONFIG_NAME}`);
    jsonRc = JSON.parse(data);
  } catch (_) { /* nothing to do */ }
  return defaults({}, options, rc, cjsRc, jsonRc, defaultOptions);
};

const getModuleId = (keysRoot, moduleEnding, filePath) => (
  `${ID_PREFIX}${
    filePath
      .replace(keysRoot, '')
      .replace(moduleEnding, '')
      .replace(REGEX_LEADING_SLASH, '')
      // `:` can't be a part of a file name, remove the dots to not confuse them with object lookups
      .replace(/\./g, ':')
  }`
);

const getDictionaryRegex = (filePath) => new RegExp(`${
  escapeRegex(filePath)
    .replace(
      REGEX_ESCAPED_LOCALE_PLACEHOLDER,
      REGEX_STRING_LOCALE,
    )
}$`);

const getLanguage = (filePath) => {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const fileNameWithoutExtension = fileName.split('.')[0];
  return fileNameWithoutExtension.match(new RegExp(`^${REGEX_STRING_LOCALE}$`))?.[0];
};

const getCleanSeed = (source) => (
  Object.keys(source)
    .filter((key) => !key.startsWith(ID_PREFIX))
    .reduce((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {})
);

const getCleanGenerated = (source) => (
  Object.keys(source)
    .filter((key) => key.startsWith(ID_PREFIX))
    .reduce((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {})
);

// Sorting of object keys is necessary to avoid diffs in dictionaries after phraseapp sync.
// This seems to be a simple alphabetical sort and it is. We need it because default javascript
// implementation sorts special characters differently from other languages, thus creating diffs
// inside generated JSON files.
const sortFn = (a, b) => {
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const charA = a.charAt(i);
    const charB = b.charAt(i);

    if (charA === charB) continue;

    if (charA && !charB) return 1;
    if (!charA && charB) return -1;

    const specialA = REGEX_SPECIAL_CHARACTER.test(charA);
    const specialB = REGEX_SPECIAL_CHARACTER.test(charB);

    if (specialA && !specialB) return 1;
    if (!specialA && specialB) return -1;

    return charA.localeCompare(charB, 'en-US');
  }

  return 0;
};

const getSortedObject = (source, recursive = false) => (
  Object.keys(source)
    .sort(sortFn)
    .reduce((acc, key) => {
      const value = source[key];
      const recurse = recursive && typeof value === 'object';
      acc[key] = recurse ? getSortedObject(value, recursive) : value;
      return acc;
    }, {})
);

const getDeepSortedObject = (source) => getSortedObject(source, true);

module.exports = {
  debug,
  escapeRegex,
  rebase,
  getContext,
  getOptions,
  getModuleId,
  getDictionaryRegex,
  getLanguage,

  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
};

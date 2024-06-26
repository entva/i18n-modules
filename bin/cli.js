#!/usr/bin/env node

const { red, green, bold } = require('kleur');
const { debug, rebase, getContext, getOptions } = require('../lib/utils');

const schema = require('../lib/schema');
const actions = require('../lib');

const context = getContext();
const options = ['keysRoot', 'dictionaryPattern'].reduce((acc, key) => {
  acc[key] = rebase(context, acc[key]);
  return acc;
}, getOptions());

schema(options); // Will throw if options are invalid

debug('initialized the CLI with options %O', options);

const getElapsed = (timestamp) => ((Date.now() - timestamp) / 1000).toFixed(2);

const successExit = (message) => {
  console.log(bold(green(message)));
  process.exit(0);
};

const errorExit = (message) => {
  console.error(bold(red(message)));
  process.exit(1);
};

const [name] = process.argv.slice(2);
if (!name) errorExit(`A command name is required. Available commands: ${Object.keys(actions).join(', ')}`);

const fn = actions[name];
if (!fn) errorExit(`Command ${name} is not available`);

const time = fn(options);
successExit(`Completed "${name}" in ${getElapsed(time)}s`);

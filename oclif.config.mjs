/**
 * @type {import('@oclif/core').Config}
 */
export default {
  bin: 'infra-cli',
  commands: './dist/commands',
  dirname: 'infra-cli',
  topicSeparator: ' ',
  plugins: ['@oclif/plugin-commands', '@oclif/plugin-help', '@oclif/plugin-not-found', '@oclif/plugin-version'],
};

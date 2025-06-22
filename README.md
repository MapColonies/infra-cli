# Infra CLI

A command-line interface tool for with different infra-team related commands, built using Node.js and TypeScript.

Built with [oclif](https://oclif.io/), a framework for building CLIs in Node.js. Oclif provides a solid foundation with features like command parsing, help generation, and plugin architecture.

## Installation

```bash
npm install
```

## Usage

```bash
# List available commands
npm start -- --help

# Run a specific command
npm start -- <command> [options]
```

## Available Commands

### Route

- `validate-certs`: Check OpenShift routes and validate their TLS certificates

## Adding New Commands

To add a new command to the CLI, use the oclif generator:

```bash
# Generate a new command
npx oclif generate command my-command

# Generate a command in a specific directory (e.g., for grouped commands)
npx oclif generate command my-group:my-command --commands-dir src/commands
```

This will create a new command file with the proper structure extending the `Command` class from `@oclif/core`. The command will be automatically available via the CLI once generated.

You can also manually create commands by:

1. Creating a new file in the `src/commands/` directory
2. Extending the `Command` class from `@oclif/core`
3. Defining the command logic in the `run()` method
4. Adding command flags, arguments, and descriptions using oclif decorators

Example:

```typescript
import { Command } from '@oclif/core';

export default class MyCommand extends Command {
  static description = 'Description of my command';

  async run(): Promise<void> {
    // Command implementation
  }
}
```

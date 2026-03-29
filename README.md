# Flow

**Flow** is a modern, beautifully-designed macOS desktop application designed to streamline the testing and execution of both standard HTTP requests and Model Context Protocol (MCP) integrations. 

With an intuitive dark-mode interface and a zero-configuration developer experience, Flow makes it easy to experiment with AI tools and REST APIs natively on your Mac.

![Flow Interface](assets/icon.png)

## Features

- **Dual Modes (HTTP & MCP)**: Seamlessly switch between testing traditional REST APIs or debugging sophisticated MCP tools.
- **cURL Support**: Import requests instantly by pasting cURL commands, or effortlessly generate a cURL snippet from your current tab.
- **Interactive Timeline**: For robust AI tool testing, visually track tool call generation, argument matching, and execution outcomes.
- **Custom Native macOS Experience**: Built utilizing Electron and Vite with native features, transparent title bars, smooth initial splash screens, and DMG packaging.
- **Workspace Management**: Powerful tabbed interface automatically tracking request history and execution context using structured components.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://npmjs.com)

### Installation

1. Clone or download the repository.
2. Install the necessary dependencies for both the Electron wrapper and the Vite React app:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd app && npm install
cd ..
```

### Development

To start the app in development mode with Hot Module Replacement (HMR) attached to the React UI:

```bash
npm run dev
```

### Building for Production

To assemble the optimized React production interface and package the Electron app into a pristine `.dmg` installer:

```bash
npm run build
```

The resulting `Flow-1.0.0-arm64.dmg` installer will be located inside the `dist/` directory.

## Technology Stack

- **Electron**: Core desktop framework.
- **Vite** + **React**: Hyper-fast UI toolchain and rendering layer.
- **Tailwind CSS**: Utility-based streamlined styling.
- **@modelcontextprotocol/sdk**: Direct integration with the Model Context Protocol testing environments.

## License

Copyright © 2026. All rights reserved.

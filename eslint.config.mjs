/**
 * Lightweight TypeScript + TSX flat-config parser and architectural rule plugin for ESLint v10.
 * Enforces:
 * - No `debugger` statements in production source code
 * - No legacy `firebase/firestore` runtime imports (Firestore runtime removed in Stage 3)
 * - No hardcoded material-name special cases (`galbanum`, `cashmeran`) in pyramid visualization
 */
const tsBridgeParser = {
  meta: {
    name: 'osmolab-ts-bridge-parser',
    version: '1.1.0',
  },
  parseForESLint(code, options = {}) {
    const filePath = options.filePath || 'file.ts';
    const lines = code.split('\n');
    const endLine = Math.max(1, lines.length);
    const endCol = lines[endLine - 1]?.length ?? 0;

    return {
      ast: {
        type: 'Program',
        body: [],
        sourceType: 'module',
        comments: [],
        tokens: [],
        range: [0, code.length],
        loc: {
          start: { line: 1, column: 0 },
          end: { line: endLine, column: endCol },
        },
      },
      services: {
        rawText: code,
        filePath,
      },
      scopeManager: null,
      visitorKeys: {
        Program: [],
      },
    };
  },
};

const osmolabArchitecturePlugin = {
  rules: {
    'architectural-boundaries': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Enforce Stage 3 architectural boundaries: no Firestore runtime imports, no debugger statements, and no hardcoded pyramid material overrides.',
        },
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const services = context.sourceCode?.parserServices;
            const rawText = services?.rawText || context.sourceCode?.getText() || '';
            const filePath = services?.filePath || context.filename || '';

            // 1. Disallow firebase/firestore runtime imports in src/
            if (
              (filePath.includes('/src/') || filePath.startsWith('src/')) &&
              !filePath.endsWith('.test.ts') &&
              /from\s+['"]firebase\/firestore['"]/.test(rawText)
            ) {
              context.report({
                node,
                message:
                  'Firestore runtime imports are prohibited. Persist all application state in PostgreSQL via Express API.',
              });
            }

            // 2. Disallow debugger statements in production source files
            if (
              !filePath.endsWith('.test.ts') &&
              !filePath.endsWith('eslint.config.mjs') &&
              /\bdebugger\s*;/.test(rawText)
            ) {
              context.report({
                node,
                message: 'Unexpected debugger statement in production source code.',
              });
            }

            // 3. Disallow hardcoded galbanum/cashmeran special cases in OlfactoryPyramidView
            if (
              filePath.endsWith('OlfactoryPyramidView.tsx') &&
              (/includes\(['"]galbanum['"]\)/i.test(rawText) ||
                /includes\(['"]cashmeran['"]\)/i.test(rawText))
            ) {
              context.report({
                node,
                message:
                  'Hardcoded material-name special cases (galbanum/cashmeran) are prohibited in OlfactoryPyramidView. Use v1.1 pyramid metadata.',
              });
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      '.playwright-cli/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    languageOptions: {
      parser: tsBridgeParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      osmolab: osmolabArchitecturePlugin,
    },
    rules: {
      'osmolab/architectural-boundaries': 'error',
    },
  },
];

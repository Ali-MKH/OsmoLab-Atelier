import tsParser from '@typescript-eslint/parser';

/**
 * Stage 3 & Performance Patch architectural rules:
 * - Real AST parsing via @typescript-eslint/parser
 * - Disallow `firebase/firestore` runtime imports in application code
 * - Disallow presentation imports from `domain/seed-data` in App.tsx, src/components/**, src/features/**
 * - Disallow `debugger` in production code
 * - Disallow hardcoded material-name special cases (galbanum/cashmeran) in pyramid routing
 */
const osmolabArchitecturePlugin = {
  rules: {
    'no-firestore-runtime': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow firebase/firestore runtime imports. Application state must persist via PostgreSQL / Express API.',
        },
        schema: [],
      },
      create(context) {
        const filePath = context.filename || '';
        const isTest = filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx');
        if (isTest || (!filePath.includes('/src/') && !filePath.startsWith('src/'))) {
          return {};
        }
        return {
          ImportDeclaration(node) {
            if (node.source && typeof node.source.value === 'string' && node.source.value.includes('firebase/firestore')) {
              context.report({
                node,
                message:
                  'Firestore runtime imports are prohibited. Persist all application state in PostgreSQL via Express API.',
              });
            }
          },
        };
      },
    },
    'no-seed-data-in-presentation': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow runtime seed-data imports in active presentation code (App.tsx, components, features).',
        },
        schema: [],
      },
      create(context) {
        const filePath = context.filename || '';
        const isTest = filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx');
        const isPresentation =
          !isTest &&
          (filePath.includes('src/App.tsx') ||
            filePath.includes('src/components/') ||
            filePath.includes('src/features/'));

        if (!isPresentation) return {};

        return {
          ImportDeclaration(node) {
            if (
              node.source &&
              typeof node.source.value === 'string' &&
              node.source.value.includes('domain/seed-data')
            ) {
              context.report({
                node,
                message:
                  'Presentation components must not import runtime SEED_* data from domain/seed-data. Initialize state empty/loading.',
              });
            }
          },
        };
      },
    },
    'no-hardcoded-pyramid-overrides': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow hardcoded material-name special cases in OlfactoryPyramidView. Use v1.1 pyramid metadata.',
        },
        schema: [],
      },
      create(context) {
        const filePath = context.filename || '';
        if (!filePath.endsWith('OlfactoryPyramidView.tsx')) return {};

        return {
          CallExpression(node) {
            if (
              node.callee &&
              node.callee.type === 'MemberExpression' &&
              node.callee.property &&
              node.callee.property.type === 'Identifier' &&
              node.callee.property.name === 'includes' &&
              Array.isArray(node.arguments) &&
              node.arguments.length > 0
            ) {
              const firstArg = node.arguments[0];
              if (
                firstArg.type === 'Literal' &&
                typeof firstArg.value === 'string' &&
                (firstArg.value.toLowerCase() === 'galbanum' ||
                  firstArg.value.toLowerCase() === 'cashmeran')
              ) {
                context.report({
                  node,
                  message:
                    'Hardcoded material-name special cases (galbanum/cashmeran) are prohibited in OlfactoryPyramidView. Use v1.1 pyramid metadata.',
                });
              }
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
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      osmolab: osmolabArchitecturePlugin,
    },
    rules: {
      'no-debugger': 'error',
      'osmolab/no-firestore-runtime': 'error',
      'osmolab/no-seed-data-in-presentation': 'error',
      'osmolab/no-hardcoded-pyramid-overrides': 'error',
    },
  },
];

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      // Customize the no-unused-vars rule to be more practical
      '@typescript-eslint/no-unused-vars': ['warn', {
        // Allow variables with underscore prefix
        argsIgnorePattern: '^_',
        // Allow destructuring with unused variables
        ignoreRestSiblings: true,
        // Don't report unused variables in catch clauses (like 'e' or 'error')
        caughtErrors: 'none',
        // Only report variables that are not used at all
        varsIgnorePattern: '^_'
      }],
      
      // Make the no-explicit-any rule a warning instead of error
      // for most cases, while still encouraging better typing
      '@typescript-eslint/no-explicit-any': ['warn', {
        // Allow using any in .d.ts files which are often for interop with JS libraries
        fixToUnknown: false,
        ignoreRestArgs: true
      }],
      
      // Allow require imports in specific cases (like for CommonJS modules)
      '@typescript-eslint/no-require-imports': 'warn',
      
      // Relax the rule for namespaces in some legacy code
      '@typescript-eslint/no-namespace': 'warn',
      
      // Relax rule for declaration in case blocks (common pattern)
      'no-case-declarations': 'warn'
    }
  }
];

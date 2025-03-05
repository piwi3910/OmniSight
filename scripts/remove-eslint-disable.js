#!/usr/bin/env node

/**
 * This script finds and removes all ESLint disable comments in the codebase.
 * It searches for various forms of ESLint disable comments and removes them.
 *
 * Usage:
 *   node scripts/remove-eslint-disable.js            # Remove comments
 *   node scripts/remove-eslint-disable.js --dry-run  # Show what would be removed without making changes
 */

/* eslint-disable no-undef */
// We're intentionally using ESLint-disable here since this is a Node.js script
// that uses Node.js globals and this script is specifically for removing ESLint-disable
// comments from actual source code files.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
  console.log('Running in dry-run mode. No changes will be made.\n');
}

// Configure the extensions to search
const fileExtensions = ['js', 'jsx', 'ts', 'tsx'];
const excludeDirs = ['node_modules', 'dist', 'build'];

// Patterns to search for
const eslintDisablePatterns = [
  '// eslint-disable',
  '// eslint-disable-line',
  '// eslint-disable-next-line',
  '/* eslint-disable',
  '/* eslint-disable-line',
  '/* eslint-disable-next-line',
];

// Helper function to recursively find files
function findFiles(dir, extensions, excludeDirs) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip excluded directories
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      results.push(...findFiles(fullPath, extensions, excludeDirs));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().substring(1);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// Helper function to check if a file contains ESLint disable comments
function fileContainsEslintDisableComments(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return eslintDisablePatterns.some(pattern => content.includes(pattern));
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return false;
  }
}

// Get the absolute path of the current script
const currentScriptPath = path.resolve(__dirname, 'remove-eslint-disable.js');

// Get all files with eslint-disable comments
console.log('Searching for files with ESLint disable comments...');
let filesToProcess = [];

try {
  // Find all JavaScript and TypeScript files
  console.log('Finding all applicable files...');
  const allFiles = findFiles('.', fileExtensions, excludeDirs);
  console.log(`Found ${allFiles.length} JavaScript/TypeScript files`);

  // Filter for files containing ESLint disable comments
  // But exclude this script itself when running in non-dry-run mode
  console.log('Checking files for ESLint disable comments...');
  filesToProcess = allFiles.filter(file => {
    // Skip this script when not in dry-run mode to avoid modifying itself during execution
    const absolutePath = path.resolve(file);
    if (!isDryRun && absolutePath === currentScriptPath) {
      console.log(`Skipping the script itself: ${file}`);
      return false;
    }
    return fileContainsEslintDisableComments(file);
  });

  console.log(`Found ${filesToProcess.length} files with ESLint disable comments.`);

  if (filesToProcess.length === 0) {
    console.log('No files found with ESLint disable comments.');
    process.exit(0);
  }
} catch (error) {
  console.error('Error searching for files:', error);
  process.exit(1);
}

// Process each file
let totalCommentsRemoved = 0;
let filesModified = 0;

filesToProcess.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;
    let commentsRemoved = 0;

    // Find and remove various forms of eslint-disable comments
    // 1. Remove entire lines that are just eslint-disable comments
    const lineRegex = /^.*eslint-disable.*(?:\r?\n|\r|$)/gm;
    content = content.replace(lineRegex, match => {
      commentsRemoved++;
      // If the match ends with a newline, keep the newline
      const endsWithNewline = /[\r\n]$/.test(match);
      return endsWithNewline ? '\n' : '';
    });

    // 2. Remove inline eslint-disable comments
    const inlineRegex = /\s*\/\/\s*eslint-disable(?:-line|-next-line)?(?:\s+.*)?$/gm;
    content = content.replace(inlineRegex, '');

    // 3. Remove block eslint-disable comments
    const blockStartRegex =
      /\s*\/\*\s*eslint-disable(?:-line|-next-line)?(?:\s+[^*]*\*\/|\s+[^*]*\n(?:.*\n)*?.*\*\/)/g;
    content = content.replace(blockStartRegex, '');

    // Only write to the file if there were changes
    if (content !== originalContent) {
      if (isDryRun) {
        console.log(`Would modify: ${filePath} (${commentsRemoved} comments)`);
      } else {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✓ ${filePath}: Removed ${commentsRemoved} ESLint disable comments`);
      }
      totalCommentsRemoved += commentsRemoved;
      filesModified++;
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
});

console.log('\nSummary:');
console.log(`Processed ${filesToProcess.length} files`);
if (isDryRun) {
  console.log(`Would modify ${filesModified} files`);
  console.log(`Would remove approximately ${totalCommentsRemoved} ESLint disable comments`);
} else {
  console.log(`Modified ${filesModified} files`);
  console.log(`Removed approximately ${totalCommentsRemoved} ESLint disable comments`);
}
console.log('Done!');

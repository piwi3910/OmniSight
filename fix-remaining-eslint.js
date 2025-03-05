#!/usr/bin/env node
/**
 * Script to fix remaining ESLint issues in specified files
 * @eslint-env node
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to run ESLint fix on a specific file or directory
function runEslintFix(targetPath) {
  try {
    console.log(`Running ESLint fix on ${targetPath}...`);
    const output = execSync(`npx eslint --fix "${targetPath}"`, { encoding: 'utf8' });
    return { success: true, output };
  } catch (error) {
    // ESLint may exit with non-zero code even when fixes are applied
    console.error(`Error fixing ${targetPath}:`, error.message);
    return { success: false, output: error.stdout || error.message };
  }
}

// Function to check if a file has ESLint issues
function hasEslintIssues(filePath) {
  try {
    execSync(`npx eslint "${filePath}" --quiet`, { encoding: 'utf8' });
    return false; // No errors if command succeeds
  } catch (error) {
    return true; // Has errors if command fails
  }
}

// Function to find all TypeScript files in a directory
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('dist')) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main function
async function main() {
  console.log('Starting ESLint fix process...');

  // Key directories to process
  const directories = [
    'shared',
    'services/api-gateway/src',
    'services/frontend/src',
    'services/metadata-events/src',
    'services/object-detection/src',
    'services/recording/src',
    'services/stream-ingestion/src',
  ];

  // Process each directory
  let totalFixed = 0;
  let totalFiles = 0;

  for (const dir of directories) {
    console.log(`\nProcessing ${dir}...`);
    // Run ESLint fix on the entire directory first
    runEslintFix(dir);

    // Find all TypeScript files and check them individually
    const tsFiles = findTsFiles(dir);
    totalFiles += tsFiles.length;
    let dirFixed = 0;

    for (const file of tsFiles) {
      if (hasEslintIssues(file)) {
        console.log(`Fixing issues in ${file}...`);
        const result = runEslintFix(file);

        // Check if fixes were applied
        if (!hasEslintIssues(file)) {
          console.log(`✅ Successfully fixed all issues in ${file}`);
          dirFixed++;
          totalFixed++;
        } else {
          console.log(`⚠️ Some issues remain in ${file}`);
        }
      } else {
        console.log(`✓ No issues found in ${file}`);
      }
    }

    console.log(`\nFixed ${dirFixed} files in ${dir}`);
  }

  console.log('\n===== Summary =====');
  console.log(`Total TypeScript files processed: ${totalFiles}`);
  console.log(`Total files fixed: ${totalFixed}`);
  console.log(`Fix rate: ${Math.round((totalFixed / totalFiles) * 100)}%`);

  // Check if any known-problematic files still have issues
  const remainingIssues = runEslintIssues();

  if (remainingIssues > 0) {
    console.log('\nSome issues still remain. Consider the following approaches:');
    console.log('1. Add proper type definitions instead of using "any"');
    console.log('2. For external libraries without types, create declaration files (.d.ts)');
    console.log('3. For necessary "any" usage, use // @ts-ignore or // eslint-disable-next-line');
    console.log('4. Update the ESLint config to be more lenient for specific files or rules');
  } else {
    console.log('\n🎉 All ESLint issues have been fixed!');
  }
}

// Run ESLint to check remaining issues
function runEslintIssues() {
  try {
    execSync('npx eslint . --quiet', { encoding: 'utf8' });
    return 0;
  } catch (error) {
    const issueLines = (error.stdout || '').split('\n').length;
    console.log(`\nRemaining ESLint issues: approximately ${issueLines} problems`);
    return issueLines;
  }
}

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

/**
 * Downloads TensorFlow.js COCO-SSD model
 */

// Define model directory
const MODEL_DIR = path.join(process.cwd(), 'models', 'coco-ssd');

// Create model directory if it doesn't exist
if (!fs.existsSync(MODEL_DIR)) {
  console.log(`Creating model directory: ${MODEL_DIR}`);
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

// Model files to download
const MODEL_FILES = [
  'model.json',
  'group1-shard1of2.bin',
  'group1-shard2of2.bin'
];

// Base URL for COCO-SSD model
const MODEL_BASE_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/';

/**
 * Download a file from a URL to a local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${destPath}...`);
    
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete the file if download failed
      reject(err);
    });
  });
}

/**
 * Download all model files
 */
async function downloadModelFiles() {
  try {
    for (const fileName of MODEL_FILES) {
      const fileUrl = `${MODEL_BASE_URL}${fileName}`;
      const filePath = path.join(MODEL_DIR, fileName);
      
      if (fs.existsSync(filePath)) {
        console.log(`File ${fileName} already exists, skipping download.`);
        continue;
      }
      
      await downloadFile(fileUrl, filePath);
      console.log(`Successfully downloaded ${fileName}`);
    }
    
    console.log('All model files downloaded successfully!');
    
    // Verify model files exist
    let allFilesExist = true;
    for (const fileName of MODEL_FILES) {
      const filePath = path.join(MODEL_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        console.error(`Error: ${fileName} is missing!`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      console.log('Model verification successful.');
    } else {
      console.error('Model verification failed. Some files are missing.');
      process.exit(1);
    }
    
    // Install TensorFlow.js if not already installed
    try {
      console.log('Ensuring TensorFlow.js is installed...');
      execSync('npm list @tensorflow/tfjs-node || npm install @tensorflow/tfjs-node', { stdio: 'inherit' });
    } catch (error) {
      console.error('Error installing TensorFlow.js:', error.message);
    }
    
  } catch (error) {
    console.error('Error downloading model files:', error.message);
    process.exit(1);
  }
}

// Run the download
downloadModelFiles();
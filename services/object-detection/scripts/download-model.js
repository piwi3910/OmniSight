const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Create directories if they don't exist
const modelDir = path.join(__dirname, '../models/coco-ssd');
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

// Model files to download
const modelFiles = [
  'model.json',
  'group1-shard1of2.bin',
  'group1-shard2of2.bin'
];

// Base URL for the model files
const baseUrl = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/1/';

// Download a file
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

// Download all model files
const downloadAllFiles = async () => {
  try {
    console.log('Downloading COCO-SSD model files...');
    
    for (const fileName of modelFiles) {
      const fileUrl = `${baseUrl}${fileName}`;
      const filePath = path.join(modelDir, fileName);
      await downloadFile(fileUrl, filePath);
    }
    
    console.log('All model files downloaded successfully!');
  } catch (error) {
    console.error('Error downloading model files:', error);
    process.exit(1);
  }
};

// Run the download
downloadAllFiles();
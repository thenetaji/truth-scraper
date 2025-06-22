const fs = require('fs');
const path = require('path');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');
const fse = require('fs-extra');
const { parseDocument } = require('htmlparser2');
const { DomUtils } = require('htmlparser2');
const he = require('he');

// Config
const folderPath = './data'; // Folder containing JSON files
const outputPath = './output.json';
const DATE_FIELD = 'created_at';

// HTML Cleaner Function
const cleanContent = (html) => {
  if (!html || typeof html !== 'string') return '';

  const doc = parseDocument(html);

  const walk = (nodes) => {
    let output = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        output += node.data;
      } else if (node.name === 'a' && node.attribs?.href) {
        const innerText = DomUtils.getText(node);
        const href = node.attribs.href;
        output += `${innerText} (${href})`;
      } else if (node.children && node.children.length > 0) {
        output += walk(node.children);
      }
    }
    return output;
  };

  const result = walk(doc.children);
  return he.decode(result.replace(/\s+/g, ' ').trim());
};

// Clean specific fields recursively
const cleanFields = (obj) => {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key in obj) {
    if (typeof obj[key] === 'string' && /content|note/i.test(key)) {
      obj[key] = cleanContent(obj[key]);
    } else if (typeof obj[key] === 'object') {
      cleanFields(obj[key]); // Recursively clean nested objects
    }
  }
};

// Stream and process JSON array files
const processFile = (filePath, allItems) => {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamArray()
    ]);

    let count = 0;

    pipeline.on('data', ({ value }) => {
      cleanFields(value);          // Clean content, note, reblog.content, etc.
      delete value.content_clean;  // Remove redundant field
      allItems.push(value);
      count++;
    });

    pipeline.on('end', () => {
      console.log(`✅ Processed: ${path.basename(filePath)} - ${count} items`);
      resolve();
    });

    pipeline.on('error', reject);
  });
};

// Main Runner
const loadAndProcessAll = async () => {
  const startTime = Date.now();
  const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'));
  const allItems = [];

  console.log(`📂 Found ${files.length} JSON files in "${folderPath}".\n`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(folderPath, file);
    console.log(`🔄 Processing file ${i + 1} of ${files.length}: ${file}`);
    await processFile(fullPath, allItems);
  }

  console.log(`\n📊 Sorting ${allItems.length} items by ${DATE_FIELD}...`);
  allItems.sort((a, b) => new Date(b[DATE_FIELD]) - new Date(a[DATE_FIELD]));

  console.log(`💾 Saving to: ${outputPath}`);
  await fse.writeJson(outputPath, allItems, { spaces: 2 });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Done! Total items: ${allItems.length}`);
  console.log(`⏱️ Time taken: ${duration} seconds`);
};

loadAndProcessAll().catch(err => {
  console.error('❌ Error during processing:', err);
});

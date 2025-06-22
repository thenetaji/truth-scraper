const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');
const { Parser } = require('json2csv');

// Config
const folderPath = './data'; // Folder with input JSON files
const outputJsonPath = './output.json';
const outputCsvPath = './output.csv';
const DATE_FIELD = 'created_at';

// 🧼 Clean HTML: Remove <p> and convert <a href="...">text</a> → text (link)
const cleanContent = (html) => {
  html = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, text) => {
    return `${text} (${href})`;
  });
  html = html.replace(/<\/?p>/gi, '');
  return html.trim();
};

// 🔃 Flatten nested JSON into a flat structure
const flatten = (obj, prefix = '') => {
  let result = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value); // store array as JSON string
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result = { ...result, ...flatten(value, newKey) };
    } else {
      result[newKey] = value;
    }
  }
  return result;
};

// 📂 Process each file using stream
const processFile = (filePath, allItems) => {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamArray()
    ]);

    let count = 0;

    pipeline.on('data', ({ value }) => {
      if (value.content) {
        value.content = cleanContent(value.content);
      }
      if (value.account?.note) {
        value.account.note = cleanContent(value.account.note);
      }
      delete value.content_clean;

      const flat = flatten(value);
      allItems.push(flat);
      count++;
    });

    pipeline.on('end', () => {
      console.log(`Finished: ${path.basename(filePath)} - ${count} items`);
      resolve();
    });

    pipeline.on('error', reject);
  });
};

// 🧩 Load and process all files
const loadAndProcessAll = async () => {
  const startTime = Date.now();

  const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'));
  const allItems = [];

  console.log(`Found ${files.length} JSON files in "${folderPath}".`);
  console.log('Starting processing...\n');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(folderPath, file);
    console.log(`Processing file ${i + 1} of ${files.length}: ${file}`);
    await processFile(fullPath, allItems);
  }

  console.log(`\nSorting ${allItems.length} items by ${DATE_FIELD} (latest first)...`);
  allItems.sort((a, b) => new Date(b[DATE_FIELD]) - new Date(a[DATE_FIELD]));

  console.log(`Saving JSON to: ${outputJsonPath}`);
  await fse.writeJson(outputJsonPath, allItems, { spaces: 2 });

  console.log(`Saving CSV to: ${outputCsvPath}`);
  const csvFields = Object.keys(allItems[0] || {});
  const parser = new Parser({ fields: csvFields });
  const csv = parser.parse(allItems);
  fs.writeFileSync(outputCsvPath, csv, 'utf8');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Done. Total items: ${allItems.length}`);
  console.log(`🕒 Total time: ${duration} seconds.`);
};

loadAndProcessAll().catch(err => {
  console.error('❌ Error during processing:', err);
});

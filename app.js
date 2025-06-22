const fs = require('fs');
const path = require('path');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');
const fse = require('fs-extra');

// Config
const folderPath = './data'; // Folder containing your JSON files
const outputPath = './combined_sorted.json';
const DATE_FIELD = 'created_at';

// Clean HTML: Remove <p> and convert <a href="...">text</a> → text (link)
const cleanContent = (html) => {
  html = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, text) => {
    return `${text} (${href})`;
  });

  html = html.replace(/<\/?p>/gi, '');
  return html.trim();
};

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
      delete value.content_clean;
      allItems.push(value);
      count++;
    });

    pipeline.on('end', () => {
      console.log(`Finished: ${path.basename(filePath)} - ${count} items`);
      resolve();
    });

    pipeline.on('error', reject);
  });
};

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

  console.log(`Saving combined data to: ${outputPath}`);
  await fse.writeJson(outputPath, allItems, { spaces: 2 });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nDone. Total items: ${allItems.length}`);
  console.log(`Total time: ${duration} seconds.`);
};

loadAndProcessAll().catch(err => {
  console.error('Error during processing:', err);
});

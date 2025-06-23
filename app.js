const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');
const { parse: parseHTML } = require('htmlparser2');
const { Parser: Json2CsvParser } = require('json2csv');

// Config
const folderPath = './data'; // Folder with JSON files
const outputJsonPath = './output.json';
const outputCsvPath = './output.csv';
const DATE_FIELD = 'created_at';

// Clean HTML from content, note, and nested reblog.content
const cleanHtml = (html) => {
  if (!html) return '';
  let output = '';

  const walk = (nodes) => {
    return nodes.map((node) => {
      if (node.type === 'text') {
        return node.data;
      }
      if (node.name === 'a' && node.attribs?.href) {
        const href = node.attribs.href;
        const inner = walk(node.children || []);
        return `${inner} (${href})`;
      }
      return node.children ? walk(node.children).join('') : '';
    });
  };

  try {
    const dom = parseHTML(html, { recognizeSelfClosing: true });
    output = walk(Array.isArray(dom) ? dom : [dom]).join('');
  } catch (err) {
    output = html;
  }

  return output.trim();
};

// Process a single file
const processFile = (filePath, allItems, seenIds) => {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamArray()
    ]);

    let total = 0;
    let unique = 0;

    pipeline.on('data', ({ value }) => {
      total++;

      if (!value.id || seenIds.has(value.id)) return;

      // Clean fields
      if (value.content) value.content = cleanHtml(value.content);
      if (value.note) value.note = cleanHtml(value.note);
      if (value.account && value.account.note) {
        value.account.note = cleanHtml(value.account.note);
      }
      if (value.reblog && value.reblog.content) {
        value.reblog.content = cleanHtml(value.reblog.content);
      }
      if (value.reblog?.account?.note) {
        value.reblog.account.note = cleanHtml(value.reblog.account.note);
      }

      delete value.content_clean;

      seenIds.add(value.id);
      allItems.push(value);
      unique++;
    });

    pipeline.on('end', () => {
      console.log(`✅ ${unique} unique / ${total} total in ${path.basename(filePath)}`);
      resolve();
    });

    pipeline.on('error', reject);
  });

    if (seenIds.has(value.id)) {
  console.warn(`🔁 Duplicate found: ${value.id}`);
  return;
}

};

// Main function
const loadAndProcessAll = async () => {
  const startTime = Date.now();
  const allItems = [];
  const seenIds = new Set();

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));

  console.log(`📁 Found ${files.length} JSON files in "${folderPath}".`);
  console.log('🚀 Starting processing...\n');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(folderPath, file);
    console.log(`📄 File ${i + 1}/${files.length}: ${file}`);
    await processFile(fullPath, allItems, seenIds);
  }

  console.log(`\n🧮 Sorting ${allItems.length} items by ${DATE_FIELD}...`);
  allItems.sort((a, b) => new Date(b[DATE_FIELD]) - new Date(a[DATE_FIELD]));

  console.log(`💾 Writing JSON to ${outputJsonPath}`);
  await fse.writeJson(outputJsonPath, allItems, { spaces: 2 });

  console.log(`📄 Writing CSV to ${outputCsvPath}`);
  const flatItems = allItems.map(flattenObject);
  const fields = Object.keys(flatItems[0] || {});
  const parser = new Json2CsvParser({ fields });
  const csv = parser.parse(flatItems);
  fs.writeFileSync(outputCsvPath, csv);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Done. ${allItems.length} unique items processed in ${duration}s.`);
};

// Flatten nested JSON for CSV
const flattenObject = (obj, prefix = '') => {
  const flat = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenObject(value, newKey));
    } else {
      flat[newKey] = value;
    }
  }
  return flat;
};

loadAndProcessAll().catch(err => {
  console.error('❌ Error:', err);
});

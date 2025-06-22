const fs = require('fs');
const { Parser } = require('json2csv');

// Recursively flatten nested objects
function flatten(obj, prefix = '') {
  let result = {};
  for (let key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value); // stringify arrays
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result = { ...result, ...flatten(value, newKey) };
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// Load and parse JSON file
const rawData = fs.readFileSync('combined_sorted.json', 'utf8');
const jsonData = JSON.parse(rawData);

// Flatten all entries
const flattenedData = jsonData.map(item => flatten(item));

// Convert to CSV
const parser = new Parser({ fields: Object.keys(flattenedData[0]) });
const csv = parser.parse(flattenedData);

// Save to CSV file
fs.writeFileSync('output.csv', csv);

console.log('✅ JSON has been converted to CSV successfully.');

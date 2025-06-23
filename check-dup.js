const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./output.json', 'utf-8'));
const ids = new Set();
const duplicates = [];

for (const item of data) {
  if (ids.has(item.id)) {
    duplicates.push(item.id);
  } else {
    ids.add(item.id);
  }
}

if (duplicates.length > 0) {
  console.log(`❌ Found ${duplicates.length} duplicates:`);
  console.log(duplicates);
} else {
  console.log('✅ No duplicate IDs found.');
}

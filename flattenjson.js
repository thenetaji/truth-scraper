const fs = require('fs');
const path = require('path');

// Clean HTML tags from a string
function cleanHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
}

// Flatten nested JSON
function flattenJSON(data, parentKey = '', result = {}) {
    for (const key in data) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;

        if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
            flattenJSON(data[key], newKey, result);
        } else if (Array.isArray(data[key])) {
            data[key].forEach((item, i) => {
                if (typeof item === 'object' && item !== null) {
                    flattenJSON(item, `${newKey}[${i}]`, result);
                } else {
                    result[`${newKey}[${i}]`] = cleanHTML(item);
                }
            });
        } else {
            result[newKey] = cleanHTML(data[key]);
        }
    }
    return result;
}

// Convert array of objects to CSV
function jsonToCsv(dataArray) {
    const headers = Array.from(
        new Set(dataArray.flatMap(obj => Object.keys(obj)))
    );

    const rows = dataArray.map(obj =>
        headers.map(h => JSON.stringify(obj[h] || '')).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

// File paths
const inputPath = path.join(__dirname, 'output.json');
const outputJsonPath = path.join(__dirname, 'output2.json');
const outputCsvPath = path.join(__dirname, 'output.csv');

try {
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const jsonData = JSON.parse(rawData);

    // Normalize input to array
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

    // Flatten and clean each object
    const flattenedArray = dataArray.map(item => flattenJSON(item));

    // Write cleaned JSON
    fs.writeFileSync(outputJsonPath, JSON.stringify(flattenedArray, null, 2));

    // Convert to CSV and write
    const csv = jsonToCsv(flattenedArray);
    fs.writeFileSync(outputCsvPath, csv);

    console.log('✅ JSON cleaned & saved to output.json');
    console.log('✅ CSV saved to output.csv');
} catch (err) {
    console.error('❌ Error:', err.message);
}

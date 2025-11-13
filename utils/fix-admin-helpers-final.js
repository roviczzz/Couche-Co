const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'admin-helpers.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find all instances where db.collection is used but db is not a parameter
const functionRegex = /async function (\w+)\((.*?)\)\s*{/g;
const dbUsageRegex = /\bdb\.collection\(/g;

let matches = [];
let match;

// First pass: find all functions that use db.collection
while ((match = functionRegex.exec(content)) !== null) {
  const functionName = match[1];
  const params = match[2];
  const functionStart = match.index;
  
  // Find the end of this function (simplified - look for next function or end of file)
  const nextFunctionMatch = content.substring(functionStart + match[0].length).search(/\nasync function /);
  const functionEnd = nextFunctionMatch === -1 ? content.length : functionStart + match[0].length + nextFunctionMatch;
  
  const functionBody = content.substring(functionStart, functionEnd);
  
  // Check if this function uses db.collection
  if (dbUsageRegex.test(functionBody) && !params.includes('db')) {
    matches.push({ name: functionName, params, start: functionStart, body: functionBody });
  }
}

console.log(`Found ${matches.length} functions that need db parameter:\n`);
matches.forEach(m => console.log(`  - ${m.name}(${m.params})`));

// Second pass: fix each function
matches.forEach(m => {
  const oldSignature = `async function ${m.name}(${m.params})`;
  const newParams = m.params ? `db, ${m.params}` : 'db';
  const newSignature = `async function ${m.name}(${newParams})`;
  
  content = content.replace(oldSignature, newSignature);
  console.log(`✓ Fixed: ${m.name}`);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Updated ${matches.length} functions in admin-helpers.js`);

const fs = require('fs');
const path = require('path');

console.log('\n🧹 Cleanup: Removing temporary optimization scripts\n');

const scriptsToRemove = [
  'utils/fix-db-connections.js',
  'utils/fix-admin-helpers.js',
  'utils/fix-utils.js'
];

scriptsToRemove.forEach(script => {
  const filePath = path.join(__dirname, '..', script);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✓ Removed ${script}`);
  } else {
    console.log(`○ ${script} not found (already removed)`);
  }
});

console.log('\n✅ Cleanup complete!\n');
console.log('Keeping these utility scripts:');
console.log('  • utils/verify-optimizations.js (for future verification)');
console.log('  • utils/db.js (database connection manager)\n');

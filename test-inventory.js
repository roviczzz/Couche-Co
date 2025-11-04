const InventoryManager = require('./utils/inventoryManager');
const InventoryMonitor = require('./utils/inventoryMonitor');

async function runInventoryTests() {
  console.log('🧪 Running Inventory System Tests...\n');

  // Test 1: Check availability for a sample order
  console.log('Test 1: Checking inventory availability');
  const sampleOrder = [
    {
      ProductName: 'Taro',
      ProductID: 'MT-TARO',
      Size: '16oz',
      Quantity: 1,
      Addons: [
        {
          AddOnID: 'AD-BOB',
          Name: 'Boba'
        }
      ]
    }
  ];

  try {
    const availabilityResult = await InventoryManager.checkIngredientAvailability(sampleOrder);
    console.log('✅ Availability check completed');
    console.log('Available:', availabilityResult.available);
    if (!availabilityResult.available) {
      console.log('Unavailable items:', availabilityResult.unavailableItems);
    }
  } catch (error) {
    console.error('❌ Availability check failed:', error.message);
  }

  // Test 2: Generate inventory report
  console.log('\nTest 2: Generating inventory report');
  try {
    const report = await InventoryMonitor.generateDailyReport();
    if (report) {
      console.log('✅ Report generated successfully');
    } else {
      console.log('❌ Report generation failed');
    }
  } catch (error) {
    console.error('❌ Report generation error:', error.message);
  }

  // Test 3: Check for critical stock alerts
  console.log('\nTest 3: Checking critical stock alerts');
  try {
    const alerts = await InventoryMonitor.checkForCriticalStock();
    console.log(`✅ Alert check completed - ${alerts.length} alerts found`);
  } catch (error) {
    console.error('❌ Alert check failed:', error.message);
  }

  console.log('\n🎉 Inventory system tests completed!');
}

// Only run if this file is executed directly
if (require.main === module) {
  runInventoryTests().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runInventoryTests };
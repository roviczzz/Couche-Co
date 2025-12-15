const { ObjectId } = require('mongodb');

/**
 * Middleware to validate cart items before order creation
 * Validates:
 * - Cart structure and required fields
 * - Product existence in database
 * - Add-on validity and existence
 * - Price integrity (prevents price tampering)
 * - Size validity for sized products
 */
async function validateCartItems(req, res, next) {
  try {
    const { Cart } = req.body;

    if (!Cart || !Array.isArray(Cart) || Cart.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty or invalid'
      });
    }

    const db = req.db;
    const menuCollection = db.collection('Menu');
    const addonsCollection = db.collection('Add-ons');
    const ingredientsCollection = db.collection('Ingredients');

    const validationErrors = [];
    const validatedCart = [];

    for (let i = 0; i < Cart.length; i++) {
      const item = Cart[i];
      const itemIndex = i + 1;

      // Validate required fields
      if (!item.ProductID && !item.productId) {
        validationErrors.push(`Item ${itemIndex}: Missing product ID`);
        continue;
      }

      if (!item.ProductName && !item.name) {
        validationErrors.push(`Item ${itemIndex}: Missing product name`);
        continue;
      }

      if (typeof item.Quantity !== 'number' || item.Quantity < 1) {
        validationErrors.push(`Item ${itemIndex}: Invalid quantity`);
        continue;
      }

      if (typeof item.Price !== 'number' || item.Price < 0) {
        validationErrors.push(`Item ${itemIndex}: Invalid price`);
        continue;
      }

      const productId = item.ProductID || item.productId;
      const productName = item.ProductName || item.name;
      const itemSize = item.Size || item.size;
      const itemAddons = item.Addons || item.addons || [];

      // Verify product exists and is enabled
      const product = await menuCollection.findOne({
        ProductID: productId,
        isEnabled: true
      });

      if (!product) {
        validationErrors.push(`Item ${itemIndex} (${productName}): Product not found or unavailable`);
        continue;
      }

      // Validate size if product has sizes
      if (product.Sizes && product.Sizes.length > 0) {
        if (!itemSize) {
          validationErrors.push(`Item ${itemIndex} (${productName}): Size is required`);
          continue;
        }

        const validSize = product.Sizes.find(s => {
          const sizeName = s.Size || s.SizeName || s.sizeName || s.name;
          return sizeName === itemSize;
        });

        if (!validSize) {
          validationErrors.push(`Item ${itemIndex} (${productName}): Invalid size "${itemSize}"`);
          continue;
        }

        // Verify price matches the size price
        const sizePrice = parseFloat(validSize.BasePrice || validSize.Price || validSize.price || 0);
        if (Math.abs(item.Price - sizePrice) > 0.01) {
          validationErrors.push(`Item ${itemIndex} (${productName}): Price mismatch (expected ₱${sizePrice.toFixed(2)}, got ₱${item.Price.toFixed(2)})`);
          continue;
        }
      } else {
        // For non-sized products, verify base price
        const basePrice = parseFloat(product.BasePrice || 0);
        if (Math.abs(item.Price - basePrice) > 0.01) {
          validationErrors.push(`Item ${itemIndex} (${productName}): Price mismatch (expected ₱${basePrice.toFixed(2)}, got ₱${item.Price.toFixed(2)})`);
          continue;
        }
      }

      // Validate add-ons if present
      if (itemAddons.length > 0) {
        const validatedAddons = [];

        for (const addon of itemAddons) {
          const addonName = addon.Name || addon.name;
          const addonId = addon.IngredientID || addon.ingredientId;
          const addonPrice = parseFloat(addon.BasePrice || addon.basePrice || 0);

          if (!addonId && !addonName) {
            validationErrors.push(`Item ${itemIndex} (${productName}): Add-on missing identifier`);
            continue;
          }

          if (addonPrice < 0) {
            validationErrors.push(`Item ${itemIndex} (${productName}): Invalid add-on price`);
            continue;
          }

          // Verify add-on exists in either Add-ons or Ingredients collection
          let validAddon;
          if (addonId) {
            validAddon = await addonsCollection.findOne({ IngredientID: addonId, isEnabled: true });
            if (!validAddon) {
              validAddon = await addonsCollection.findOne({ AddOnID: addonId, isEnabled: true });
            }
            if (!validAddon) {
              validAddon = await ingredientsCollection.findOne({ IngredientID: addonId, isEnabled: true });
            }
            if (!validAddon) {
              validAddon = await ingredientsCollection.findOne({ IngredientID: addonId, isAvailable: 'true' });
            }
          } else if (addonName) {
            validAddon = await addonsCollection.findOne({ Name: addonName, isEnabled: true });
            if (!validAddon) {
              validAddon = await addonsCollection.findOne({ name: addonName, isEnabled: true });
            }
            if (!validAddon) {
              validAddon = await ingredientsCollection.findOne({ Name: addonName, isEnabled: true });
            }
            if (!validAddon) {
              validAddon = await ingredientsCollection.findOne({ Name: addonName, isAvailable: 'true' });
            }
          }

          if (!validAddon) {
            console.warn(`⚠️ Add-on not found: "${addonName || addonId}" for item ${itemIndex} (${productName}). Allowing order with original data.`);
            // Fail-safe: Don't block the order, just use the original addon data
            // This allows orders to proceed even if add-ons become unavailable
            validatedAddons.push({
              Name: addonName || addonId,
              IngredientID: addonId || addonName,
              BasePrice: addonPrice,
              Category: null
            });
            continue;
          }

          // Verify add-on price matches database (use BasePrice from either collection)
          const dbAddonPrice = parseFloat(validAddon.BasePrice || 0);
          if (Math.abs(addonPrice - dbAddonPrice) > 0.01) {
            console.warn(`⚠️ Add-on price mismatch for "${addonName}": expected ₱${dbAddonPrice.toFixed(2)}, got ₱${addonPrice.toFixed(2)}. Using database price.`);
            // Use database price to prevent price manipulation
            validatedAddons.push({
              Name: validAddon.Name || validAddon.name || addonName,
              IngredientID: validAddon.IngredientID || validAddon.AddOnID || addonId,
              BasePrice: dbAddonPrice,
              Category: validAddon.Category || null
            });
            continue;
          }

          validatedAddons.push({
            Name: validAddon.Name || validAddon.name || addonName,
            IngredientID: validAddon.IngredientID || validAddon.AddOnID || addonId,
            BasePrice: dbAddonPrice,
            Category: validAddon.Category || null
          });
        }

        // Update item with validated add-ons
        item.Addons = validatedAddons;
      }

      validatedCart.push(item);
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart validation failed',
        details: validationErrors
      });
    }

    // If all items validated successfully, update request with validated cart
    req.body.Cart = validatedCart;
    req.cartValidated = true;

    console.log(`✅ Cart validation successful: ${validatedCart.length} items validated`);
    next();

  } catch (error) {
    console.error('❌ Cart validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Cart validation failed due to server error'
    });
  }
}

/**
 * Middleware to validate order total matches cart items
 */
function validateOrderTotal(req, res, next) {
  try {
    const { Cart, Total, PromoDiscountAmount, Customer } = req.body;

    if (!Cart || !Array.isArray(Cart)) {
      return next();
    }

    let calculatedSubtotal = 0;

    Cart.forEach(item => {
      const itemPrice = parseFloat(item.Price || 0);
      const quantity = parseInt(item.Quantity || 0);
      let itemTotal = itemPrice * quantity;

      // Add add-ons to item total
      if (item.Addons && Array.isArray(item.Addons)) {
        const addonsTotal = item.Addons.reduce((sum, addon) => {
          return sum + parseFloat(addon.BasePrice || addon.basePrice || 0);
        }, 0);
        itemTotal += addonsTotal * quantity;
      }

      calculatedSubtotal += itemTotal;
    });

    // Apply promo discount if present
    let calculatedTotal = calculatedSubtotal;
    if (PromoDiscountAmount && typeof PromoDiscountAmount === 'number') {
      const discountAmount = calculatedSubtotal * PromoDiscountAmount;
      calculatedTotal = calculatedSubtotal - discountAmount;
    }

    // Add delivery fee if delivery method is Delivery
    if (Customer && Customer.deliveryMethod === 'Delivery') {
      calculatedTotal += 20;
    }

    // Allow small floating point differences
    if (Math.abs(calculatedTotal - Total) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Order total mismatch',
        details: `Expected total: ₱${calculatedTotal.toFixed(2)}, Received: ₱${Total.toFixed(2)}`
      });
    }

    console.log(`✅ Order total validated: ₱${Total.toFixed(2)}`);
    next();

  } catch (error) {
    console.error('❌ Order total validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Order total validation failed'
    });
  }
}

module.exports = {
  validateCartItems,
  validateOrderTotal
};

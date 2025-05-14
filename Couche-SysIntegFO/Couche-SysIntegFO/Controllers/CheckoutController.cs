using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Couche_SysIntegFO.Models;
using Couche_SysIntegFO.Data;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Couche_SysIntegFO.Controllers
{
    [Authorize]
    public class CheckoutController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public CheckoutController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        public async Task<IActionResult> Checkout()
        {
            var userId = _userManager.GetUserId(User); // Get the current user's ID

            // 1. Retrieve the user from AspNetUsers
            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                return NotFound("User not found."); // Or handle the error appropriately
            }

            // 2. Retrieve cart items from the database
            var cartItems = await _context.Carts
                .Where(c => c.UserId == userId)
                .Include(c => c.Product)
                .ToListAsync();

            // 3. Calculate total quantity and total price
            int totalQuantity = cartItems.Sum(item => item.Quantity);
            decimal totalPrice = cartItems.Sum(item => item.Quantity * item.Product.ProductPrice);

            // 4. Create the CheckoutViewModel
            var checkoutViewModel = new CheckoutViewModel
            {
                UserId = userId,
                FirstName = user.FirstName, // Assuming you have FirstName property in AspNetUsers
                LastName = user.LastName,   // Assuming you have LastName property in AspNetUsers
                Address = user.Address,     // Assuming you have Address property in AspNetUsers
                TotalQuantity = totalQuantity,
                TotalPrice = totalPrice,
                CartItems = cartItems // Populate the CartItems property!
            };

            return View("~/Views/Cart/Checkout.cshtml", checkoutViewModel);
        }

        [HttpPost]
        public async Task<IActionResult> ProcessCheckout(CheckoutViewModel model)
        {
            if (ModelState.IsValid)
            {
                // 1. Get the user
                var user = await _userManager.FindByIdAsync(model.UserId);
                if (user == null)
                {
                    return NotFound();
                }

                // 2. Get the cart items
                var cartItems = model.CartItems;
                if (cartItems == null || !cartItems.Any())
                {
                    ModelState.AddModelError("", "Your cart is empty.");
                    return View("~/Views/Cart/Checkout.cshtml", model); // Return to checkout page with error
                }

                // 3. Create an order (You'll need an Order model)
                var order = new Order
                {
                    UserId = model.UserId,
                    OrderDate = DateTime.Now,
                    FirstName = model.FirstName,
                    LastName = model.LastName,
                    TotalAmount = model.TotalPrice,
                    ShippingAddress = model.Address,
                    PaymentMethod = model.PaymentMethod,
                    // Other order details
                };
                _context.Orders.Add(order);

                // **IMPORTANT: Save the order to the database FIRST**
                await _context.SaveChangesAsync();

                // 4. Create order items and update product quantity
                foreach (var cartItem in cartItems)
                {
                    // Create order item
                    var orderItem = new OrderItem
                    {
                        OrderId = order.OrderId, // Now OrderId should be populated
                        ProductId = cartItem.ProductId,
                        Quantity = cartItem.Quantity,
                        Price = cartItem.Product.ProductPrice
                    };
                    _context.OrderItems.Add(orderItem);

                    // **UPDATE PRODUCT QUANTITY**
                    var product = await _context.Products.FindAsync(cartItem.ProductId);
                    if (product != null)
                    {
                        product.ProductStock -= cartItem.Quantity; // Subtract purchased quantity
                        _context.Products.Update(product); // Mark product as updated
                    }

                    // Remove the cart item
                    var cartItemToRemove = await _context.Carts.FindAsync(cartItem.CartId);
                    if (cartItemToRemove != null)
                    {
                        _context.Carts.Attach(cartItemToRemove); // Attach the entity
                        _context.Carts.Remove(cartItemToRemove);
                    }
                }

                // 5. Save changes to the database (This will save the OrderItems, update Product quantities, and remove CartItems)
                await _context.SaveChangesAsync();

                // 6. **CLEAR USER'S CART (Alternative)**
                //await ClearUserCart(user.Id); // Call the ClearUserCart method

                // 7. Redirect to a confirmation page
                return RedirectToAction("PurchaseConfirmation", "Cart", new { orderId = order.OrderId });
            }

            // If ModelState is not valid, return to the checkout page with errors
            return View("~/Views/Cart/Checkout.cshtml", model);
        }
    }

    public class CheckoutViewModel
    {
        public string UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PaymentMethod { get; set; }
        public string Address { get; set; }
        public int TotalQuantity { get; set; }
        public decimal TotalPrice { get; set; }
        public List<Cart> CartItems { get; set; } // Use your actual Cart model
    }
}

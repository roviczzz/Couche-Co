using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Couche_SysIntegFO.Models;
using Couche_SysIntegFO.Data;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Couche_SysIntegFO.Controllers
{
    [Authorize] // Requires user to be logged in
    public class CartController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public CartController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        public async Task<IActionResult> ViewCart()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
            {
                return Unauthorized(); // Or handle if user is not logged in
            }

            var cartItems = await _context.Carts
                .Where(c => c.UserId == user.Id)
                .Include(c => c.Product)
                .ToListAsync();

            return View(cartItems);
        }

        [HttpPost]
        public async Task<IActionResult> AddToCart(int productId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
            {
                return Unauthorized(); // Or handle the case where the user is not logged in
            }

            var product = await _context.Products.FindAsync(productId);

            if (product == null)
            {
                return NotFound(); // Or handle the case where the product doesn't exist
            }

            var cartItem = await _context.Carts.FirstOrDefaultAsync(c => c.UserId == user.Id && c.ProductId == productId);

            if (cartItem == null)
            {
                // Add new item to cart
                cartItem = new Cart
                {
                    UserId = user.Id,
                    ProductId = productId,
                    Quantity = 1
                };
                _context.Carts.Add(cartItem);
            }
            else
            {
                // Increment quantity if item already exists
                cartItem.Quantity++;
            }

            await _context.SaveChangesAsync();

            return RedirectToAction("ViewCart");
        }

        [HttpPost]
        public async Task<IActionResult> RemoveFromCart(int productId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
            {
                return Unauthorized();
            }

            var cartItem = await _context.Carts
                .FirstOrDefaultAsync(c => c.UserId == user.Id && c.ProductId == productId);

            if (cartItem == null)
            {
                return NotFound();
            }

            _context.Carts.Remove(cartItem);
            await _context.SaveChangesAsync();

            return RedirectToAction("ViewCart");
        }

        public async Task<IActionResult> PurchaseConfirmation(int orderId)
    {
        // 1. Retrieve the order from the database using the orderId
        var order = await _context.Orders.FindAsync(orderId);

        // 2. Check if the order exists
        if (order == null)
        {
            return NotFound(); // Or redirect to an error page
        }

        // 3. Pass the order to the view (optional, if you need to display order details)
        return View(order); // Assuming you have a PurchaseConfirmation.cshtml view
    }
    }
}
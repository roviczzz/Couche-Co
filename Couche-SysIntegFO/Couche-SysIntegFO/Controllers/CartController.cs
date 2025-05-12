using Couche_SysIntegFO.Data;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public class CartController : Controller
{
    private readonly ApplicationDbContext _context;

    public CartController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> AddToCart(int productId, string userId)
    {
        var existingCartItem = await _context.Carts
            .FirstOrDefaultAsync(c => c.ProductId == productId && c.UserId == userId);

        if (existingCartItem == null)
        {
            var cartItem = new Cart
            {
                ProductId = productId,
                UserId = userId
            };

            _context.Carts.Add(cartItem);
            await _context.SaveChangesAsync();
        }

        return RedirectToAction("Index", "Products"); // Redirect or change as needed
    }

    public async Task<IActionResult> ViewCart(string userId)
    {
        var cartItems = await _context.Carts
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();

        return View(cartItems);
    }
}

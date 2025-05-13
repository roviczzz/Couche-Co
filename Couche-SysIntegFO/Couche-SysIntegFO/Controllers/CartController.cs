using Couche_SysIntegFO.Data;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[Authorize]
public class CartController : Controller
{
    private readonly ApplicationDbContext _context;

    public CartController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: Cart - View Cart Items
    public async Task<IActionResult> Index()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
        {
            return RedirectToAction("Login", "Account");
        }

        var cartItems = await _context.Carts
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();

        return View(cartItems);
    }

    // GET: Cart/ViewCart
    public async Task<IActionResult> ViewCart(string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            return RedirectToAction("Index", "Home");
        }

        var cartItems = await _context.Carts
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();

        return View("Index", cartItems);
    }

    // POST: Cart/AddToCart
    [HttpPost]
    public async Task<IActionResult> AddToCart(int productId)
    {
        // Get the current user's ID
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        // Add debug logging
        System.Diagnostics.Debug.WriteLine($"Adding to cart - UserID: {userId}, ProductID: {productId}");


        if (string.IsNullOrEmpty(userId))
        {
            TempData["Error"] = "Please log in to add items to cart.";
            return RedirectToAction("Login", "Account");
        }

        // Validate product exists and is in stock
        var product = await _context.Products.FindAsync(productId);
        if (product == null)
        {
            TempData["Error"] = "Product not found!";
            return RedirectToAction("Index", "Cart");
        }

        if (product.ProductStock <= 0)
        {
            TempData["Error"] = "Product is out of stock!";
            return RedirectToAction("Index", "Cart");
        }

        // Check if product is already in cart
        var existingCartItem = await _context.Carts
            .FirstOrDefaultAsync(c => c.ProductId == productId && c.UserId == userId);

        if (existingCartItem == null)
        {
            var cartItem = new Cart
            {
                ProductId = productId,
                UserId = userId // Use the userId from the current user
            };

            _context.Carts.Add(cartItem);
            await _context.SaveChangesAsync();
            TempData["Success"] = "Product added to cart successfully!";
        }
        else
        {
            TempData["Info"] = "Product is already in your cart!";
        }

        return RedirectToAction("Index", "Cart");
    }

    // POST: Cart/RemoveFromCart
    [HttpPost]
    public async Task<IActionResult> RemoveFromCart(int cartId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var cartItem = await _context.Carts.FindAsync(cartId);

        if (cartItem == null)
        {
            TempData["Error"] = "Cart item not found!";
            return RedirectToAction(nameof(Index));
        }

        if (cartItem.UserId != userId)
        {
            TempData["Error"] = "Unauthorized access!";
            return RedirectToAction(nameof(Index));
        }

        _context.Carts.Remove(cartItem);
        await _context.SaveChangesAsync();

        TempData["Success"] = "Product removed from cart successfully!";
        return RedirectToAction(nameof(Index));
    }

    // GET: Cart/GetCartCount
    [HttpGet]
    public async Task<JsonResult> GetCartCount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var count = await _context.Carts.CountAsync(c => c.UserId == userId);
        return Json(new { count });
    }

    // POST: Cart/ClearCart
    [HttpPost]
    public async Task<IActionResult> ClearCart()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var cartItems = await _context.Carts.Where(c => c.UserId == userId).ToListAsync();

        _context.Carts.RemoveRange(cartItems);
        await _context.SaveChangesAsync();

        TempData["Success"] = "Cart cleared successfully!";
        return RedirectToAction(nameof(Index));
    }
}
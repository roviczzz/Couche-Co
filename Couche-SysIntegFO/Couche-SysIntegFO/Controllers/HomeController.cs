using Couche_SysIntegFO.Data;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Couche_SysIntegFO.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ProductDbContext _context;

        public HomeController(ILogger<HomeController> logger, UserManager<ApplicationUser> userManager, ProductDbContext context)
        {
            _logger = logger;
            _userManager = userManager;
            _context = context;
        }

        private async Task SetLayoutAsync()
        {
            if (User.Identity.IsAuthenticated)
            {
                var user = await _userManager.GetUserAsync(User);
                if (user != null)
                {
                    var roles = await _userManager.GetRolesAsync(user);
                    if (roles.Contains("Admin"))
                    {
                        ViewBag.Layout = "_LayoutAdmin";
                        _logger.LogInformation("Admin layout set for user: {User}", user.UserName);
                        return;
                    }
                    else
                    {
                        ViewBag.Layout = "_LayoutUser";
                        _logger.LogInformation("User layout set for user: {User}", user.UserName);
                        return;
                    }
                }
            }

            // Fallback layout
            ViewBag.Layout = "_Layout";
            _logger.LogInformation("Fallback layout set.");
        }

        public async Task<IActionResult> Index()
        {
            await SetLayoutAsync();
            var products = await _context.Products.ToListAsync();
            return View(products);
        }

        public async Task<IActionResult> Privacy()
        {
            await SetLayoutAsync();
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public async Task<IActionResult> Error()
        {
            await SetLayoutAsync();
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
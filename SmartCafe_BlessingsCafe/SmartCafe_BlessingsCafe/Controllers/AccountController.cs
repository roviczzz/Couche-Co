using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using SmartCafe_BlessingsCafe.Data;
using SmartCafe_BlessingsCafe.Models;
using System.Linq;

namespace SmartCafe_BlessingsCafe.Controllers
{
    public class AccountController : Controller
    {
        private readonly SmartCafe_BlessingsCafeContext _context;

        public AccountController(SmartCafe_BlessingsCafeContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Login(LoginViewModel model)
        {
            if (ModelState.IsValid)
            {
                var admin = _context.Admin
                    .FirstOrDefault(a => a.Username == model.Username && a.Password == model.Password);

                if (admin != null)
                {
                    HttpContext.Session.SetString("AdminUser", admin.Username);
                    return RedirectToAction("Dashboard", "Home"); // Change to your admin page if needed
                }

                ViewBag.Error = "Invalid username or password.";
            }

            return View(model);
        }

        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }
    }
}

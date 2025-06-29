using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using SmartCafe_BlessingsCafe.Data;
using SmartCafe_BlessingsCafe.Models;
using System.Linq;
using System.Threading.Tasks;

namespace SmartCafe_BlessingsCafe.Controllers
{
    public class AccountController : Controller
    {
        private readonly SmartCafe_BlessingsCafeContext _context;

        public AccountController(SmartCafe_BlessingsCafeContext context)
        {
            _context = context;
        }

        // ====== LOGIN ======

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
                    return RedirectToAction("Index", "Home"); // Adjust if your dashboard controller is different
                }

                ViewBag.Error = "Invalid username or password.";
            }

            return View(model);
        }

        // ====== LOGOUT ======

        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }

        // ====== REGISTER ======

        [HttpGet]
        public IActionResult Register()
        {
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Register(RegisterViewModel model)
        {
            if (ModelState.IsValid)
            {
                // Optional: check if username or email already exists
                if (_context.Admin.Any(a => a.Username == model.Username || a.Email == model.Email))
                {
                    ViewBag.Error = "Username or email already exists.";
                    return View(model);
                }

                var admin = new Admin
                {
                    Username = model.Username,
                    Email = model.Email,
                    Password = model.Password // ⚠️ Note: plaintext for now, can be hashed
                };

                _context.Admin.Add(admin);
                await _context.SaveChangesAsync();

                return RedirectToAction("Login");
            }

            return View(model);
        }
    }
}

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Identity;

namespace Couche_SysIntegFO.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser> // Keep IdentityUser if you're using ASP.NET Identity
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Products> Products { get; set; }
        public DbSet<Cart> Carts { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
        }
    }
}

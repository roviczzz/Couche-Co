using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Identity;

namespace Couche_SysIntegFO.Data
{
    public class ApplicationDbContext : IdentityDbContext<IdentityUser> // Keep IdentityUser if you're using ASP.NET Identity
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<AppUser> AppUsers { get; set; }
        public DbSet<Products> Products { get; set; }
        public DbSet<Cart> Carts { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Cart>()
                .HasOne(c => c.User)
                .WithMany(u => u.Carts)
                .HasForeignKey(c => c.UserId);

            builder.Entity<Cart>()
                .HasOne(c => c.Product)
                .WithMany(p => p.Carts)
                .HasForeignKey(c => c.ProductId);
        }
    }
}

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Couche_SysIntegFO.Models;
using Microsoft.AspNetCore.Identity;
using System.Reflection.Emit;

namespace Couche_SysIntegFO.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser> // Keep IdentityUser if you're using ASP.NET Identity
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Cart> Carts { get; set; }
        public DbSet<Products> Products { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Cart>(entity =>
            {
                entity.HasKey(e => e.CartId);

                entity.HasOne(d => d.User)
                    .WithMany()
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Product)
                    .WithMany(p => p.Carts)
                    .HasForeignKey(d => d.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}

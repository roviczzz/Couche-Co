using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Couche_SysIntegFO.Models;

namespace Couche_SysIntegFO.Data
{
    public class ProductDbContext : DbContext
    {
        public ProductDbContext (DbContextOptions<ProductDbContext> options)
            : base(options)
        {
        }

        public DbSet<Couche_SysIntegFO.Models.Products> Products { get; set; } = default!;
    }
}

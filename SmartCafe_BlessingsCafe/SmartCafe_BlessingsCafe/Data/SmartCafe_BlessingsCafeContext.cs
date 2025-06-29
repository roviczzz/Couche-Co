using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SmartCafe_BlessingsCafe.Models;

namespace SmartCafe_BlessingsCafe.Data
{
    public class SmartCafe_BlessingsCafeContext : DbContext
    {
        public SmartCafe_BlessingsCafeContext (DbContextOptions<SmartCafe_BlessingsCafeContext> options)
            : base(options)
        {
        }

        public DbSet<SmartCafe_BlessingsCafe.Models.Admin> Admin { get; set; } = default!;
    }
}

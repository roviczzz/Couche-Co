using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Couche_SysIntegFO.Models
{
    public class ApplicationUser : IdentityUser
    {
        public virtual ICollection<Cart> Carts { get; set; }
        public ApplicationUser()
        {
            Carts = new HashSet<Cart>();
        }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public int ContactNo { get; set; }
        public string? Address { get; set; }
        public string? PaymentMethod { get; set; }
    }
}

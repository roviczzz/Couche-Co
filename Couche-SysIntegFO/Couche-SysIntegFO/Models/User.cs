using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace Couche_SysIntegFO.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public int ContactNo { get; set; }
        public string Address { get; set; }
        public string PaymentMethod {  get; set; }

        public ICollection<Cart> Carts { get; set; }
    }
}

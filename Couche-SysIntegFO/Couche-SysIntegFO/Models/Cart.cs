using Microsoft.CodeAnalysis;
using System.ComponentModel.DataAnnotations;

namespace Couche_SysIntegFO.Models
{
    public class Cart
    {
        [Key]
        public int CartId { get; set; }

        public int UserId { get; set; }
        public AppUser User { get; set; }

        public int ProductId { get; set; }
        public Products Product { get; set; }
    }
}

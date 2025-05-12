using Microsoft.CodeAnalysis;
using System.ComponentModel.DataAnnotations;

namespace Couche_SysIntegFO.Models
{
    public class Cart
    {
        [Key]
        public int CartId { get; set; }

        public string? UserId { get; set; }
        public ApplicationUser? User { get; set; }

        public int ProductId { get; set; }
        public Products? Product { get; set; }
    }
}

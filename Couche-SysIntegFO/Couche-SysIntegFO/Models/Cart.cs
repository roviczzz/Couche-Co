using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Couche_SysIntegFO.Models
{
    public class Cart
    {
        [Key]
        public int CartId { get; set; }

        [Required]
        public string? UserId { get; set; }

        [ForeignKey("UserId")]
        public ApplicationUser? User { get; set; }
        [Required]
        public int ProductId { get; set; }

        [ForeignKey("ProductId")]
        public Products? Product { get; set; }
    }
}
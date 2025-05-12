using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using System.ComponentModel.DataAnnotations;

namespace Couche_SysIntegFO.Models
{
    public class Products
    {
        [Key]
        public int ProductID { get; set; }
        public int ProductPrice { get; set; }
        public string? ProductName { get; set; }
        public string? ProductDescription { get; set; }
        public int ProductStock {  get; set; }
        public string? ImageUrl {  get; set; }

        [ValidateNever]
        public ICollection<Cart>? Carts { get; set; }
    }
}
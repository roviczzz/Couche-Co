using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
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

    public class Products
    {
        [Key]
        public int ProductID { get; set; }
        public int ProductPrice { get; set; }
        public string? ProductName { get; set; }
        public string? ProductDescription { get; set; }
        public int ProductStock { get; set; }
        public string? ImageUrl { get; set; }

        public ICollection<Cart>? Carts { get; set; }
    }

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

        [Required]
        public int Quantity { get; set; } = 1; // Default quantity
    }
    public class RegisterViewModel
    {
        [Required]
        public string? FirstName { get; set; }
        [Required]
        public string? LastName { get; set; }
        [Required]
        public string? ContactNo { get; set; }
        public string? Address { get; set; }
        public string? PaymentMethod { get; set; }

        [Required]
        [EmailAddress]
        public string? Email { get; set; }
        [Required]
        [DataType(DataType.Password)]
        public string? Password { get; set; }
        [DataType(DataType.Password)]
        [Compare("Password")]
        public string? ConfirmPassword { get; set; }
    }
}
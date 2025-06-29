using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartCafe_BlessingsCafe.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailToAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Admin",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Email",
                table: "Admin");
        }
    }
}

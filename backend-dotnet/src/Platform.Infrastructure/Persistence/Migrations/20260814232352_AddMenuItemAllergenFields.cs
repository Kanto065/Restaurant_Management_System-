using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuItemAllergenFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllergenTagsJson",
                table: "MenuItems");

            migrationBuilder.AddColumn<string>(
                name: "AllergenInfo",
                table: "MenuItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ContainsAllergens",
                table: "MenuItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllergenInfo",
                table: "MenuItems");

            migrationBuilder.DropColumn(
                name: "ContainsAllergens",
                table: "MenuItems");

            migrationBuilder.AddColumn<string>(
                name: "AllergenTagsJson",
                table: "MenuItems",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}

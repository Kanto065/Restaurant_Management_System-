using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderTypeDefaultMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CollectionMinutes",
                table: "Restaurants",
                type: "integer",
                nullable: false,
                // Existing restaurants start with the same 60/20/20 that was hardcoded before.
                defaultValue: 20);

            migrationBuilder.AddColumn<int>(
                name: "DeliveryMinutes",
                table: "Restaurants",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<int>(
                name: "DineInMinutes",
                table: "Restaurants",
                type: "integer",
                nullable: false,
                defaultValue: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CollectionMinutes",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DeliveryMinutes",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DineInMinutes",
                table: "Restaurants");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryPricingEnabled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DeliveryPricingEnabled",
                table: "Restaurants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // On only where delivery zones have been set up (Port Tennant). A restaurant without
            // zones (Star Spice) keeps delivery free and unchecked, as before zones existed -
            // with pricing on and no zones, its delivery would be refused.
            migrationBuilder.Sql("""
                UPDATE "Restaurants" r SET "DeliveryPricingEnabled" = true
                WHERE EXISTS (SELECT 1 FROM "DeliveryZones" z WHERE z."RestaurantId" = r."Id" AND NOT z."IsDeleted");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryPricingEnabled",
                table: "Restaurants");
        }
    }
}

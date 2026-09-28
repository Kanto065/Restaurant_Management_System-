using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryZoneShapes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "MaxDeliveryMiles",
                table: "Restaurants",
                type: "double precision",
                nullable: false,
                // Existing restaurants get the agreed 5-mile limit - EF's 0 would switch delivery off.
                defaultValue: 5.0);

            migrationBuilder.AddColumn<decimal>(
                name: "OutsideZoneDeliveryFee",
                table: "Restaurants",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OutsideZoneMinimumOrder",
                table: "Restaurants",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryZoneName",
                table: "Orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BoundaryJson",
                table: "DeliveryZones",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Colour",
                table: "DeliveryZones",
                type: "text",
                nullable: false,
                defaultValue: "#e8823c");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxDeliveryMiles",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "OutsideZoneDeliveryFee",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "OutsideZoneMinimumOrder",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DeliveryZoneName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BoundaryJson",
                table: "DeliveryZones");

            migrationBuilder.DropColumn(
                name: "Colour",
                table: "DeliveryZones");
        }
    }
}

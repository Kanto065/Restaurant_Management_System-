using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrimDeliveryZoneNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Zone names were saved with stray spaces ("Hafod "), which showed on the storefront
            // as "Delivering to ... (Hafod )". New saves are trimmed by the admin API.
            migrationBuilder.Sql("""UPDATE "DeliveryZones" SET "Name" = btrim("Name") WHERE "Name" <> btrim("Name");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}

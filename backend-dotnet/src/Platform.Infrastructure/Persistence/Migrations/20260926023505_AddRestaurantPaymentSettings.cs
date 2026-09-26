using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantPaymentSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RestaurantPaymentSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UseConfigAccount = table.Column<bool>(type: "boolean", nullable: false),
                    StripePublishableKey = table.Column<string>(type: "text", nullable: true),
                    StripeSecretKeyEncrypted = table.Column<string>(type: "text", nullable: true),
                    StripeSecretKeyLast4 = table.Column<string>(type: "text", nullable: true),
                    StripeWebhookSecretEncrypted = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RestaurantPaymentSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RestaurantPaymentSettings_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantPaymentSettings_RestaurantId",
                table: "RestaurantPaymentSettings",
                column: "RestaurantId",
                unique: true);

            // Port Tennant has been taking card payments through the config-level Stripe account
            // (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET) - opt it in so nothing changes for it.
            // Deliberately by slug, not "every restaurant": that account is Port Tennant's own, so
            // any other restaurant (e.g. one created from the super admin panel before this ran)
            // must never silently route its customers' card payments into it.
            migrationBuilder.Sql("""
                INSERT INTO "RestaurantPaymentSettings"
                    ("Id", "RestaurantId", "IsEnabled", "UseConfigAccount",
                     "CreatedAt", "UpdatedAt", "CreatedBy", "UpdatedBy", "IsDeleted")
                SELECT gen_random_uuid(), r."Id", false, true,
                       now(), now(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', false
                FROM "Restaurants" r
                WHERE r."Slug" = 'port-tennant-tandoori';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RestaurantPaymentSettings");
        }
    }
}

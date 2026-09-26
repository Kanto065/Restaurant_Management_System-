using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Data-only: rewrites existing customer users' UserName from their email to the
    /// restaurant-scoped form produced by AppUser.CustomerUserName
    /// ("customer.{restaurantId:N}.{lower(email)}"), so they can still sign in now that customer
    /// login looks users up by that name. Users who are also staff keep their email username.
    /// </summary>
    public partial class ScopeCustomerUserNamesByRestaurant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "AspNetUsers" u
                SET "UserName" = 'customer.' || replace(c."RestaurantId"::text, '-', '') || '.' || lower(trim(u."Email")),
                    "NormalizedUserName" = upper('customer.' || replace(c."RestaurantId"::text, '-', '') || '.' || lower(trim(u."Email")))
                FROM "Customers" c
                WHERE c."IdentityUserId" = u."Id"
                  AND u."Email" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM "RestaurantStaff" s WHERE s."UserId" = u."Id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "AspNetUsers"
                SET "UserName" = "Email",
                    "NormalizedUserName" = upper("Email")
                WHERE "UserName" LIKE 'customer.%';
                """);
        }
    }
}

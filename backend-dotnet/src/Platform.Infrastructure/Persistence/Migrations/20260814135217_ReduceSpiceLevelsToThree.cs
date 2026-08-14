using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReduceSpiceLevelsToThree : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SpiceLevel.ExtraHot (4) was removed from the enum - fold any existing rows into Hot (3)
            // before the app starts deserializing them against the narrower enum.
            migrationBuilder.Sql(@"UPDATE ""MenuItems"" SET ""SpiceLevel"" = 3 WHERE ""SpiceLevel"" = 4;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible - the distinction between Hot and ExtraHot is gone.
        }
    }
}

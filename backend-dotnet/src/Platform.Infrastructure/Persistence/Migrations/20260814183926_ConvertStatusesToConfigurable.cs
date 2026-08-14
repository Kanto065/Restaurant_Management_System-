using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ConvertStatusesToConfigurable : Migration
    {
        // Old enum ordinals -> the string names they need to become. Npgsql's int->text
        // AlterColumn just casts the number to its literal digit string (e.g. 0 -> "0"), not
        // the enum member name, so each column needs an explicit CASE remap straight after.
        private const string OrderStatusCase = @"CASE ""Status""
            WHEN '0' THEN 'Pending' WHEN '1' THEN 'Confirmed' WHEN '2' THEN 'Preparing'
            WHEN '3' THEN 'Ready' WHEN '4' THEN 'OutForDeliveryOrServed' WHEN '5' THEN 'Completed'
            WHEN '6' THEN 'Cancelled' ELSE ""Status"" END";

        private const string PaymentStatusOnStatusCase = @"CASE ""Status""
            WHEN '0' THEN 'Pending' WHEN '1' THEN 'Authorized' WHEN '2' THEN 'Paid'
            WHEN '3' THEN 'Failed' WHEN '4' THEN 'Refunded' WHEN '5' THEN 'PartiallyRefunded' ELSE ""Status"" END";

        private const string PaymentStatusOnPaymentStatusCase = @"CASE ""PaymentStatus""
            WHEN '0' THEN 'Pending' WHEN '1' THEN 'Authorized' WHEN '2' THEN 'Paid'
            WHEN '3' THEN 'Failed' WHEN '4' THEN 'Refunded' WHEN '5' THEN 'PartiallyRefunded' ELSE ""PaymentStatus"" END";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Payments",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
            migrationBuilder.Sql($@"UPDATE ""Payments"" SET ""Status"" = {PaymentStatusOnStatusCase};");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "OrderStatusHistories",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
            migrationBuilder.Sql($@"UPDATE ""OrderStatusHistories"" SET ""Status"" = {OrderStatusCase};");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Orders",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
            migrationBuilder.Sql($@"UPDATE ""Orders"" SET ""Status"" = {OrderStatusCase};");

            migrationBuilder.AlterColumn<string>(
                name: "PaymentStatus",
                table: "Orders",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
            migrationBuilder.Sql($@"UPDATE ""Orders"" SET ""PaymentStatus"" = {PaymentStatusOnPaymentStatusCase};");

            migrationBuilder.CreateTable(
                name: "OrderStatusDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CountsAsPending = table.Column<bool>(type: "boolean", nullable: false),
                    CountsAsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RestaurantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStatusDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaymentStatusDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RestaurantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentStatusDefinitions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusDefinitions_RestaurantId",
                table: "OrderStatusDefinitions",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentStatusDefinitions_RestaurantId",
                table: "PaymentStatusDefinitions",
                column: "RestaurantId");
        }

        // Not reversible for any status name an admin has since added/renamed via the new
        // Configurations UI - only the original built-in names can round-trip back to a number.
        private const string OrderStatusReverseCase = @"CASE ""Status""
            WHEN 'Pending' THEN '0' WHEN 'Confirmed' THEN '1' WHEN 'Preparing' THEN '2'
            WHEN 'Ready' THEN '3' WHEN 'OutForDeliveryOrServed' THEN '4' WHEN 'Completed' THEN '5'
            WHEN 'Cancelled' THEN '6' ELSE '0' END";

        private const string PaymentStatusOnStatusReverseCase = @"CASE ""Status""
            WHEN 'Pending' THEN '0' WHEN 'Authorized' THEN '1' WHEN 'Paid' THEN '2'
            WHEN 'Failed' THEN '3' WHEN 'Refunded' THEN '4' WHEN 'PartiallyRefunded' THEN '5' ELSE '0' END";

        private const string PaymentStatusOnPaymentStatusReverseCase = @"CASE ""PaymentStatus""
            WHEN 'Pending' THEN '0' WHEN 'Authorized' THEN '1' WHEN 'Paid' THEN '2'
            WHEN 'Failed' THEN '3' WHEN 'Refunded' THEN '4' WHEN 'PartiallyRefunded' THEN '5' ELSE '0' END";

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderStatusDefinitions");

            migrationBuilder.DropTable(
                name: "PaymentStatusDefinitions");

            migrationBuilder.Sql($@"UPDATE ""Payments"" SET ""Status"" = {PaymentStatusOnStatusReverseCase};");
            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "Payments",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.Sql($@"UPDATE ""OrderStatusHistories"" SET ""Status"" = {OrderStatusReverseCase};");
            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "OrderStatusHistories",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.Sql($@"UPDATE ""Orders"" SET ""Status"" = {OrderStatusReverseCase};");
            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "Orders",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.Sql($@"UPDATE ""Orders"" SET ""PaymentStatus"" = {PaymentStatusOnPaymentStatusReverseCase};");
            migrationBuilder.AlterColumn<int>(
                name: "PaymentStatus",
                table: "Orders",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}

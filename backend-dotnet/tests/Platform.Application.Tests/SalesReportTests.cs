using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Pos;

namespace Platform.Application.Tests;

public class SalesReportTests
{
    private static readonly Guid Curry = Guid.NewGuid(), Beer = Guid.NewGuid();

    [Fact]
    public void Totals_SplitPayments_VoidLines_AndRefunds()
    {
        var pos = new Order
        {
            Source = OrderSource.Pos, Subtotal = 20m, DiscountAmount = 2m, TotalAmount = 18m,
            Items =
            [
                new OrderItem { MenuItemId = Curry, NameSnapshot = "Curry", Quantity = 2, LineTotal = 16m },
                new OrderItem { MenuItemId = Beer, NameSnapshot = "Beer", Quantity = 1, LineTotal = 4m },
                new OrderItem { MenuItemId = Beer, NameSnapshot = "Beer", Quantity = 1, LineTotal = 0m, ItemStatus = OrderItemStatus.Void },
            ],
            Payments = [new Payment { Provider = PaymentProvider.Cash, Amount = 10m }, new Payment { Provider = PaymentProvider.Card, Amount = 8m }],
        };
        var web = new Order
        {
            Source = OrderSource.Web, Subtotal = 12m, TotalAmount = 12m, PaymentMethod = PaymentMethod.Card,
            Items = [new OrderItem { MenuItemId = Curry, NameSnapshot = "Curry", Quantity = 1, LineTotal = 12m }],
        };
        var day = new DateOnly(2026, 10, 2);

        var r = SalesReport.Calculate(day, day, [pos, web], [new Refund { Amount = 5m, Method = RefundMethod.Cash }],
            new Dictionary<Guid, string> { [Curry] = "Mains", [Beer] = "Drinks" });

        Assert.Equal(2, r.OrderCount);
        Assert.Equal(32m, r.GrossSales);
        Assert.Equal(2m, r.Discounts);
        Assert.Equal(30m, r.Sales);
        Assert.Equal(25m, r.Net);
        Assert.Equal(20m, r.ByPaymentMethod.Single(l => l.Name == "Card").Amount); // 8 POS + 12 web
        Assert.Equal(10m, r.ByPaymentMethod.Single(l => l.Name == "Cash").Amount);
        Assert.Equal(1, r.ByItem.Single(l => l.Name == "Beer").Count); // void line excluded
        Assert.Equal(28m, r.ByCategory.Single(l => l.Name == "Mains").Amount);
    }
}

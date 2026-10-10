using Microsoft.EntityFrameworkCore;
using Platform.Application.Abstractions;
using Platform.Application.Common;
using Platform.Domain.Entities;

namespace Platform.Application.Orders;

public record UpdateOrderStatusCommand(Guid Id, string Status, string? Note) : ICommand<OrderDetailDto>;

internal sealed class UpdateOrderStatusHandler(IAppDbContext db, ICurrentTenant tenant, IOrderNotifier notifier, ICurrentActor actor)
    : ICommandHandler<UpdateOrderStatusCommand, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(UpdateOrderStatusCommand c, CancellationToken ct)
    {
        var order = await db.Orders.WithDetails().FirstOrDefaultAsync(o => o.Id == c.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        // Confirming starts the clock: the first move off the starting status (to anything but
        // Cancelled) sets the ready/delivery time from the order's planned minutes. Statuses are
        // admin-configurable, so "starting status" is the one marked default, not a fixed name.
        var startingStatus = await db.OrderStatusDefinitions.Where(d => d.IsDefault).Select(d => d.Name).FirstOrDefaultAsync(ct) ?? "Pending";
        var startsClock = order.EstimatedReadyAt is null
            && order.EstimatedMinutes.HasValue
            && !string.Equals(c.Status, startingStatus, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(c.Status, "Cancelled", StringComparison.OrdinalIgnoreCase);
        if (startsClock)
            order.EstimatedReadyAt = DateTimeOffset.UtcNow.AddMinutes(order.EstimatedMinutes!.Value);

        order.Status = c.Status;

        var historyEntry = new OrderStatusHistory
        {
            RestaurantId = order.RestaurantId,
            OrderId = order.Id,
            Status = c.Status,
            ChangedByUserId = actor.ActorId,
            Note = c.Note,
        };
        db.OrderStatusHistories.Add(historyEntry);

        await db.SaveChangesAsync(ct);
        await notifier.OrderStatusChangedAsync(tenant.RestaurantId!.Value, order.Id, order.Status, ct);
        if (startsClock)
            await notifier.EstimatedTimeChangedAsync(tenant.RestaurantId!.Value, order.Id, order.EstimatedReadyAt, ct);

        return order.ToDetailDto();
    }
}

public record SetEstimatedTimeCommand(Guid Id, int EstimatedMinutesFromNow) : ICommand<OrderDetailDto>;

internal sealed class SetEstimatedTimeHandler(IAppDbContext db, ICurrentTenant tenant, IOrderNotifier notifier)
    : ICommandHandler<SetEstimatedTimeCommand, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(SetEstimatedTimeCommand c, CancellationToken ct)
    {
        var order = await db.Orders.WithDetails().FirstOrDefaultAsync(o => o.Id == c.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        if (c.EstimatedMinutesFromNow is < 0 or > 600)
            return Error.Validation("Order.InvalidEstimate", "Time must be between 0 and 600 minutes.");

        // Not confirmed yet (clock not started): change the planned minutes, which will count
        // from confirmation. Already running: move the actual ready/delivery time.
        order.EstimatedMinutes = c.EstimatedMinutesFromNow;
        if (order.EstimatedReadyAt is not null)
            order.EstimatedReadyAt = DateTimeOffset.UtcNow.AddMinutes(c.EstimatedMinutesFromNow);
        await db.SaveChangesAsync(ct);
        await notifier.EstimatedTimeChangedAsync(tenant.RestaurantId!.Value, order.Id, order.EstimatedReadyAt, ct);

        return order.ToDetailDto();
    }
}

public record UpdatePaymentStatusCommand(Guid Id, string PaymentStatus) : ICommand<OrderDetailDto>;

internal sealed class UpdatePaymentStatusHandler(IAppDbContext db, ICurrentTenant tenant, IOrderNotifier notifier)
    : ICommandHandler<UpdatePaymentStatusCommand, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(UpdatePaymentStatusCommand c, CancellationToken ct)
    {
        var order = await db.Orders.WithDetails().FirstOrDefaultAsync(o => o.Id == c.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        order.PaymentStatus = c.PaymentStatus;
        await db.SaveChangesAsync(ct);
        await notifier.PaymentReceivedAsync(tenant.RestaurantId!.Value, order.Id, ct);

        return order.ToDetailDto();
    }
}

/// <summary>Only the contact/note fields are editable after placement - items, pricing, and
/// loyalty/voucher effects are locked in at checkout and shouldn't be hand-edited afterward.</summary>
public record UpdateOrderDetailsCommand(
    Guid Id, string? CustomerName, string? CustomerPhone, string? CustomerEmail, string? SpecialRequests) : ICommand<OrderDetailDto>;

internal sealed class UpdateOrderDetailsHandler(IAppDbContext db) : ICommandHandler<UpdateOrderDetailsCommand, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(UpdateOrderDetailsCommand c, CancellationToken ct)
    {
        var order = await db.Orders.WithDetails().FirstOrDefaultAsync(o => o.Id == c.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        order.CustomerName = c.CustomerName;
        order.CustomerPhone = c.CustomerPhone;
        order.CustomerEmail = c.CustomerEmail;
        order.SpecialRequests = c.SpecialRequests;
        await db.SaveChangesAsync(ct);

        return order.ToDetailDto();
    }
}

public record DeleteOrderCommand(Guid Id) : ICommand<bool>;

internal sealed class DeleteOrderHandler(IAppDbContext db) : ICommandHandler<DeleteOrderCommand, bool>
{
    public async Task<Result<bool>> Handle(DeleteOrderCommand c, CancellationToken ct)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == c.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        order.IsDeleted = true;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

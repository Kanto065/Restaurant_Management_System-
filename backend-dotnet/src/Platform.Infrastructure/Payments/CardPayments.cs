using Platform.Application.Common;

namespace Platform.Infrastructure.Payments;

public class CardPayments(IStripeAccountProvider accounts) : ICardPayments
{
    public async Task<bool> IsAvailableAsync(Guid restaurantId, CancellationToken ct = default) =>
        await accounts.ForRestaurantAsync(restaurantId, ct) is not null;
}

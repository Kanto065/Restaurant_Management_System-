using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Platform.Infrastructure.Realtime;

/// <summary>
/// Pushes order events to admin dashboard and POS clients. Clients are assigned to a
/// restaurant-{id} group server-side from the connection's JWT claim, never from a
/// client-requested "join" message — closes the trust gap the old Socket.io rooms had.
/// </summary>
[Authorize]
public class OrderHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var restaurantId = Context.User?.FindFirst("active_restaurant_id")?.Value;
        if (!string.IsNullOrEmpty(restaurantId))
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(restaurantId));

        await base.OnConnectedAsync();
    }

    public static string GroupName(string restaurantId) => $"restaurant-{restaurantId}";
}

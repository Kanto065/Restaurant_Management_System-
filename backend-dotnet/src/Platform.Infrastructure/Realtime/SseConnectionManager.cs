using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Platform.Infrastructure.Realtime;

/// <summary>
/// In-memory per-restaurant fan-out for Server-Sent Events. Single-replica friendly - if the
/// API ever runs multiple instances, this needs a shared backplane (e.g. Postgres LISTEN/NOTIFY
/// or Redis pub/sub) instead, same tradeoff SignalR's Redis backplane existed to solve.
/// </summary>
public class SseConnectionManager
{
    private readonly ConcurrentDictionary<Guid, ConcurrentBag<Channel<string>>> _subscribers = new();

    public Channel<string> Subscribe(Guid restaurantId)
    {
        var channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
        var bag = _subscribers.GetOrAdd(restaurantId, _ => []);
        bag.Add(channel);
        return channel;
    }

    public void Unsubscribe(Guid restaurantId, Channel<string> channel)
    {
        if (!_subscribers.TryGetValue(restaurantId, out var bag))
            return;

        // ConcurrentBag has no Remove; rebuild without the closed channel (subscriber counts
        // are small - a handful of admin/POS connections per restaurant - so this is cheap).
        var remaining = bag.Where(c => c != channel).ToArray();
        _subscribers[restaurantId] = new ConcurrentBag<Channel<string>>(remaining);
        channel.Writer.TryComplete();
    }

    public void Publish(Guid restaurantId, string json)
    {
        if (!_subscribers.TryGetValue(restaurantId, out var bag))
            return;

        foreach (var channel in bag)
            channel.Writer.TryWrite(json);
    }
}

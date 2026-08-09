namespace Platform.Domain.Common;

/// <summary>
/// Marks an entity as scoped to a single Restaurant (operational tenant boundary).
/// Infrastructure applies a global EF Core query filter to every entity implementing this.
/// </summary>
public interface IHasTenant
{
    Guid RestaurantId { get; set; }
}

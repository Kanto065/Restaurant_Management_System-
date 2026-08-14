using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

public class MenuCategory : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public TimeOnly? AvailableFrom { get; set; }
    public TimeOnly? AvailableTo { get; set; }

    public Restaurant? Restaurant { get; set; }
    public List<MenuItem> Items { get; set; } = [];
}

public class MenuCategoryAvailableDay : TenantEntity
{
    public Guid MenuCategoryId { get; set; }
    public MenuCategory? MenuCategory { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
}

public class MenuItem : TenantEntity
{
    public Guid CategoryId { get; set; }
    public MenuCategory? Category { get; set; }

    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsVegetarian { get; set; }
    public bool IsVegan { get; set; }
    public bool IsBestSeller { get; set; }
    public SpiceLevel SpiceLevel { get; set; } = SpiceLevel.None;
    public bool IsAvailable { get; set; } = true;
    public int DisplayOrder { get; set; }
    public int PreparationTimeMinutes { get; set; } = 15;
    public int? Calories { get; set; }

    /// <summary>Toggle shown as "May contain allergens" on the item edit form - when on, the
    /// storefront item detail page shows an allergy warning banner (with AllergenInfo's text,
    /// if any was given) so customers can check before ordering.</summary>
    public bool ContainsAllergens { get; set; }
    public string? AllergenInfo { get; set; }

    /// <summary>When true and this item has exactly one modifier group, the storefront lists
    /// each option as its own priced row with an instant Add button (e.g. Pappadum -> Plain
    /// £0.95 / Spicy £0.95) instead of opening the customise popup. Purely a display choice -
    /// the underlying modifier group data is unchanged either way.</summary>
    public bool ShowVariantsAsRows { get; set; }

    public List<MenuItemModifierGroup> ModifierGroupLinks { get; set; } = [];
}

/// <summary>A named group of options, e.g. "Choose your rice", "Upgrade options".</summary>
public class ModifierGroup : TenantEntity
{
    public string Name { get; set; } = default!;
    public int MinSelect { get; set; }
    public int MaxSelect { get; set; } = 1;
    public bool IsRequired { get; set; }
    public ModifierGroupType GroupType { get; set; } = ModifierGroupType.Modifier;

    public List<ModifierOption> Options { get; set; } = [];
}

public class ModifierOption : TenantEntity
{
    public Guid ModifierGroupId { get; set; }
    public ModifierGroup? ModifierGroup { get; set; }

    public string Name { get; set; } = default!;
    public decimal PriceDelta { get; set; }
    public bool IsDefault { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int DisplayOrder { get; set; }
}

/// <summary>Join table: a MenuItem can share ModifierGroups (e.g. all curries share "Spice level").
/// DisplayOrder lives here rather than on ModifierGroup since group order is a property of the
/// item's list, not the group itself (relevant once groups are ever shared across items).</summary>
public class MenuItemModifierGroup : TenantEntity
{
    public Guid MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public Guid ModifierGroupId { get; set; }
    public ModifierGroup? ModifierGroup { get; set; }

    public int DisplayOrder { get; set; }
}

public class Deal : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public DateTimeOffset? ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public bool IsActive { get; set; } = true;

    public List<DealComponent> Components { get; set; } = [];
}

public class DealComponent : TenantEntity
{
    public Guid DealId { get; set; }
    public Deal? Deal { get; set; }

    public Guid? MenuItemId { get; set; }
    public Guid? CategoryId { get; set; }
    public int Quantity { get; set; } = 1;
    public Guid? UpgradeModifierGroupId { get; set; }
}

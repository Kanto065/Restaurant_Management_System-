namespace Platform.Application.Homepage;

public record HeroSlide(string ImageUrl, string Heading, string? Subheading);

/// <summary>Admin-editable storefront homepage content. Every field is optional —
/// null means the storefront falls back to its default hardcoded copy for that
/// section, so restaurants that never touch this still render correctly.</summary>
public record HomepageContent(
    List<HeroSlide> HeroSlides,
    string? OrderOnlineTitle, string? OrderOnlineText,
    string? LoyaltyTitle, string? LoyaltyText,
    string? DeliverTitle, string? DeliverText,
    string? WelcomeTitle, string? WelcomeText);

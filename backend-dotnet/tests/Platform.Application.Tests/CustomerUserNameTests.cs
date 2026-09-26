using Microsoft.AspNetCore.Identity;
using Platform.Infrastructure.Identity;
using Xunit;

namespace Platform.Application.Tests;

public class CustomerUserNameTests
{
    [Fact]
    public void SameEmail_AtDifferentRestaurants_GetsDifferentUserNames()
    {
        var a = AppUser.CustomerUserName(Guid.NewGuid(), "sam@example.com");
        var b = AppUser.CustomerUserName(Guid.NewGuid(), "sam@example.com");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void EmailCaseAndWhitespace_DoNotMatter()
    {
        var restaurant = Guid.NewGuid();

        Assert.Equal(
            AppUser.CustomerUserName(restaurant, "sam@example.com"),
            AppUser.CustomerUserName(restaurant, "  Sam@Example.COM "));
    }

    [Fact]
    public void UsesOnlyIdentityDefaultAllowedCharacters()
    {
        var allowed = new UserOptions().AllowedUserNameCharacters;
        var userName = AppUser.CustomerUserName(Guid.NewGuid(), "first.last+tag@example.co.uk");

        Assert.All(userName, ch => Assert.Contains(ch, allowed));
    }
}

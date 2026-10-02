using Platform.Infrastructure.Pos;

namespace Platform.Application.Tests;

public class FeatureServiceTests
{
    private static readonly Dictionary<string, bool> None = [];

    [Fact]
    public void Pos_FollowsLegacyPosEnabled_EvenIfPlanSaysOtherwise()
    {
        Assert.True(FeatureService.Resolve(true, """{"pos":false}""", None)[FeatureKeys.Pos]);
        Assert.False(FeatureService.Resolve(false, """{"pos":true}""", None)[FeatureKeys.Pos]);
    }

    [Fact]
    public void NewFeatures_DefaultOff_WithNoPlanAndNoOverride()
    {
        var map = FeatureService.Resolve(true, null, None);
        Assert.False(map[FeatureKeys.PosWaiter]);
        Assert.False(map[FeatureKeys.PosRefunds]);
        Assert.True(map[FeatureKeys.OnlineOrdering]);
        Assert.Equal(FeatureKeys.All.Length, map.Count);
    }

    [Fact]
    public void Override_BeatsPlanDefault()
    {
        var map = FeatureService.Resolve(true, """{"pos.waiter":true,"pos.reports":true}""",
            new Dictionary<string, bool> { [FeatureKeys.PosWaiter] = false });
        Assert.False(map[FeatureKeys.PosWaiter]);
        Assert.True(map[FeatureKeys.PosReports]);
    }

    [Fact]
    public void PosSubFeatures_AreOff_WhenPosIsOff() =>
        Assert.False(FeatureService.Resolve(false, """{"pos.waiter":true}""",
            new Dictionary<string, bool> { [FeatureKeys.PosRefunds] = true })[FeatureKeys.PosRefunds]);

    [Fact]
    public void BadPlanJson_IsIgnored() =>
        Assert.False(FeatureService.Resolve(true, "not json", None)[FeatureKeys.PosWaiter]);
}

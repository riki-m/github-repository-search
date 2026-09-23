using RepositorySearch.Api.Services;

namespace RepositorySearch.Tests;

public sealed class SearchRankingTests
{
    [Fact]
    public void Inspiration_filters_activity_and_sorts_globally_by_stars()
    {
        var result = SearchRanking.Build("angular language:typescript", "inspiration", new DateTimeOffset(2026, 9, 23, 0, 0, 0, TimeSpan.Zero));
        Assert.Equal("angular language:typescript archived:false pushed:>=2025-09-23", result.Query);
        Assert.Equal("stars", result.Sort);
    }

    [Theory]
    [InlineData("best-match", null)]
    [InlineData("updated", "updated")]
    public void Other_modes_preserve_advanced_queries(string mode, string? sort)
    {
        var result = SearchRanking.Build("HILAN-TEST archived:true pushed:<2020-01-01", mode, DateTimeOffset.UtcNow);
        Assert.Equal("HILAN-TEST archived:true pushed:<2020-01-01", result.Query);
        Assert.Equal(sort, result.Sort);
    }

    [Theory]
    [InlineData("test archived:true", "inspiration")]
    [InlineData("test PUSHED:>2020-01-01", "inspiration")]
    [InlineData("test", "stars")]
    [InlineData("test", "forks")]
    [InlineData("test", "views")]
    [InlineData("test", "stars&order=asc")]
    public void Unsupported_or_conflicting_rankings_are_rejected(string query, string mode)
        => Assert.NotNull(SearchRanking.Validate(query, mode));
}

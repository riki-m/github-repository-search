using System.Text.Json;
using System.Text.Json.Serialization;

namespace RepositorySearch.Api.Contracts;

// Only presentation fields cross the API boundary. Full GitHub JSON stays in the session.
public sealed record RepositorySummary(
    long Id,
    string Name,
    [property: JsonPropertyName("full_name")] string FullName,
    [property: JsonPropertyName("html_url")] string HtmlUrl,
    string? Description,
    string? Language,
    [property: JsonPropertyName("stargazers_count")] long Stars,
    [property: JsonPropertyName("forks_count")] long Forks,
    [property: JsonPropertyName("pushed_at")] string? PushedAt,
    bool Archived,
    RepositoryOwner Owner)
{
    public static RepositorySummary From(JsonElement repository)
    {
        var owner = repository.GetProperty("owner");
        return new(
            repository.GetProperty("id").GetInt64(),
            RequiredText(repository, "name"),
            RequiredText(repository, "full_name"),
            RequiredText(repository, "html_url"),
            OptionalText(repository, "description"),
            OptionalText(repository, "language"),
            repository.TryGetProperty("stargazers_count", out var stars) ? stars.GetInt64() : 0,
            repository.TryGetProperty("forks_count", out var forks) ? forks.GetInt64() : 0,
            OptionalText(repository, "pushed_at"),
            repository.TryGetProperty("archived", out var archived) && archived.GetBoolean(),
            new(RequiredText(owner, "login"), RequiredText(owner, "avatar_url")));
    }

    private static string RequiredText(JsonElement element, string property) =>
        element.GetProperty(property).GetString() ?? throw new JsonException("Missing required text.");

    private static string? OptionalText(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) ? value.GetString() : null;
}

public sealed record RepositoryOwner(
    string Login,
    [property: JsonPropertyName("avatar_url")] string AvatarUrl);

public sealed record SearchResponse(long TotalCount, bool IncompleteResults, RepositorySummary[] Items);

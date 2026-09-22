using System.Net;
using System.Text.Json;

namespace RepositorySearch.Api.Services;

public sealed record SearchResult(long TotalCount, bool IncompleteResults, JsonElement[] Items);
public interface IGitHubSearch
{
    Task<SearchResult> Search(string query, CancellationToken cancellationToken);
}
public sealed class GitHubSearch(HttpClient client) : IGitHubSearch
{
    public async Task<SearchResult> Search(string query, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await client.GetAsync($"search/repositories?q={Uri.EscapeDataString(query)}&per_page=30", cancellationToken);
            if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests)
                throw new GitHubException(429, "GitHub is limiting requests. Please wait before searching again.");
            if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
                throw new GitHubException(400, "GitHub could not process that search. Try a simpler query.");
            if (!response.IsSuccessStatusCode)
                throw new GitHubException(502, "GitHub is temporarily unavailable. Please try again.");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = document.RootElement;
            return new(root.GetProperty("total_count").GetInt64(), root.GetProperty("incomplete_results").GetBoolean(),
                root.GetProperty("items").EnumerateArray().Select(x => x.Clone()).ToArray());
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { throw new GitHubException(504, "GitHub took too long to respond. Please try again."); }
        catch (HttpRequestException)
        { throw new GitHubException(502, "Could not reach GitHub. Please try again."); }
        catch (JsonException)
        { throw new GitHubException(502, "GitHub returned an unreadable response."); }
    }
}
public sealed class GitHubException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

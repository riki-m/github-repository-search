using System.Net;
using System.Text.Json;
using System.Diagnostics;

namespace RepositorySearch.Api.Services;

public sealed record SearchResult(long TotalCount, bool IncompleteResults, JsonElement[] Items);
public interface IGitHubSearch
{
    Task<SearchResult> Search(string query, CancellationToken cancellationToken, int page = 1, string ranking = "best-match");
}
public sealed class GitHubSearch(HttpClient client, ILogger<GitHubSearch>? logger = null) : IGitHubSearch
{
    public async Task<SearchResult> Search(string query, CancellationToken cancellationToken, int page = 1, string ranking = "best-match")
    {
        var timer = Stopwatch.StartNew();
        try
        {
            var validationError = SearchRanking.Validate(query, ranking);
            if (validationError is not null) throw new GitHubException(400, validationError);
            var ranked = SearchRanking.Build(query, ranking, DateTimeOffset.UtcNow);
            var sort = ranked.Sort is null ? "" : $"&sort={ranked.Sort}&order=desc";
            // One request per page; the visible preset is applied by GitHub across all matches.
            using var response = await client.GetAsync($"search/repositories?q={Uri.EscapeDataString(ranked.Query)}&per_page=30&page={page}{sort}", cancellationToken);
            if (response.StatusCode == HttpStatusCode.TooManyRequests ||
                (response.StatusCode == HttpStatusCode.Forbidden && await IsRateLimited(response, cancellationToken)))
                throw new GitHubException(429, "GitHub is limiting requests. Please wait before searching again.");
            if (response.StatusCode == HttpStatusCode.Forbidden)
                throw new GitHubException(502, "GitHub refused the search request. Please try again later.");
            if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
                throw new GitHubException(400, "GitHub could not process that search. Try a simpler query.");
            if (!response.IsSuccessStatusCode)
                throw new GitHubException(502, "GitHub is temporarily unavailable. Please try again.");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = document.RootElement;
            if (root.GetProperty("total_count").GetInt64() < 0) throw new JsonException();
            return new(root.GetProperty("total_count").GetInt64(), root.GetProperty("incomplete_results").GetBoolean(),
                root.GetProperty("items").EnumerateArray().Take(Math.Min(30, 1000 - (page - 1) * 30)).Select(x => x.Clone()).ToArray());
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { throw new GitHubException(504, "GitHub took too long to respond. Please try again."); }
        catch (HttpRequestException)
        { throw new GitHubException(502, "Could not reach GitHub. Please try again."); }
        catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException or FormatException or OverflowException)
        { throw new GitHubException(502, "GitHub returned an unreadable response."); }
        finally
        {
            // Timing only: never log the query, URI, response body or authentication headers.
            logger?.LogInformation("GitHub search completed in {ElapsedMilliseconds} ms", timer.ElapsedMilliseconds);
        }
    }
    private static async Task<bool> IsRateLimited(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        // A 403 alone is not proof of throttling. Inspect service signals, never expose its raw body.
        if (response.Headers.RetryAfter is not null ||
            (response.Headers.TryGetValues("X-RateLimit-Remaining", out var remaining) && remaining.Contains("0")))
            return true;
        try
        {
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            return body.RootElement.ValueKind == JsonValueKind.Object &&
                body.RootElement.TryGetProperty("message", out var message) &&
                message.ValueKind == JsonValueKind.String &&
                message.GetString()!.Contains("rate limit", StringComparison.OrdinalIgnoreCase);
        }
        catch (JsonException) { return false; }
    }

}
public sealed class GitHubException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

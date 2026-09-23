using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RepositorySearch.Api.Contracts;
using RepositorySearch.Api.Services;

namespace RepositorySearch.Api.Controllers;

[ApiController, Authorize, Route("api")]
public sealed class RepositoriesController(IGitHubSearch github, SessionStore sessions) : ControllerBase
{
    private UserSession? Current => sessions.Find(User.FindFirst("sid")?.Value, User.FindFirst("sub")?.Value);
    [HttpGet("repositories"), EnableRateLimiting(RequestPolicies.Search)]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken cancellationToken, [FromQuery] int page = 1, [FromQuery] string ranking = "best-match", [FromQuery] bool nameOnly = false)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length > 200)
            return Problem(statusCode: 400, detail: "Enter a search between 1 and 200 characters.");
        // GitHub exposes at most 1,000 matches: 33 full pages plus up to 10 items on page 34.
        if (page is < 1 or > 34)
            return Problem(statusCode: 400, detail: "Page must be between 1 and 34.");
        var rankingError = SearchRanking.Validate(q.Trim(), ranking);
        if (rankingError is not null) return Problem(statusCode: 400, detail: rankingError);
        var scopeError = SearchScope.Validate(q.Trim(), nameOnly);
        if (scopeError is not null) return Problem(statusCode: 400, detail: scopeError);
        var session = Current;
        if (session is null) return Unauthorized();
        try
        {
            // Keep scope independent of ranking so every page uses the same matching rules.
            var results = await github.Search(SearchScope.Apply(q.Trim(), nameOnly), cancellationToken, page, ranking);
            if (Current is null) return Unauthorized();
            // Validate the complete page before remembering any upstream objects in the session.
            var summaries = results.Items.Select(RepositorySummary.From).ToArray();
            session.Remember(results.Items);
            return Ok(new SearchResponse(results.TotalCount, results.IncompleteResults, summaries));
        }
        catch (GitHubException error) { return Problem(statusCode: error.StatusCode, detail: error.Message); }
        catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException or FormatException or OverflowException)
        { return Problem(statusCode: 502, detail: "GitHub returned an unreadable response."); }
    }
    [HttpGet("bookmarks")]
    public IActionResult Bookmarks() => Current is { } session
        ? Ok(session.Bookmarks().Select(RepositorySummary.From).ToArray())
        : Unauthorized();
    [HttpPost("bookmarks/{repositoryId:long}")]
    public IActionResult Bookmark(long repositoryId)
    {
        var session = Current;
        if (session is null) return Unauthorized();
        return session.Bookmark(repositoryId) switch
        {
            BookmarkResult.Saved => NoContent(),
            BookmarkResult.NotFound => Problem(statusCode: 404, detail: "Search for this repository again before bookmarking it."),
            _ => Problem(statusCode: 409, detail: "This demo allows 100 bookmarks per session.")
        };
    }
}

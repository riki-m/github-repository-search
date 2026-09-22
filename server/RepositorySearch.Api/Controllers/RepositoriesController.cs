using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RepositorySearch.Api.Services;

namespace RepositorySearch.Api.Controllers;

[ApiController, Authorize, Route("api")]
public sealed class RepositoriesController(IGitHubSearch github, SessionStore sessions) : ControllerBase
{
    private UserSession? Current => sessions.Find(User.FindFirst("sid")?.Value, User.FindFirst("sub")?.Value);
    [HttpGet("repositories")]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length > 200)
            return Problem(statusCode: 400, detail: "Enter a search between 1 and 200 characters.");
        var session = Current;
        if (session is null) return Unauthorized();
        try
        {
            var results = await github.Search(q.Trim(), cancellationToken);
            if (Current is null) return Unauthorized();
            session.Remember(results.Items);
            return Ok(results);
        }
        catch (GitHubException error) { return Problem(statusCode: error.StatusCode, detail: error.Message); }
    }
    [HttpGet("bookmarks")]
    public IActionResult Bookmarks() => Current is { } session ? Ok(session.Bookmarks()) : Unauthorized();
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

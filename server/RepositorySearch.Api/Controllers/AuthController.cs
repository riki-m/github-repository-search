using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RepositorySearch.Api.Services;

namespace RepositorySearch.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(DemoUsers users, SessionStore sessions, TokenService tokens) : ControllerBase
{
    [HttpPost("login"), EnableRateLimiting(RequestPolicies.Login)]
    public IActionResult Login(LoginRequest request)
    {
        if (!users.Validate(request.Username, request.Password))
            return Problem(statusCode: 401, detail: "Incorrect username or password.");
        UserSession session;
        try { session = sessions.Create(request.Username); }
        catch (InvalidOperationException) { return Problem(statusCode: 503, detail: "Session capacity reached. Try again later."); }
        Response.Headers.CacheControl = "no-store";
        return Ok(new { token = tokens.Issue(session), username = session.UserId, expiresAt = session.ExpiresAt });
    }
    [Authorize, HttpPost("logout")]
    public IActionResult Logout()
    {
        sessions.Remove(User.FindFirst("sid")!.Value);
        return NoContent();
    }
}
public sealed record LoginRequest(
    [Required, StringLength(64)] string Username,
    [Required, StringLength(128)] string Password);

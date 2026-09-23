using System.Text.RegularExpressions;

namespace RepositorySearch.Api.Services;

public static class SearchScope
{
    public static string? Validate(string query, bool nameOnly) =>
        // Avoid combining UI scope with an advanced qualifier that could broaden or contradict it.
        nameOnly && Regex.IsMatch(query, @"\bin:", RegexOptions.IgnoreCase)
            ? "Remove the in: qualifier or turn off Repository name only."
            : null;

    // Apply scope upstream before sorting/pagination; never discard cards from a fetched page.
    // in:name is GitHub name matching, not exact equality with the complete repository name.
    public static string Apply(string query, bool nameOnly) => nameOnly ? $"{query} in:name" : query;
}

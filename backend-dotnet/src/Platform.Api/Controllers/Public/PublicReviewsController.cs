using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

public record ReviewPublicDto(Guid Id, string AuthorName, string? AuthorLocation, int Rating, string? Comment, DateTimeOffset CreatedAt);
public record ReviewPageDto(List<ReviewPublicDto> Reviews, int Page, int PageSize, int TotalCount, double AverageRating);

[ApiController]
[Route("api/public/reviews")]
public class PublicReviewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<ReviewPageDto>>> List([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = db.Reviews.Where(r => r.IsPublished);

        var totalCount = await query.CountAsync();
        var averageRating = totalCount == 0 ? 0 : await query.AverageAsync(r => (double)r.Rating);

        var reviews = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReviewPublicDto(r.Id, r.AuthorName, r.AuthorLocation, r.Rating, r.Comment, r.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<ReviewPageDto>.Ok(new ReviewPageDto(reviews, page, pageSize, totalCount, Math.Round(averageRating, 1))));
    }
}

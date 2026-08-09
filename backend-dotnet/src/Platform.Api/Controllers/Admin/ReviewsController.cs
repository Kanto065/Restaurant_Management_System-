using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record ReviewDto(Guid Id, string AuthorName, string? AuthorLocation, int Rating, string? Comment, bool IsPublished, DateTimeOffset CreatedAt);
public record UpsertReviewRequest(string AuthorName, string? AuthorLocation, int Rating, string? Comment, bool IsPublished);

[ApiController]
[Route("api/admin/reviews")]
[Authorize(Policy = "StaffOnly")]
public class ReviewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ReviewDto>>>> List()
    {
        var reviews = await db.Reviews
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto(r.Id, r.AuthorName, r.AuthorLocation, r.Rating, r.Comment, r.IsPublished, r.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<ReviewDto>>.Ok(reviews));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ReviewDto>>> Create(UpsertReviewRequest request)
    {
        var review = new Review
        {
            AuthorName = request.AuthorName,
            AuthorLocation = request.AuthorLocation,
            Rating = Math.Clamp(request.Rating, 1, 5),
            Comment = request.Comment,
            IsPublished = request.IsPublished,
        };
        db.Reviews.Add(review);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<ReviewDto>.Ok(
            new ReviewDto(review.Id, review.AuthorName, review.AuthorLocation, review.Rating, review.Comment, review.IsPublished, review.CreatedAt),
            statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ReviewDto>>> Update(Guid id, UpsertReviewRequest request)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.Id == id);
        if (review is null)
            return NotFound(ApiResponse<ReviewDto>.Fail("Review not found.", 404));

        review.AuthorName = request.AuthorName;
        review.AuthorLocation = request.AuthorLocation;
        review.Rating = Math.Clamp(request.Rating, 1, 5);
        review.Comment = request.Comment;
        review.IsPublished = request.IsPublished;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<ReviewDto>.Ok(
            new ReviewDto(review.Id, review.AuthorName, review.AuthorLocation, review.Rating, review.Comment, review.IsPublished, review.CreatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.Id == id);
        if (review is null)
            return NotFound(ApiResponse<object>.Fail("Review not found.", 404));

        db.Reviews.Remove(review);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }
}

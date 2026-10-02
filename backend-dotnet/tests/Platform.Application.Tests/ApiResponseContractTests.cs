using System.Text.Json;
using Platform.Api.Contracts;

namespace Platform.Application.Tests;

/// <summary>Backward-compat guard: the envelope existing clients parse must not gain fields.</summary>
public class ApiResponseContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void SuccessAndPlainFailure_KeepTheFourFieldShape()
    {
        Assert.Equal("""{"success":true,"statusCode":200,"message":"OK","data":1}""",
            JsonSerializer.Serialize(ApiResponse<int>.Ok(1), Web));
        Assert.Equal("""{"success":false,"statusCode":404,"message":"Nope","data":null}""",
            JsonSerializer.Serialize(ApiResponse<object>.Fail("Nope", 404), Web));
    }

    [Fact]
    public void ErrorCode_IsWrittenOnlyWhenSet() =>
        Assert.Contains("\"errorCode\":\"FEATURE_DISABLED\"",
            JsonSerializer.Serialize(ApiResponse<object>.Fail("Off", 403, "FEATURE_DISABLED"), Web));
}

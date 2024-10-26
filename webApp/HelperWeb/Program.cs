using HelperWeb;
using Newtonsoft.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
    {
        options.AddPolicy(name: "AllowAll",
            builder =>
            {
                builder.AllowAnyOrigin()
                       .AllowAnyMethod()
                       .AllowAnyHeader();
            });
    });
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");

app.MapPost("/token", async (TokenRequest request) =>
{
    var httpClient = new HttpClient();
    using var formData = new MultipartFormDataContent
    {
        { new StringContent(request.Token), "token" }
    };
    var response = await httpClient.PostAsync("https://api.dtf.ru/v3.4/auth/refresh", formData);
    if (response.IsSuccessStatusCode)
    {
        var json = await response.Content.ReadAsStringAsync();
        var responseData = JsonConvert.DeserializeObject<DtfTokenResponse>(json);
        return new TokenResponse { Token = responseData.Data.AccessToken, Expires = responseData.Data.AccessExpTimestamp };
    }

    return new TokenResponse { Token = null };
})
.WithName("GetDtfToken")
.WithOpenApi();

app.Run();

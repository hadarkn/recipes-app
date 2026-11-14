const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../main");
const axios = require("axios");

// -----------------------------------------------------------------------------
// Test 1: Invalid input
// Verifies that a non-numeric result limit returns HTTP 400 and a clear error,
// helping prevent invalid search requests from reaching the external service.
// -----------------------------------------------------------------------------
test("GET /recipes/search rejects an invalid number", async () => {
  // Send a valid search query with an invalid result limit.
  const response = await request(app)
    .get("/recipes/search")
    .query({
      query: "pasta",
      number: "abc"
    });

  // Verify that the server rejects the request with the expected error.
  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Number of results must be a positive integer"
  );
});

// -----------------------------------------------------------------------------
// Test 2: Edge case - no matching recipes
// Verifies that an empty external API response produces HTTP 200, an empty list,
// and an informative message, treating no matches as a valid search outcome.
// -----------------------------------------------------------------------------
test("GET /recipes/search handles no results", async (t) => {
  // Replace the external API call with an empty response for this test only.
  t.mock.method(axios, "get", async () => {
    return {
      data: {
        results: []
      }
    };
  });

  // Send a valid search request.
  const response = await request(app)
    .get("/recipes/search")
    .query({
      query: "pasta",
      diet: "vegetarian"
    });

  // Verify that an empty result is handled successfully.
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.results, []);
  assert.equal(
    response.body.message,
    "No matching recipes found"
  );
});

// -----------------------------------------------------------------------------
// Test 3: Normal case - recipe returned and filters forwarded
// Verifies that the server forwards the search query, diet, and result limit,
// then returns the expected recipe preview without losing data.
// This tests our server's behavior, not Spoonacular's filtering implementation.
// -----------------------------------------------------------------------------
test("GET /recipes/search returns a recipe and forwards filters", async (t) => {
  // Define a predictable recipe response without relying on live API data.
  const recipe = {
    id: 101,
    title: "Vegetarian Pasta",
    readyInMinutes: 20,
    image: "https://example.com/pasta.jpg",
    aggregateLikes: 12,
    vegan: false,
    vegetarian: true,
    glutenFree: false,
    instructions: "Cook the pasta and add vegetables."
  };

  // Replace the external API call and record its arguments.
  const getMock = t.mock.method(axios, "get", async () => {
    return {
      data: {
        results: [recipe]
      }
    };
  });

  // Request vegetarian pasta with a limit of five results.
  const response = await request(app)
    .get("/recipes/search")
    .query({
      query: "pasta",
      diet: "vegetarian",
      number: "5"
    });

  // Verify the status and complete recipe preview returned by our server.
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.results, [recipe]);

  // Verify that the external API method was called exactly once.
  assert.equal(getMock.mock.callCount(), 1);

  // Read the second argument passed to axios.get: the request options.
  const options = getMock.mock.calls[0].arguments[1];

  // Verify that the search parameters were forwarded correctly.
  assert.equal(options.params.query, "pasta");
  assert.equal(options.params.diet, "vegetarian");
  assert.equal(options.params.number, 5);
});
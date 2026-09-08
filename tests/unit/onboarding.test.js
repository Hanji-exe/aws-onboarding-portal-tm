jest.mock("../../src/services/marketplace");

const { handler } = require("../../src/handlers/onboarding");
const { resolveCustomer } = require("../../src/services/marketplace");

describe("POST /aws-onboarding - Lambda Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== HAPPY PATH ==========
  describe("Success Cases", () => {
    test("should return 200 with CustomerIdentifier for valid token", async () => {
      resolveCustomer.mockResolvedValue({
        CustomerIdentifier: "cust-test-001",
        ProductCode: "taskmaster-hiaas-prod",
      });

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "valid-token-abc123",
        }),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.message).toBe("Onboarding successful");
      expect(body.customerIdentifier).toBe("cust-test-001");
      expect(body.productCode).toBe("taskmaster-hiaas-prod");

      expect(resolveCustomer).toHaveBeenCalledWith("valid-token-abc123");
      expect(resolveCustomer).toHaveBeenCalledTimes(1);
    });
  });

  // ========== VALIDATION ERRORS ==========
  describe("Token Validation Errors", () => {
    test("should return 400 when token is missing from body", async () => {
      const event = {
        httpMethod: "POST",
        body: JSON.stringify({}),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Missing x-amzn-marketplace-token");
      expect(resolveCustomer).not.toHaveBeenCalled();
    });

    test("should return 400 when body is null/empty", async () => {
      const event = {
        httpMethod: "POST",
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Request body is empty");
    });

    test("should return 400 when body is malformed JSON", async () => {
      const event = {
        httpMethod: "POST",
        body: "this-is-not-json{{{",
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Malformed request body - invalid JSON");
    });

    test("should return 400 when token is empty string", async () => {
      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "   ",
        }),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Invalid token format");
    });
  });

  // ========== HTTP METHOD ERRORS ==========
  describe("HTTP Method Validation", () => {
    test("should return 405 for GET requests", async () => {
      const event = {
        httpMethod: "GET",
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Method not allowed. Use POST.");
    });
  });

  // ========== AWS API ERRORS ==========
  describe("ResolveCustomer API Errors", () => {
    test("should return 410 when token is expired", async () => {
      resolveCustomer.mockRejectedValue(
        Object.assign(new Error("Token expired"), {
          name: "ExpiredTokenException",
        })
      );

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "expired-token-xyz",
        }),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(410);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Token has expired. Please re-purchase.");
    });

    test("should return 401 when token is invalid", async () => {
      resolveCustomer.mockRejectedValue(
        Object.assign(new Error("Invalid token"), {
          name: "InvalidTokenException",
        })
      );

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "invalid-token-000",
        }),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Invalid marketplace token.");
    });

    test("should return 503 when AWS API is down", async () => {
      resolveCustomer.mockRejectedValue(
        Object.assign(new Error("Service error"), {
          name: "ServiceUnavailableException",
        })
      );

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "valid-but-api-down",
        }),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(503);
      const body = JSON.parse(result.body);
      expect(body.error).toBe(
        "Service temporarily unavailable. Please try again."
      );
    });
  });

  // ========== RESPONSE FORMAT ==========
  describe("Response Format", () => {
    test("should include correct headers (CORS, security)", async () => {
      resolveCustomer.mockResolvedValue({
        CustomerIdentifier: "cust-test-002",
        ProductCode: "taskmaster-hiaas-prod",
      });

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "valid-token",
        }),
      };

      const result = await handler(event);

      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(result.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(result.headers["Cache-Control"]).toBe("no-store");
    });

    test("should return body as JSON string (not object)", async () => {
      resolveCustomer.mockResolvedValue({
        CustomerIdentifier: "cust-test-003",
        ProductCode: "taskmaster-hiaas-prod",
      });

      const event = {
        httpMethod: "POST",
        body: JSON.stringify({
          "x-amzn-marketplace-token": "valid-token",
        }),
      };

      const result = await handler(event);

      expect(typeof result.body).toBe("string");
      expect(() => JSON.parse(result.body)).not.toThrow();
    });
  });
});

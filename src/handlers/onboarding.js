const { resolveCustomer } = require("../services/marketplace");
const { extractToken } = require("../utils/validator");

async function handler(event) {
  console.log("Onboarding request received");

  // Step 1: Validate HTTP method
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method && method !== "POST") {
    return buildResponse(405, {
      error: "Method not allowed. Use POST.",
    });
  }

  // Step 2: Extract and validate token
  const { valid, token, error } = extractToken(event);

  if (!valid) {
    console.log("Token validation failed:", error);
    return buildResponse(400, { error });
  }

  // Step 3: Call ResolveCustomer API
  try {
    console.log("Resolving customer token...");
    const result = await resolveCustomer(token);

    console.log("Customer resolved successfully");

    // Step 4: Return success
    return buildResponse(200, {
      message: "Onboarding successful",
      customerIdentifier: result.CustomerIdentifier,
      productCode: result.ProductCode,
    });
  } catch (err) {
    console.error("ResolveCustomer failed:", err.name);

    if (err.name === "ExpiredTokenException") {
      return buildResponse(410, {
        error: "Token has expired. Please re-purchase.",
      });
    }

    if (err.name === "InvalidTokenException") {
      return buildResponse(401, {
        error: "Invalid marketplace token.",
      });
    }

    return buildResponse(503, {
      error: "Service temporarily unavailable. Please try again.",
    });
  }
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

module.exports = { handler };

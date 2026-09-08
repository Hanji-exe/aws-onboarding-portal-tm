function extractToken(event) {
  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    if (!body) {
      return { valid: false, token: null, error: "Request body is empty" };
    }

    const token = body["x-amzn-marketplace-token"];

    if (!token) {
      return {
        valid: false,
        token: null,
        error: "Missing x-amzn-marketplace-token",
      };
    }

    if (typeof token !== "string" || token.trim().length === 0) {
      return {
        valid: false,
        token: null,
        error: "Invalid token format",
      };
    }

    return { valid: true, token: token.trim(), error: null };
  } catch (err) {
    return {
      valid: false,
      token: null,
      error: "Malformed request body - invalid JSON",
    };
  }
}

module.exports = { extractToken };

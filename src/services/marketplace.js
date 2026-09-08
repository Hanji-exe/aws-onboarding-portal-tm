const {
  MarketplaceMeteringClient,
  ResolveCustomerCommand,
} = require("@aws-sdk/client-marketplace-metering");

const client = new MarketplaceMeteringClient({
  region: process.env.AWS_REGION || "us-east-1",
});

async function resolveCustomer(token) {
  const command = new ResolveCustomerCommand({
    RegistrationToken: token,
  });

  const response = await client.send(command);

  return {
    CustomerIdentifier: response.CustomerIdentifier,
    ProductCode: response.ProductCode,
  };
}

module.exports = { resolveCustomer };

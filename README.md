# Personal Finance MCP

A private, read-only connector that lets an AI assistant understand your financial accounts across institutions.

Plaid connects supported banks, credit cards, brokerages, and retirement accounts. A direct Benepass integration shows HSA cash and investments separately. Investment balances include brokerage cash; holdings are their breakdown. Account suffixes appear only when verified account numbers are available. Exact institution and account coverage depends on the provider connection.

The connector saves daily balance observations, banking transactions, and investment activity. Balances include retrieval timestamps, missing data stays unknown, and totals remain separate by currency. Investment holdings are never added to an account balance twice. Net-worth results flag missing values, unavailable connections, and observations retrieved more than 36 hours ago; a recent retrieval does not guarantee a live market valuation.

Disconnected accounts leave personal totals while their history stays available. Account preferences let you name accounts and exclude them from your personal net worth or spending analysis. Connecting an account does not transfer funds or authorize trading. Credentials and connection settings stay in the owner-only browser interface.

One Cloudflare Worker serves the MCP endpoint and account-management pages. SQLite-backed Durable Objects store financial history and coordinate refreshes; KV supports OAuth. No external database or paid Cloudflare service is required within the Free plan limits.

Plaid is a separate service: its free Trial currently allows ten created production connections. Approval and institution coverage must be verified; deleting a connection does not restore its Trial slot.

See [SETUP.md](SETUP.md) for development and deployment.

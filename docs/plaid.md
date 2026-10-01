# Bank connection

Budget can pull transactions from a bank in Canada or the United States. The connection is off until the flag is turned on and the keys are set. Merging the code does not connect a bank for anyone.

This is a record of spending you already chose to share. It is educational, not advice.

## Turn it on

Set these in Vercel, then redeploy. Use the same names in `.env.local` for a local check. Do not commit the values.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_BANK_CONNECT_ENABLED` | `1` or `true` shows Connect bank. Anything else hides it. A change needs a redeploy. |
| `BANK_CONNECT_ENABLED` | Server switch. `1` or `true` turns the API on. `0` or `false` turns the API off even when the public flag is on. Leave it unset to follow the public flag. |
| `PLAID_CLIENT_ID` | From the Plaid dashboard. Server only. |
| `PLAID_SECRET` | Server only. Never use a `NEXT_PUBLIC_` name. |
| `PLAID_ENV` | `sandbox` (default), `development`, or `production`. |
| `PLAID_WEBHOOK_URL` | `https://<domain>/api/plaid/webhook` |
| `PLAID_REDIRECT_URI` | OAuth banks. Usually `https://<domain>/budget` |
| `PLAID_TOKEN_ENCRYPTION_KEY` | 32-byte key. `openssl rand -base64 32`. Server only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already used by the server. Required to store connections. |

The browser receives a short-lived link token. It never receives the secret, the service role key, or the encryption key.

## Database

Apply these on the Supabase project, in order:

1. `supabase/migrations/013_user_plaid_items.sql`
2. `supabase/migrations/018_plaid_access_token_encryption.sql`

`user_plaid_items` stores one bank connection per person: institution name, encrypted access token, sync cursor, and status. `user_plaid_accounts` maps each bank account to a budget account.

Row level security limits rows to that person. The access token column is not granted to the browser role. Routes read and write it with the service role after checking the signed-in user. Tokens are encrypted with AES-256-GCM before they are stored.

## Sandbox

1. Turn the flag on and set sandbox `PLAID_CLIENT_ID` / `PLAID_SECRET`.
2. Open Accounts and choose Connect bank.
3. In the bank window, username `user_good`, password `pass_good`. Any sandbox institution works.
4. Choose which budget account each bank account feeds, or create a new one.
5. Transactions land in the register like any other imported row. Assign them to envelopes. Ready to Assign is unchanged until you assign those inflows.

Importing the same activity later as OFX or QFX does not add a second row when the amount, account, and date line up with a bank row, and a later bank sync does not add a second row for an OFX/QFX line already on that account.

## Production

Sandbox is not real bank data. Before a real bank can connect:

1. Create a Plaid account and an application at [dashboard.plaid.com](https://dashboard.plaid.com).
2. Request Transactions for the United States and Canada. Canadian banks are in scope. The product is not Canada-only.
3. Apply for Production access in the Plaid dashboard. Plaid reviews the application, the privacy policy, and the use case. Sandbox can be used before that approval. Production cannot.
4. Production bills per connected Item. Confirm the current Transactions price on Plaid's pricing page before turning the flag on for customers. Disconnect (`/item/remove`) ends the subscription for that connection.
5. Put the production secret in `PLAID_SECRET`, set `PLAID_ENV=production`, and set the webhook to `https://<production-domain>/api/plaid/webhook`.
6. Add the OAuth redirect `https://<production-domain>/budget` in the Plaid dashboard.
7. Update the privacy policy so it names bank-connection data: institution name, account name and mask, and transactions, why they are stored, and how a person deletes them. Plaid requires a public privacy-policy URL. Settings account deletion calls `/item/remove` before the rows are dropped. Do not turn the flag on in production until that page is accurate.
8. Leave `NEXT_PUBLIC_BANK_CONNECT_ENABLED` unset in production until the steps above are done.

## Security

- Link tokens, token exchange, sync, and disconnect run in route handlers. The secret stays on the server.
- Access tokens are encrypted at rest (AES-256-GCM, random 12-byte IV, authentication tag). The key is `PLAID_TOKEN_ENCRYPTION_KEY`.
- Webhooks are ignored unless the `Plaid-Verification` signature checks out: ES256, SHA-256 of the raw body, and a five-minute window.
- The sync cursor moves only after the budget plan is saved, so a failed save does not skip transactions.
- Disconnect calls Plaid `/item/remove` and then deletes the stored connection. Transactions already in the budget stay.
- Link is created with country codes US and CA.

## Checks

`scripts/test-plaid-crypto-unit.mts` covers the encryption helper. `scripts/test-plaid-sync-unit.mts` covers webhook signatures and the sync cursor. `scripts/test-budget-plaid-unit.mts` covers de-duplication against an OFX row and the account-mapping choice. Manual steps are in `docs/journey-manual-tests.md`, section 4.

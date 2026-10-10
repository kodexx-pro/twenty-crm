# Workspaces and external services

The fork enables multi-workspace mode by default. Workspace creation remains
restricted to instance administrators by the existing
`IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS` setting. Members can switch
between workspaces they already have access to. Roles and workspace data
isolation continue to use the existing authentication and permissions code.

## Domain configuration

Set `SERVER_URL` to the base domain, for example `https://crm.example.com`, and
keep `DEFAULT_SUBDOMAIN=app`. The global login page is then
`https://app.crm.example.com`, and workspaces use `https://<workspace>.crm.example.com`.
Do not include `app` or a workspace subdomain in `SERVER_URL`.

Configure DNS and the reverse proxy for the base domain and its wildcard,
`*.crm.example.com`, with TLS for both. Route those hosts to the same application.
For a separate frontend deployment, configure `FRONTEND_URL` as its base domain.

`IS_MULTIWORKSPACE_ENABLED=false` remains available for installations that need
the original single-domain behavior. Before enabling this on an existing server,
prepare the wildcard DNS and proxy. If the instance has a persisted configuration
override, update that setting through the admin panel as well.

Multi-workspace mode is independent of the managed Twenty cloud. The fork's
Compose configuration sets `IS_MANAGED_CLOUD_ENABLED=false`, so workspace
creation does not record acceptance of Twenty's cloud DPA. The login footer no
longer links to Twenty cloud agreements and keeps the SSO bypass action.
Configure your own customer policies separately.

## External requests

Telemetry is disabled by default. Even when enabled, it requires an explicitly
configured `TELEMETRY_API_URL`; there is no hosted fallback endpoint.

The optional settings below default to empty and are forwarded by Compose to
both the server and worker:

| Setting | Behavior when empty |
| --- | --- |
| `COMPANY_ENRICHMENT_API_URL` | Derive company names from domains without enrichment requests. |
| `COMPANY_LOGO_API_URL` | Skip automatic workspace logo imports from email domains. |
| `HELP_CENTER_SEARCH_URL` | Return an unavailable result instead of contacting the Twenty help proxy. Explicit Mintlify credentials still work. |
| `ENTERPRISE_API_URL` | Do not contact an Enterprise API. Verification and purchase operations fail closed or return unavailable; no license checks are bypassed. |
| `TELEMETRY_API_URL` | Do not send telemetry events. |

Domain-based record logo inference has no hosted default. Uploaded images remain
available. The default workspace logo is served from bundled assets; onboarding
previews and newly inserted sample contacts use avatar fallbacks without remote
Twenty images.

SMTP, OAuth, storage, AI providers and other integrations use the credentials and
endpoints configured by the operator. Manual documentation links and license
notices remain. Existing record data and previously configured external image or
service URLs are not rewritten by this change; audit those when migrating an
existing installation.

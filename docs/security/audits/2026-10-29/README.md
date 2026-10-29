# Security and configuration audits - 2026-10-29

Four audit reports were produced on 2026-10-29. They are stored here as **redacted copies**:

| File | Scope |
|---|---|
| `data-layer-rls-audit.md` | Services, data layer and Row Level Security posture |
| `configuration-audit.md` | Configuration audit (28 findings) |
| `remediation-report.md` | Remediation guidance for the top findings |
| `cicd-audit.md` | CI/CD, headers, CORS and supply chain (20 findings) |

Notes:

- Secrets (an EAS robot token), personal email addresses and local filesystem paths were replaced with `<REDACTED: ...>` / `<local-path>` placeholders.
- "Safe Reproduction" blocks were removed from the public copy until the underlying findings are fixed.
- The auditors scanned an older snapshot of a monorepo copy of this project (`apps/SUB-PRO`). File paths and line numbers may be stale, and some findings (for example monorepo-only `.archive/` env files or the bun lockfile) do not apply to this repository.
- Every finding that applies to this repository is tracked as a GitHub issue. The tracker issue link will be added here once it exists.

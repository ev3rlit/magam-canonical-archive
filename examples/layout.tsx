import { Canvas, MindMap, Node, Markdown } from '@magam/core';

// Layout Strategy Comparison
// Real-world project structure with varying depths (1~4) and mixed content sizes

// Depth-level background colors (Tailwind classes)
const depthCls = [
'bg-rose-500 text-white', // depth 0: root
'bg-violet-500 text-white', // depth 1: fe, be, infra, mobile, ai
'bg-cyan-500 text-white', // depth 2
'bg-yellow-400 text-black' // depth 3
] as const;

function ProjectNodes({ label, density }: {label: string;density?: number;}) {
  return (
    <>
      {/* Depth 0: Root — large markdown block */}
      <Node id="root" bubble className={depthCls[0]}>
        <Markdown>{`# ${label}${density != null ? ` density={${density}}` : ''}
*SaaS Platform*

> Full-stack product roadmap`}</Markdown>
      </Node>

      {/* ─── Branch 1: Frontend (depth 4) ─── */}
      <Node id="fe" from="root" className={depthCls[1]}>
        <Markdown>{`## Frontend
React 19 + Next.js 15`}</Markdown>
      </Node>

      <Node id="fe-auth" from="fe" className={depthCls[2]}>
        <Markdown>{`### Auth Module
- OAuth2 / OIDC
- Session management
- RBAC middleware`}</Markdown>
      </Node>
      <Node id="fe-auth-google" from="fe-auth" className={depthCls[3]}>Google SSO</Node>
      <Node id="fe-auth-github" from="fe-auth" className={depthCls[3]}>GitHub SSO</Node>
      <Node id="fe-auth-mfa" from="fe-auth" className={depthCls[3]}>
        <Markdown>{`**MFA**
TOTP + WebAuthn`}</Markdown>
      </Node>

      <Node id="fe-dash" from="fe" className={depthCls[2]}>
        <Markdown>{`### Dashboard
- Chart.js widgets
- Real-time updates`}</Markdown>
      </Node>
      <Node id="fe-dash-analytics" from="fe-dash" className={depthCls[3]}>Analytics View</Node>
      <Node id="fe-dash-alerts" from="fe-dash" className={depthCls[3]}>Alert Panel</Node>

      <Node id="fe-design" from="fe" className={depthCls[2]}>Design System</Node>
      <Node id="fe-design-tokens" from="fe-design" className={depthCls[3]}>Tokens</Node>
      <Node id="fe-design-components" from="fe-design" className={depthCls[3]}>
        <Markdown>{`**Components**
Button, Input, Modal, Toast, Table, Card`}</Markdown>
      </Node>

      {/* ─── Branch 2: Backend (depth 4) ─── */}
      <Node id="be" from="root" className={depthCls[1]}>
        <Markdown>{`## Backend
Node.js + Hono`}</Markdown>
      </Node>

      <Node id="be-api" from="be" className={depthCls[2]}>
        <Markdown>{`### REST API
- OpenAPI 3.1 spec
- Rate limiting
- Versioned routes`}</Markdown>
      </Node>
      <Node id="be-api-users" from="be-api" className={depthCls[3]}>Users CRUD</Node>
      <Node id="be-api-billing" from="be-api" className={depthCls[3]}>
        <Markdown>{`**Billing**
Stripe integration, webhooks, invoices`}</Markdown>
      </Node>
      <Node id="be-api-webhooks" from="be-api" className={depthCls[3]}>Webhook Dispatch</Node>

      <Node id="be-ws" from="be" className={depthCls[2]}>
        <Markdown>{`### WebSocket
JSON-RPC 2.0 protocol`}</Markdown>
      </Node>
      <Node id="be-ws-presence" from="be-ws" className={depthCls[3]}>Presence</Node>
      <Node id="be-ws-sync" from="be-ws" className={depthCls[3]}>Real-time Sync</Node>

      <Node id="be-jobs" from="be" className={depthCls[2]}>Background Jobs</Node>
      <Node id="be-jobs-email" from="be-jobs" className={depthCls[3]}>Email Queue</Node>
      <Node id="be-jobs-export" from="be-jobs" className={depthCls[3]}>CSV Export</Node>

      {/* ─── Branch 3: Infra (depth 3) ─── */}
      <Node id="infra" from="root" className={depthCls[1]}>
        <Markdown>{`## Infrastructure
AWS + Terraform`}</Markdown>
      </Node>

      <Node id="infra-ci" from="infra" className={depthCls[2]}>
        <Markdown>{`### CI/CD
GitHub Actions
- lint → test → build → deploy
- Preview on PR`}</Markdown>
      </Node>

      <Node id="infra-db" from="infra" className={depthCls[2]} x={907.6116366538595} y={6598.108483397368}>
        <Markdown>{`### Database
PostgreSQL 16 + pgvector`}</Markdown>
      </Node>
      <Node id="infra-db-migrations" from="infra-db" className={depthCls[3]}>Drizzle Migrations</Node>
      <Node id="infra-db-replica" from="infra-db" className={depthCls[3]}>Read Replica</Node>

      <Node id="infra-cache" from="infra" className={depthCls[2]} x={13729.5} y={5298.666666666666}>Redis Cache</Node>

      <Node id="infra-monitoring" from="infra" className={depthCls[2]} x={932} y={6987.833333333333}>
        <Markdown>{`### Monitoring
- Grafana dashboards
- PagerDuty alerts
- Sentry error tracking`}</Markdown>
      </Node>

      {/* ─── Branch 4: Mobile (depth 2, shallow) ─── */}
      <Node id="mobile" from="root" className={depthCls[1]}>
        <Markdown>{`## Mobile
React Native + Expo`}</Markdown>
      </Node>
      <Node id="mobile-ios" from="mobile" className={depthCls[2]}>iOS App</Node>
      <Node id="mobile-android" from="mobile" className={depthCls[2]}>Android App</Node>
      <Node id="mobile-push" from="mobile" className={depthCls[2]}>
        <Markdown>{`**Push Notifications**
FCM + APNs`}</Markdown>
      </Node>

      {/* ─── Branch 5: AI (depth 1, leaf only) ─── */}
      <Node id="ai" from="root" className={depthCls[1]} x={1226.432810138788} y={6331.01739846993}>
        <Markdown>{`## AI Features
RAG pipeline, embeddings, Claude API`}</Markdown>
      </Node>
    </>);

}

export default function LayoutComparison() {
  return (
    <Canvas>
      <MindMap id="tree-map" layout="tree">
        <ProjectNodes label='layout="tree"' />
      </MindMap>

      <MindMap id="bidir-map" layout="bidirectional" x={0} y={900}>
        <ProjectNodes label='layout="bidirectional"' />
      </MindMap>

      {/* Newly stabilized dense compact layout */}
      <MindMap id="compact-map" layout="compact" x={0} y={1800}>
        <ProjectNodes label='layout="compact" (dense)' />
      </MindMap>

      <MindMap id="compact-bidir-map" layout="compact-bidir" x={0} y={2700}>
        <ProjectNodes label='layout="compact-bidir"' />
      </MindMap>

      <MindMap id="depth-hybrid-map" layout="depth-hybrid" x={0} y={3600}>
        <ProjectNodes label='layout="depth-hybrid"' />
      </MindMap>

      <MindMap id="treemap-pack-map" layout="treemap-pack" x={0} y={4500}>
        <ProjectNodes label='layout="treemap-pack"' />
      </MindMap>

      <MindMap id="quadrant-pack-map" layout="quadrant-pack" x={0} y={5400}>
        <ProjectNodes label='layout="quadrant-pack"' density={1.0} />
      </MindMap>

      <MindMap id="voronoi-pack-map" layout="voronoi-pack" x={0} y={6300}>
        <ProjectNodes label='layout="voronoi-pack"' density={0.5} />
      </MindMap>
    </Canvas>);

}
import { Fragment } from 'react';
import { Canvas, MindMap, Node, Markdown } from '@magam/core';

// Layout Strategy Comparison
// Stress fixture: each depth-level sibling count is expanded to surface overlap
// problems more clearly, especially in top/bottom fan-out sectors.

const depthCls = [
  'bg-rose-500 text-white',
  'bg-violet-500 text-white',
  'bg-cyan-500 text-white',
  'bg-yellow-400 text-black',
] as const;

type ProjectNodeSpec = {
  id: string;
  content: string;
  markdown?: boolean;
  bubble?: boolean;
  children?: ProjectNodeSpec[];
};

const EXAMPLE_DEPTH_CHILD_LIMITS = [10, 6, 4] as const;

function textNode(id: string, content: string, children: ProjectNodeSpec[] = []): ProjectNodeSpec {
  return { id, content, children };
}

function markdownNode(id: string, content: string, children: ProjectNodeSpec[] = []): ProjectNodeSpec {
  return { id, content, markdown: true, children };
}

function buildProjectTree(label: string, density?: number): ProjectNodeSpec {
  return {
    id: 'root',
    bubble: true,
    markdown: true,
    content: `# ${label}${density != null ? ` density={${density}}` : ''}
*SaaS Platform*

> Full-stack product roadmap`,
    children: [
      markdownNode('fe', `## Frontend
React 19 + Next.js 15`, [
        markdownNode('fe-auth', `### Auth Module
- OAuth2 / OIDC
- Session management
- RBAC middleware`, [
          textNode('fe-auth-google', 'Google SSO'),
          textNode('fe-auth-github', 'GitHub SSO'),
          markdownNode('fe-auth-mfa', `**MFA**
TOTP + WebAuthn`),
          textNode('fe-auth-magic-link', 'Magic Link'),
          textNode('fe-auth-saml', 'SAML Enterprise'),
          textNode('fe-auth-device-trust', 'Device Trust'),
          textNode('fe-auth-session-audit', 'Session Audit'),
          textNode('fe-auth-risk-engine', 'Risk Engine'),
          textNode('fe-auth-access-approvals', 'Access Approvals'),
        ]),
        markdownNode('fe-dash', `### Dashboard
- Chart.js widgets
- Real-time updates`, [
          textNode('fe-dash-analytics', 'Analytics View'),
          textNode('fe-dash-alerts', 'Alert Panel'),
          textNode('fe-dash-cohort', 'Cohort Explorer'),
          textNode('fe-dash-revenue', 'Revenue Board'),
          textNode('fe-dash-funnel', 'Funnel Monitor'),
          textNode('fe-dash-anomaly', 'Anomaly Feed'),
        ]),
        textNode('fe-design', 'Design System', [
          textNode('fe-design-tokens', 'Tokens'),
          markdownNode('fe-design-components', `**Components**
Button, Input, Modal, Toast, Table, Card`),
          textNode('fe-design-iconography', 'Iconography'),
          textNode('fe-design-motion', 'Motion System'),
          textNode('fe-design-a11y', 'Accessibility Kit'),
          textNode('fe-design-theming', 'Theming'),
        ]),
        markdownNode('fe-editor', `### Editor Surface
- Block editing
- Rich interactions`, [
          textNode('fe-editor-blocks', 'Block Library'),
          textNode('fe-editor-slash', 'Slash Menu'),
          textNode('fe-editor-palette', 'Command Palette'),
          textNode('fe-editor-cursors', 'Collaboration Cursors'),
          textNode('fe-editor-presence', 'Presence Layer'),
          textNode('fe-editor-shortcuts', 'Keyboard Shortcuts'),
        ]),
        markdownNode('fe-search', `### Search Experience
- Instant filtering
- Saved views`, [
          textNode('fe-search-semantic', 'Semantic Search'),
          textNode('fe-search-filters', 'Facet Filters'),
          textNode('fe-search-saved', 'Saved Views'),
          textNode('fe-search-ranking', 'Ranking Tuning'),
          textNode('fe-search-highlights', 'Highlight Snippets'),
          textNode('fe-search-recents', 'Recent Queries'),
        ]),
        markdownNode('fe-notify', `### Notification Center
- Inbox
- Digest management`, [
          textNode('fe-notify-email', 'Email Digest'),
          textNode('fe-notify-inapp', 'In-App Feed'),
          textNode('fe-notify-preferences', 'Preferences'),
          textNode('fe-notify-webpush', 'Web Push'),
          textNode('fe-notify-rules', 'Rule Builder'),
          textNode('fe-notify-routing', 'Routing Matrix'),
        ]),
        markdownNode('fe-settings', `### Settings
- Workspace administration`, [
          textNode('fe-settings-profile', 'Profile'),
          textNode('fe-settings-team', 'Team Directory'),
          textNode('fe-settings-billing', 'Billing UI'),
          textNode('fe-settings-permissions', 'Permissions'),
          textNode('fe-settings-branding', 'Branding'),
          textNode('fe-settings-domains', 'Domains'),
        ]),
        markdownNode('fe-onboarding', `### Onboarding
- Guided setup
- Product education`, [
          textNode('fe-onboarding-checklist', 'Checklist'),
          textNode('fe-onboarding-tours', 'Guided Tours'),
          textNode('fe-onboarding-seed', 'Seed Data'),
          textNode('fe-onboarding-invites', 'Invite Flow'),
          textNode('fe-onboarding-empty', 'Empty States'),
          textNode('fe-onboarding-help', 'Help Drawer'),
        ]),
        markdownNode('fe-experiments', `### Experimentation
- Targeted rollout`, [
          textNode('fe-experiments-flags', 'Feature Flags'),
          textNode('fe-experiments-ab', 'A/B Tests'),
          textNode('fe-experiments-targeting', 'Audience Targeting'),
          textNode('fe-experiments-metrics', 'Experiment Metrics'),
          textNode('fe-experiments-guardrails', 'Guardrails'),
          textNode('fe-experiments-rollout', 'Progressive Rollout'),
        ]),
      ]),

      markdownNode('be', `## Backend
Node.js + Hono`, [
        markdownNode('be-api', `### REST API
- OpenAPI 3.1 spec
- Rate limiting
- Versioned routes`, [
          textNode('be-api-users', 'Users CRUD'),
          markdownNode('be-api-billing', `**Billing**
Stripe integration, webhooks, invoices`),
          textNode('be-api-webhooks', 'Webhook Dispatch'),
          textNode('be-api-organizations', 'Organizations'),
          textNode('be-api-admin', 'Admin Console'),
          textNode('be-api-audit', 'Audit Exports'),
          textNode('be-api-keys', 'API Keys'),
          textNode('be-api-quotas', 'Quota Enforcement'),
          textNode('be-api-search', 'Search Indexing'),
        ]),
        markdownNode('be-ws', `### WebSocket
JSON-RPC 2.0 protocol`, [
          textNode('be-ws-presence', 'Presence'),
          textNode('be-ws-sync', 'Real-time Sync'),
          textNode('be-ws-cursors', 'Shared Cursors'),
          textNode('be-ws-events', 'Event Stream'),
          textNode('be-ws-reconnect', 'Reconnect Flow'),
          textNode('be-ws-rate-limit', 'Rate Limit'),
        ]),
        textNode('be-jobs', 'Background Jobs', [
          textNode('be-jobs-email', 'Email Queue'),
          textNode('be-jobs-export', 'CSV Export'),
          textNode('be-jobs-cleanup', 'Cleanup'),
          textNode('be-jobs-retry', 'Retry Manager'),
          textNode('be-jobs-backfill', 'Backfill'),
          textNode('be-jobs-digest', 'Digest Builder'),
        ]),
        markdownNode('be-storage', `### Object Storage
- Upload pipeline`, [
          textNode('be-storage-s3', 'S3 Buckets'),
          textNode('be-storage-signing', 'Signed URLs'),
          textNode('be-storage-thumbs', 'Thumbnailing'),
          textNode('be-storage-retention', 'Retention'),
          textNode('be-storage-archive', 'Archive Tier'),
          textNode('be-storage-virus', 'Virus Scan'),
        ]),
        markdownNode('be-authz', `### Authorization
- Policy evaluation`, [
          textNode('be-authz-policies', 'Policy Store'),
          textNode('be-authz-evaluator', 'Policy Evaluator'),
          textNode('be-authz-groups', 'Groups'),
          textNode('be-authz-roles', 'Roles'),
          textNode('be-authz-claims', 'Claims Mapping'),
          textNode('be-authz-shadow', 'Shadow Checks'),
        ]),
        markdownNode('be-audit', `### Audit Trail
- Event history`, [
          textNode('be-audit-log', 'Event Log'),
          textNode('be-audit-diffs', 'Diff Storage'),
          textNode('be-audit-retention', 'Retention Rules'),
          textNode('be-audit-export', 'Export Jobs'),
          textNode('be-audit-redaction', 'Redaction'),
          textNode('be-audit-legal', 'Legal Hold'),
        ]),
        markdownNode('be-integrations', `### Integrations
- External app connectors`, [
          textNode('be-integrations-slack', 'Slack'),
          textNode('be-integrations-notion', 'Notion'),
          textNode('be-integrations-zendesk', 'Zendesk'),
          textNode('be-integrations-salesforce', 'Salesforce'),
          textNode('be-integrations-linear', 'Linear'),
          textNode('be-integrations-jira', 'Jira'),
        ]),
        markdownNode('be-analytics', `### Analytics Pipeline
- Event processing`, [
          textNode('be-analytics-events', 'Event Intake'),
          textNode('be-analytics-sessions', 'Sessionization'),
          textNode('be-analytics-warehouse', 'Warehouse Sync'),
          textNode('be-analytics-rollups', 'Rollups'),
          textNode('be-analytics-retention', 'Retention Curves'),
          textNode('be-analytics-alerting', 'Alert Rules'),
        ]),
        markdownNode('be-workflows', `### Workflow Engine
- Orchestrated automation`, [
          textNode('be-workflows-triggers', 'Triggers'),
          textNode('be-workflows-steps', 'Steps'),
          textNode('be-workflows-approvals', 'Approvals'),
          textNode('be-workflows-schedules', 'Schedules'),
          textNode('be-workflows-conditions', 'Conditions'),
          textNode('be-workflows-retries', 'Step Retries'),
        ]),
      ]),

      markdownNode('infra', `## Infrastructure
AWS + Terraform`, [
        markdownNode('infra-ci', `### CI/CD
GitHub Actions
- lint -> test -> build -> deploy
- Preview on PR`, [
          textNode('infra-ci-lint', 'Lint'),
          textNode('infra-ci-test', 'Test'),
          textNode('infra-ci-build', 'Build'),
          textNode('infra-ci-preview', 'Preview Deploy'),
          textNode('infra-ci-release', 'Release Cut'),
          textNode('infra-ci-rollback', 'Rollback'),
        ]),
        markdownNode('infra-db', `### Database
PostgreSQL 16 + pgvector`, [
          textNode('infra-db-migrations', 'Drizzle Migrations'),
          textNode('infra-db-replica', 'Read Replica'),
          textNode('infra-db-backups', 'Backups'),
          textNode('infra-db-failover', 'Failover'),
          textNode('infra-db-indexing', 'Index Tuning'),
          textNode('infra-db-archival', 'Cold Archive'),
        ]),
        textNode('infra-cache', 'Redis Cache', [
          textNode('infra-cache-rate-limit', 'Rate Limiting'),
          textNode('infra-cache-sessions', 'Session Cache'),
          textNode('infra-cache-queues', 'Queue Buffers'),
          textNode('infra-cache-hotkeys', 'Hot Keys'),
          textNode('infra-cache-eviction', 'Eviction Policy'),
          textNode('infra-cache-cluster', 'Cluster Slots'),
        ]),
        markdownNode('infra-monitoring', `### Monitoring
- Grafana dashboards
- PagerDuty alerts
- Sentry error tracking`, [
          textNode('infra-monitoring-metrics', 'Metrics'),
          textNode('infra-monitoring-logs', 'Logs'),
          textNode('infra-monitoring-traces', 'Traces'),
          textNode('infra-monitoring-alerts', 'Alert Rules'),
          textNode('infra-monitoring-slos', 'SLOs'),
          textNode('infra-monitoring-oncall', 'On-Call'),
        ]),
        textNode('infra-network', 'Networking'),
        textNode('infra-security', 'Security'),
        textNode('infra-secrets', 'Secret Rotation'),
        textNode('infra-edge', 'Edge Delivery'),
        textNode('infra-queues', 'Queue Workers'),
        textNode('infra-cost', 'Cost Controls'),
        textNode('infra-disaster', 'Disaster Recovery'),
        textNode('infra-sandbox', 'Sandbox Environments'),
      ]),

      markdownNode('mobile', `## Mobile
React Native + Expo`, [
        textNode('mobile-ios', 'iOS App'),
        textNode('mobile-android', 'Android App'),
        markdownNode('mobile-push', `**Push Notifications**
FCM + APNs`),
        textNode('mobile-offline', 'Offline Sync'),
        textNode('mobile-widgets', 'Home Widgets'),
        textNode('mobile-deeplinks', 'Deep Links'),
        textNode('mobile-subscriptions', 'Subscriptions'),
        textNode('mobile-device-security', 'Device Security'),
        textNode('mobile-telemetry', 'Telemetry'),
      ]),

      markdownNode('ai', `## AI Features
RAG pipeline, embeddings, Claude API`, [
        textNode('ai-rag', 'RAG Retrieval'),
        textNode('ai-prompts', 'Prompt Library'),
        textNode('ai-evals', 'Eval Harness'),
      ]),
      markdownNode('data', `## Data Platform
Warehousing + ETL`, [
        textNode('data-pipelines', 'ETL Pipelines'),
        textNode('data-quality', 'Quality Checks'),
        textNode('data-marts', 'Data Marts'),
      ]),
      markdownNode('growth', `## Growth
Acquisition + activation`, [
        textNode('growth-funnels', 'Funnels'),
        textNode('growth-lifecycle', 'Lifecycle'),
        textNode('growth-referrals', 'Referrals'),
      ]),
      markdownNode('platform', `## Platform
Shared runtime services`, [
        textNode('platform-sdk', 'SDKs'),
        textNode('platform-config', 'Config Service'),
        textNode('platform-tenancy', 'Multi-Tenancy'),
      ]),
      markdownNode('security', `## Security
Trust and compliance`, [
        textNode('security-soc2', 'SOC 2'),
        textNode('security-dlp', 'DLP'),
        textNode('security-incident', 'Incident Response'),
      ]),
      markdownNode('support', `## Support
Customer operations`, [
        textNode('support-helpdesk', 'Helpdesk'),
        textNode('support-macros', 'Support Macros'),
        textNode('support-playbooks', 'Playbooks'),
      ]),
      markdownNode('qa', `## QA
Release confidence`, [
        textNode('qa-regression', 'Regression Runs'),
        textNode('qa-fixtures', 'Fixture Catalog'),
        textNode('qa-triage', 'Bug Triage'),
      ]),
      markdownNode('docs', `## Documentation
Knowledge system`, [
        textNode('docs-api', 'API Docs'),
        textNode('docs-guides', 'Guides'),
        textNode('docs-changelog', 'Changelog'),
      ]),
      markdownNode('finance', `## Finance
Revenue operations`, [
        textNode('finance-invoicing', 'Invoicing'),
        textNode('finance-forecasting', 'Forecasting'),
        textNode('finance-revrec', 'Revenue Recognition'),
      ]),
      markdownNode('sales', `## Sales
Pipeline operations`, [
        textNode('sales-crm', 'CRM'),
        textNode('sales-enable', 'Enablement'),
        textNode('sales-forecast', 'Pipeline Forecast'),
      ]),
      markdownNode('ops', `## Operations
Internal enablement`, [
        textNode('ops-runbooks', 'Runbooks'),
        textNode('ops-procurement', 'Procurement'),
        textNode('ops-vendors', 'Vendor Mgmt'),
      ]),
    ],
  };
}

function pruneProjectTree(
  node: ProjectNodeSpec,
  depth = 0,
): ProjectNodeSpec {
  const limit = EXAMPLE_DEPTH_CHILD_LIMITS[Math.min(depth, EXAMPLE_DEPTH_CHILD_LIMITS.length - 1)];
  return {
    ...node,
    children: node.children
      ?.slice(0, limit)
      .map((child) => pruneProjectTree(child, depth + 1)),
  };
}

function renderProjectNode(node: ProjectNodeSpec, depth: number, parentId?: string) {
  const className = depthCls[Math.min(depth, depthCls.length - 1)];

  return (
    <Fragment key={node.id}>
      <Node
        id={node.id}
        {...(parentId ? { from: parentId } : {})}
        {...(node.bubble ? { bubble: true } : {})}
        className={className}
      >
        {node.markdown ? <Markdown>{node.content}</Markdown> : node.content}
      </Node>
      {node.children?.map((child) => renderProjectNode(child, depth + 1, node.id))}
    </Fragment>
  );
}

function ProjectNodes({ label, density }: { label: string; density?: number }) {
  const tree = pruneProjectTree(buildProjectTree(label, density));
  return <>{renderProjectNode(tree, 0)}</>;
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
    </Canvas>
  );
}

export type WorkspaceStyleCategory =
  | 'size'
  | 'basic-visual'
  | 'shadow-elevation'
  | 'outline-emphasis';

export type WorkspaceStyleCategoryStatus = 'supported' | 'planned' | 'unsupported';

export interface WorkspaceStyleInput {
  objectId: string;
  className: string;
  sourceRevision: string;
  timestamp: number;
  groupId?: string;
}

export interface WorkspaceStyleRuntimeContext {
  colorScheme: 'light' | 'dark';
  viewportWidth: number;
}

export interface EligibleObjectCapabilities {
  hasClassNameSurface: boolean;
  supportsStylingProps: boolean;
  supportsSizeProps: boolean;
}

export interface EligibleObjectProfile extends EligibleObjectCapabilities {
  objectId: string;
  isEligible: boolean;
  reasonIfIneligible?: string;
}

export interface ClassCategoryDefinition {
  category: WorkspaceStyleCategory;
  priority: number;
  status: WorkspaceStyleCategoryStatus;
  tokenPatterns: string[];
}

export type WorkspaceStyleStatus = 'applied' | 'partial' | 'reset' | 'unsupported';

export interface ResolvedStylePayload {
  className: string;
  categories: WorkspaceStyleCategory[];
  tokensByCategory: Partial<Record<WorkspaceStyleCategory, string[]>>;
  style: Record<string, string | number>;
  hoverStyle?: Record<string, string | number>;
  focusStyle?: Record<string, string | number>;
  activeStyle?: Record<string, string | number>;
  groupHoverStyle?: Record<string, string | number>;
}

export interface InterpretedStyleResult {
  objectId: string;
  appliedCategories: WorkspaceStyleCategory[];
  appliedTokens: string[];
  ignoredTokens: string[];
  resolvedStylePayload?: ResolvedStylePayload;
  status: WorkspaceStyleStatus;
}

export type StylingDiagnosticCode =
  | 'OUT_OF_SCOPE_OBJECT'
  | 'UNSUPPORTED_CATEGORY'
  | 'UNSUPPORTED_TOKEN'
  | 'MIXED_INPUT'
  | 'STALE_UPDATE';

export type StylingDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface StylingDiagnostic {
  objectId: string;
  code: StylingDiagnosticCode;
  message: string;
  token?: string;
  category?: WorkspaceStyleCategory;
  severity: StylingDiagnosticSeverity;
  revision: string;
}

export interface StyleUpdateSession {
  sessionId: string;
  objectId: string;
  latestAcceptedRevision: string;
  lastAppliedAt: number;
  updateCount: number;
}

export interface WorkspaceStyleSessionState {
  sessionId: string;
  byObjectId: Record<string, StyleUpdateSession>;
}

export interface SessionUpdateInput {
  objectId: string;
  sourceRevision: string;
  timestamp: number;
}

export interface SessionUpdateResult {
  state: WorkspaceStyleSessionState;
  stale: boolean;
}

export interface ClassifiedToken {
  token: string;
  baseToken: string;
  variants: string[];
  category: WorkspaceStyleCategory | null;
  supported: boolean;
}

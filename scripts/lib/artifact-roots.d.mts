export const repoRoot: string;
export const managedArtifactRoot: string;
export const cargoConfigPath: string;

export function cargoTargetRoot(): string;
export function cargoBuildRoot(): string;
export function managedDistRoot(): string;
export function managedPlaywrightReportRoot(): string;
export function managedPlaywrightTestResultsRoot(): string;
export function managedPlaywrightCoverageRoot(): string;
export function managedCiArtifactsRoot(): string;
export function githubPackagingManifestPath(): string;
export function dmgOutputRoot(targetTriple: string): string;
export function toPortablePath(value: string): string;
export function repoRelativePath(absolutePath: string): string;

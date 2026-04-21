export type ChoiceAlignment = "left" | "center";

export interface RenderOptions {
  emitSourceData?: boolean;
  verticalSeparation?: number;
  arcRadius?: number;
  diagramPadding?: number;
  strokeWidth?: number;
  choiceAlignment?: ChoiceAlignment;
}

export interface ResolvedOptions {
  emitSourceData: boolean;
  verticalSeparation: number;
  arcRadius: number;
  diagramPadding: number;
  strokeWidth: number;
  choiceAlignment: ChoiceAlignment;
}

export function resolveOptions(opts: RenderOptions | undefined): ResolvedOptions {
  return {
    emitSourceData: opts?.emitSourceData ?? false,
    verticalSeparation: opts?.verticalSeparation ?? 8,
    arcRadius: opts?.arcRadius ?? 10,
    diagramPadding: opts?.diagramPadding ?? 10,
    strokeWidth: opts?.strokeWidth ?? 1,
    choiceAlignment: opts?.choiceAlignment ?? "left",
  };
}

export { QTypstMate, DEFAULT_PREAMBLE, resolveMathEngine } from "./transformer";
export type { QTypstMateOptions } from "./transformer";
export { DEFAULT_PROCESSORS, usesLatexRenderer } from "./processor";
export type { Processor, ProcessorKind, ProcessorSets, RenderingEngine } from "./processor";

// Re-export shared types from @quartz-community/types
export type { QuartzTransformerPlugin } from "@quartz-community/types";

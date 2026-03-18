// Ambient declaration for the optional "mistral" SDK so TypeScript/tsc doesn't error
// when the package isn't installed. The runtime code uses dynamic import and feature-detection.
declare module "mistral" {
  const _default: any;
  export default _default;
  export const Mistral: any;
  export const MistralClient: any;
}
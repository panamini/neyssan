declare module "wink-pos-tagger" {
  export type WinkPosToken = Readonly<{
    value: string;
    normal: string;
    pos: string;
    tag: string;
    lemma?: string;
  }>;

  export type WinkPosTagger = Readonly<{
    tagSentence(text: string): WinkPosToken[];
  }>;

  export default function createWinkPosTagger(): WinkPosTagger;
}

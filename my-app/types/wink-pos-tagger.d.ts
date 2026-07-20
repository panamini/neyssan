declare module "wink-pos-tagger" {
  export type WinkPosToken = Readonly<{
    value: string;
    normal: string;
    pos: string;
    lemma: string;
  }>;

  export type WinkPosTagger = Readonly<{
    tagSentence: (sentence: string) => WinkPosToken[];
  }>;

  export default function createWinkPosTagger(): WinkPosTagger;
}

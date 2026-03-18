import shutil
import spacy
from spacy.cli.train import train as spacy_train
from spacy.tokens import DocBin
from spacy.training.example import Example
from spacy.scorer import Scorer
from pathlib import Path
import sys

def main():
    config_path = Path("cv_parser/config_roberta.cfg")
    print(f"📄 Loading config from: {config_path}")
    if not config_path.exists():
        print(f"❌ Config file not found at {config_path}")
        sys.exit(1)

    overrides = {
        "paths.train": "my-app/testdata/cv_filtered/train.spacy",
        "paths.dev": "my-app/testdata/cv_filtered/dev.spacy",
        "training.max_steps": 200,
        "training.optimizer.learn_rate.initial_rate": 7e-5,
        "training.optimizer.learn_rate.warmup_steps": 0,
    }

    print("⚙️ Applied overrides:")
    for k, v in overrides.items():
        print(f"  {k}: {v}")

    # === Load and check data ===
    nlp_tmp = spacy.blank("en")
    train_docs = list(DocBin().from_disk(overrides["paths.train"]).get_docs(nlp_tmp.vocab))
    dev_docs = list(DocBin().from_disk(overrides["paths.dev"]).get_docs(nlp_tmp.vocab))
    if not train_docs:
        print("❌ Training dataset is empty!")
        sys.exit(1)
    if not dev_docs:
        print("❌ Dev dataset is empty!")
        sys.exit(1)

    print(f"📊 Training set: {len(train_docs)} docs, {sum(len(d.ents) for d in train_docs)} entities")
    print(f"📊 Dev set: {len(dev_docs)} docs, {sum(len(d.ents) for d in dev_docs)} entities")

    # === Prepare output directory ===
    output_dir = Path("training/out_cpu_sanity_py")
    if output_dir.exists():
        print(f"🧹 Removing previous output directory: {output_dir}")
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # === Train ===
    print(f"🚀 Starting spaCy training -> {output_dir}")
    spacy_train(
        config_path=str(config_path),
        output_path=str(output_dir),
        overrides=overrides,
        use_gpu=-1,
    )
    print("✅ Training completed.")

    # === Evaluate ===
    print("🔍 Loading trained model for evaluation...")
    nlp = spacy.load(output_dir)
    examples = [Example(nlp(doc.text), doc) for doc in dev_docs]
    scores = Scorer().score(examples)

    print(f"📈 ENTS_P: {scores['ents_p']:.3f} | ENTS_R: {scores['ents_r']:.3f} | ENTS_F: {scores['ents_f']:.3f}")

if __name__ == "__main__":
    main()

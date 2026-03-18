from spacy.cli.train import train

train(
  config_path="cv_parser/config_roberta.cfg",
  output_path="training/out_fix1k",
  overrides={
    "paths.train": "my-app/testdata/cv_filtered/train.spacy",
    "paths.dev": "my-app/testdata/cv_filtered/dev.spacy",
    "training.max_steps": 1200,
    "training.eval_frequency": 100,
    "training.optimizer.learn_rate.initial_rate": 7e-5,
    "training.optimizer.learn_rate.warmup_steps": 0,
  },
  use_gpu=0,  # ✅ enable MPS (Apple GPU)
)

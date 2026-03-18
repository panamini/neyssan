"""Custom NER component variants for precision tuning."""

from __future__ import annotations

from typing import Iterable, List, Optional

import numpy
from spacy.language import Language
from spacy.pipeline.ner import EntityRecognizer
from spacy.pipeline._parser_internals.transition_system import TransitionSystem
from spacy.training import Example
from spacy.util import registry
from thinc.api import Model
from thinc.config import Config

DEFAULT_CONFIG_BLOCK = Config().from_str(
    """
    [model]
    @architectures = "spacy.TransitionBasedParser.v2"
    state_type = "ner"
    extra_state_tokens = false
    hidden_width = 128
    maxout_pieces = 2
    use_upper = false
    nO = null

    [model.tok2vec]
    @architectures = "spacy-transformers.TransformerListener.v1"
    grad_factor = 0.5
    pooling = {"@layers":"reduce_mean.v1"}
    upstream = "*"
    """
)["model"]

DEFAULT_SCORE_WEIGHTS = {
    "ents_f": 1.0,
    "ents_p": 0.7,
    "ents_r": 0.3,
    "ents_per_type": None,
}


class WeightedEntityRecognizer(EntityRecognizer):
    """Entity recogniser that reweights decoder gradients for the OUT action."""

    def __init__(
        self,
        vocab,
        model: Model,
        name: str = "ner",
        moves: Optional[TransitionSystem] = None,
        *,
        update_with_oracle_cut_size: int = 100,
        incorrect_spans_key: Optional[str] = None,
        scorer=None,
        o_weight: float = 1.0,
        freeze_transformer_layers: int = 0,
    ) -> None:
        super().__init__(
            vocab,
            model,
            name=name,
            moves=moves,
            update_with_oracle_cut_size=update_with_oracle_cut_size,
            incorrect_spans_key=incorrect_spans_key,
            scorer=scorer,
        )
        self.o_weight = float(o_weight)
        self.freeze_transformer_layers = max(0, int(freeze_transformer_layers))
        self._cached_move_count = -1
        self._o_move_indices: List[int] = []

    def _refresh_o_moves(self) -> None:
        if self.moves is None:
            return
        if self._cached_move_count == self.moves.n_moves:
            return
        self._cached_move_count = self.moves.n_moves
        self._o_move_indices = []
        for move_id in range(self.moves.n_moves):
            try:
                label = self.moves.get_class_name(move_id)
            except Exception:
                continue
            if label == "O":
                self._o_move_indices.append(move_id)

    def _apply_freeze_layers(self, nlp: Optional[Language]) -> None:
        if not self.freeze_transformer_layers or nlp is None:
            return
        if "transformer" not in nlp.pipe_names:
            return
        component = nlp.get_pipe("transformer")
        transformer = getattr(component.model, "transformer", None)
        hf_model = getattr(transformer, "model", None)
        encoder = getattr(hf_model, "encoder", None)
        layer_attr = getattr(encoder, "layer", None)
        if not layer_attr:
            return
        for layer in list(layer_attr)[: self.freeze_transformer_layers]:
            for param in layer.parameters():
                param.requires_grad = False

    def initialize(self, get_examples, *, nlp: Optional[Language] = None, **cfg):
        result = super().initialize(get_examples, nlp=nlp, **cfg)
        self._refresh_o_moves()
        self._apply_freeze_layers(nlp)
        return result

    def get_batch_loss(self, states, golds, scores, losses):  # type: ignore[override]
        d_scores = super().get_batch_loss(states, golds, scores, losses)
        if self.o_weight == 1.0:
            return d_scores
        self._refresh_o_moves()
        if not self._o_move_indices:
            return d_scores
        o_view = d_scores[:, self._o_move_indices]
        if losses is not None:
            losses.setdefault(self.name, 0.0)
            losses[self.name] -= float(numpy.square(o_view).sum())
        o_view *= self.o_weight
        if losses is not None:
            losses[self.name] += float(numpy.square(o_view).sum())
        return d_scores


@Language.factory(
    "weighted_ner",
    assigns=["doc.ents", "token.ent_iob", "token.ent_type"],
    default_config={
        "moves": None,
        "update_with_oracle_cut_size": 100,
        "model": DEFAULT_CONFIG_BLOCK,
        "incorrect_spans_key": None,
        "scorer": {"@scorers": "spacy.ner_scorer.v1"},
        "o_weight": 2.0,
        "freeze_transformer_layers": 0,
    },
    default_score_weights=DEFAULT_SCORE_WEIGHTS,
)
def make_weighted_ner(
    nlp: Language,
    name: str,
    model: Model,
    moves: Optional[TransitionSystem],
    update_with_oracle_cut_size: int,
    incorrect_spans_key: Optional[str],
    scorer,
    o_weight: float,
    freeze_transformer_layers: int,
) -> WeightedEntityRecognizer:
    return WeightedEntityRecognizer(
        nlp.vocab,
        model,
        name=name,
        moves=moves,
        update_with_oracle_cut_size=update_with_oracle_cut_size,
        incorrect_spans_key=incorrect_spans_key,
        scorer=scorer,
        o_weight=o_weight,
        freeze_transformer_layers=freeze_transformer_layers,
    )


__all__ = ["WeightedEntityRecognizer", "make_weighted_ner"]

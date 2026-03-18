"""Training callbacks and loggers for spaCy runs with additional diagnostics."""

from __future__ import annotations

import math
from typing import Callable, Dict, List, Optional, Tuple

from spacy.language import Language
from spacy.training.loggers import console_logger
from spacy.util import registry


class _SpanWindowTracker:
    """Collect span window counts per document between evaluation logs."""

    def __init__(self) -> None:
        self._values: List[int] = []

    def record(self, count: int) -> None:
        self._values.append(count)

    def pop(self) -> List[int]:
        values = self._values
        self._values = []
        return values


_TRACKER = _SpanWindowTracker()


@Language.component("span_window_probe")
def span_window_probe(doc):
    trf_data = getattr(doc._, "trf_data", None)
    if trf_data is not None:
        align = getattr(trf_data, "align", None)
        lengths = getattr(align, "lengths", None)
        if lengths is not None:
            try:
                count = len(list(lengths))
            except TypeError:  # pragma: no cover - defensive
                count = 0
            _TRACKER.record(count)
    return doc


def _format_stats(values: List[int]) -> Tuple[float, int]:
    mean = sum(values) / len(values)
    sorted_vals = sorted(values)
    index = max(0, math.ceil(0.95 * len(sorted_vals)) - 1)
    return mean, sorted_vals[index]


@registry.loggers("cv_parser.logger.console_with_spans.v1")
def console_logger_with_spans(
    progress_bar: bool = False,
    console_output: bool = True,
    output_file: Optional[str] = None,
):
    """Wrap the default console logger to emit span window statistics."""

    base_factory = console_logger(
        progress_bar=progress_bar, console_output=console_output, output_file=output_file
    )

    def setup_printer(nlp, stdout, stderr):
        log_step, finalize = base_factory(nlp, stdout, stderr)

        def wrapped_log_step(info: Optional[Dict[str, object]]) -> None:
            if info is not None and console_output:
                stats = _TRACKER.pop()
                if stats:
                    mean, p95 = _format_stats(stats)
                    stdout.write(f"    span windows/doc -> mean: {mean:.2f}, p95: {p95}\n")
                    stdout.flush()
            log_step(info)

        def wrapped_finalize() -> None:
            if console_output:
                stats = _TRACKER.pop()
                if stats:
                    mean, p95 = _format_stats(stats)
                    stdout.write(f"    span windows/doc -> mean: {mean:.2f}, p95: {p95}\n")
                    stdout.flush()
            finalize()

        return wrapped_log_step, wrapped_finalize

    return setup_printer


@registry.callbacks("cv_parser.training.freeze_transformer.v1")
def freeze_transformer(steps: int = 0) -> Callable[[Language, Dict[str, object]], None]:
    """Temporarily disables transformer gradients for the first `steps` updates."""

    total_steps = max(int(steps), 0)
    state = {"frozen": False, "initialised": False, "step": 0}

    def _set_gradients(component, enabled: bool) -> None:
        model = getattr(component, "model", None)
        if model is None:
            return
        if hasattr(model, "set_gradients_enabled"):
            model.set_gradients_enabled(enabled)
            return
        transformer = getattr(model, "transformer", None)
        params = transformer.parameters() if transformer is not None else model.parameters()
        for param in params:
            param.requires_grad = enabled

    def callback(nlp: Language, data: Dict[str, object]) -> None:
        if total_steps <= 0 or "transformer" not in nlp.pipe_names:
            return

        info = data.get("info") if isinstance(data, dict) else None
        step = state["step"]
        if isinstance(info, dict) and "step" in info:
            step = int(info.get("step", step))

        component = nlp.get_pipe("transformer")

        if not state["initialised"]:
            _set_gradients(component, False)
            state["frozen"] = True
            state["initialised"] = True
            print(f"Transformer gradients frozen for first {total_steps} steps")

        if state["frozen"] and step >= total_steps:
            _set_gradients(component, True)
            state["frozen"] = False
            print("Transformer gradients unfrozen")

        state["step"] = step + 1

    return callback

"""Backward-compatible CLI shim for the unified dataset preparer."""

from .prepare_dataset import main

__all__ = ["main"]

if __name__ == "__main__":
    main()

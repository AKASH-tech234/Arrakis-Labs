# RAG module
# Lazy imports to enable proper mocking in tests


def __getattr__(name):
    """Lazy import of submodules to enable proper patching in tests."""
    import importlib
    if name in ("vector_store", "retriever", "context_builder", "monitoring"):
        return importlib.import_module(f".{name}", __name__)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

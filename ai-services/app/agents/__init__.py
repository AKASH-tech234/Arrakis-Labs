# Agents module
# Lazy imports to enable proper mocking in tests


def __getattr__(name):
    """Lazy import of submodules to enable proper patching in tests."""
    import importlib
    if name in (
        "base_json_agent",
        "feedback_agent", 
        "hint_agent",
        "pattern_detection_agent",
        "learning_agent",
        "difficulty_agent",
        "report_agent",
        "context_compressor"
    ):
        return importlib.import_module(f".{name}", __name__)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

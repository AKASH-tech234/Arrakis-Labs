# Agents module
# Lazy imports to enable proper mocking in tests


def __getattr__(name):
    """Lazy import of submodules to enable proper patching in tests."""
    import importlib
    if name in (
        "base_json_agent",
        "feedback_agent", 
        "hint_agent",
        "learning_agent",
        "report_agent",
        "context_compressor",
        "agent_input"
    ):
        return importlib.import_module(f".{name}", __name__)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

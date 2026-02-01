export const ARRAKIS_MONACO_THEME = "arrakis-dark";

export function defineArrakisMonacoTheme(monaco) {

  monaco.editor.defineTheme(ARRAKIS_MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [{ token: "", foreground: "E8E4D9", background: "0A0A08" }],
    colors: {
      "editor.background": "#0A0A08",
      "editor.foreground": "#E8E4D9",
      "editorLineNumber.foreground": "#3D3D3D",
      "editorLineNumber.activeForeground": "#78716C",
      "editorCursor.foreground": "#F59E0B",
      "editor.selectionBackground": "#92400E66",
      "editor.inactiveSelectionBackground": "#92400E33",
      "editor.lineHighlightBackground": "#121210",
      "editorLineNumber.background": "#0A0A08",
      "editorGutter.background": "#0A0A08",
      "editorGutter.modifiedBackground": "#D97706",
      "editorGutter.addedBackground": "#22C55E",
      "editorGutter.deletedBackground": "#EF4444",
      "editorIndentGuide.background": "#1A1814",
      "editorIndentGuide.activeBackground": "#3D3D3D",
      "editorWhitespace.foreground": "#1A1814",
      "editorWidget.background": "#121210",
      "editorWidget.border": "#1A1814",
      "scrollbarSlider.background": "#1A1814AA",
      "scrollbarSlider.hoverBackground": "#3D3D3DAA",
      "scrollbarSlider.activeBackground": "#78716CAA",
    },
  });
}
